import { Logger } from '@nestjs/common';
import { metaGraphErrorSchema, metaLeadGraphResponseSchema } from '@crm/contracts';
import type { MetaLeadGraphResponse } from '@crm/contracts';

import { AppError } from '../../common/app-error.js';
import type { MetaLeadGraphClient } from './meta-graph.client.js';

/** Host real del Graph API. Configurable en el constructor para poder apuntar a un servidor de pruebas. */
const GRAPH_BASE_URL = 'https://graph.facebook.com';

/**
 * Campos que pedimos. Se pide lo mínimo que la ingesta necesita para construir un lead: identidad
 * (los `field_data`), atribución (ids de campaña/conjunto/anuncio) y **la única evidencia de
 * consentimiento que Meta puede darnos** (`custom_disclaimer_responses`).
 */
const CAMPOS = [
  'id',
  'created_time',
  'form_id',
  'ad_id',
  'adset_id',
  'campaign_id',
  'platform',
  'field_data',
  'custom_disclaimer_responses',
].join(',');

/**
 * Tope del mensaje de error de Meta que se registra. El texto lo escribe un tercero: sin tope, un
 * mensaje enorme inundaría el log.
 */
const MAX_LONGITUD_MENSAJE = 500;

export interface HttpMetaGraphClientOptions {
  /** Token de la app. **Nunca** se registra ni se pone en el `context` de un error. */
  readonly accessToken: string;
  /** Versión del Graph API, p. ej. `v21.0`. Fijarla evita que un cambio de Meta nos rompa sin avisar. */
  readonly apiVersion: string;
  readonly timeoutMs: number;
  /** Solo para pruebas: apunta el cliente a un servidor local. Por defecto, el Graph API real. */
  readonly baseUrl?: string;
}

/**
 * Cliente real del Graph API, con `fetch` nativo y `AbortSignal.timeout`.
 *
 * ## El token viaja en la cabecera, no en la URL
 *
 * Meta admite las dos formas (`?access_token=…` o `Authorization: Bearer …`). Se usa la cabecera por
 * una razón concreta: **lo que va en la URL acaba en los sitios equivocados** — mensajes de error de
 * `fetch` que citan la URL, pilas de excepción, logs de proxies y de balanceadores, historiales. Un
 * token en una cabecera no aparece en ninguno de ellos, y este cliente nunca registra la URL.
 *
 * Cuando la app de Meta esté aprobada habrá que **confirmar contra la API real** que la cabecera vale
 * para `GET /{leadgen_id}`; si no, el cambio es una línea en `fetchLead`. Está anotado aquí porque es
 * una suposición que no se ha podido verificar sin credenciales.
 *
 * ## Qué NO hace
 *
 * No reintenta. Un reintento con espera dentro del webhook alargaría la respuesta que Meta está
 * esperando; el reintento correcto aquí es devolver `503` y dejar que **Meta** reintente, que es quien
 * tiene la política de reintentos y el presupuesto de tiempo.
 */
export class HttpMetaGraphClient implements MetaLeadGraphClient {
  private readonly logger = new Logger(HttpMetaGraphClient.name);
  private readonly baseUrl: string;

  constructor(private readonly options: HttpMetaGraphClientOptions) {
    this.baseUrl = options.baseUrl ?? GRAPH_BASE_URL;
  }

  async fetchLead(leadgenId: string): Promise<MetaLeadGraphResponse | null> {
    // El id se codifica aunque hoy sea numérico: llega desde un payload externo.
    const url = `${this.baseUrl}/${this.options.apiVersion}/${encodeURIComponent(leadgenId)}?fields=${CAMPOS}`;

    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.options.accessToken}`,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(this.options.timeoutMs),
      });
    } catch (error) {
      throw this.errorDeRed(error);
    }

    // 404 es un dato, no un fallo: ese lead no existe. Ver el contrato en `meta-graph.client.ts`.
    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      const detalle = await this.leerError(response);
      this.logger.error({ action: 'meta_graph.request_failed', status: response.status, ...detalle });

      throw new AppError('DEPENDENCY_UNAVAILABLE', 'La Graph API rechazó la consulta del lead.', {
        context: { status: response.status, ...detalle },
      });
    }

    const cuerpo = await this.leerJson(response);

    const parsed = metaLeadGraphResponseSchema.safeParse(cuerpo);
    if (!parsed.success) {
      // Una forma que no entendemos es un fallo de la dependencia, no nuestro: se trata como
      // transitorio. Si fuera un cambio permanente de Meta, el `503` hará que se vea en los logs en
      // vez de perderse como un lead mal guardado.
      const campos = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
      this.logger.error({ action: 'meta_graph.unexpected_shape', campos });

      throw new AppError('DEPENDENCY_UNAVAILABLE', 'La Graph API devolvió un lead con una forma inesperada.', {
        context: { campos },
      });
    }

    return parsed.data;
  }

  /**
   * Traduce un fallo de red a `DEPENDENCY_UNAVAILABLE`.
   *
   * El error original va en `cause`, que `docs/api.md` §2.1 y `AppError` dejan claro que **no se
   * serializa al cliente**: sirve para el log, no para la respuesta. Aun así no se mete en `context`,
   * que sí viaja.
   */
  private errorDeRed(error: unknown): AppError {
    const esTimeout = error instanceof Error && error.name === 'TimeoutError';

    this.logger.error({
      action: esTimeout ? 'meta_graph.timeout' : 'meta_graph.network_error',
      timeoutMs: this.options.timeoutMs,
    });

    return new AppError(
      'DEPENDENCY_UNAVAILABLE',
      esTimeout
        ? `La Graph API no respondió en ${this.options.timeoutMs} ms.`
        : 'No se pudo contactar con la Graph API.',
      { context: { timeoutMs: this.options.timeoutMs }, cause: error },
    );
  }

  /** Lee el cuerpo como JSON sin lanzar: un proxy puede devolver HTML y eso no debe romper la traducción. */
  private async leerJson(response: Response): Promise<unknown> {
    try {
      return await response.json();
    } catch {
      return undefined;
    }
  }

  /**
   * Extrae **solo los campos estructurados** del error de Meta.
   *
   * El `message` que manda Meta es texto libre de un tercero: se registra —redactado y acotado— y se
   * deja fuera del `context`, que sí llega al cliente.
   */
  private async leerError(response: Response): Promise<Record<string, unknown>> {
    const parsed = metaGraphErrorSchema.safeParse(await this.leerJson(response));

    if (!parsed.success) {
      return {};
    }

    const { code, type, error_subcode, fbtrace_id, message } = parsed.data.error;

    if (message !== undefined) {
      this.logger.error({ action: 'meta_graph.error_message', message: this.redactar(message) });
    }

    return { graphCode: code, graphType: type, graphSubcode: error_subcode, fbtraceId: fbtrace_id };
  }

  /**
   * Quita el token del texto antes de registrarlo, y lo acota.
   *
   * **Meta devuelve el token dentro del mensaje de error** cuando el token es el problema
   * (`{"message":"Invalid OAuth access token: EAAG…"}`). Registrarlo tal cual sería escribir el
   * secreto en el log, que es justo lo que `docs/security.md` prohíbe — y una prueba de este fichero
   * lo comprueba precisamente con ese caso.
   *
   * El tope de longitud no es decorativo: el texto lo escribe un tercero, así que un mensaje enorme
   * (o un endpoint comprometido) podría inundar el log.
   */
  private redactar(texto: string): string {
    const sinToken =
      this.options.accessToken.length === 0
        ? texto
        : texto.split(this.options.accessToken).join('[token redactado]');

    return sinToken.length > MAX_LONGITUD_MENSAJE
      ? `${sinToken.slice(0, MAX_LONGITUD_MENSAJE)}…`
      : sinToken;
  }
}
