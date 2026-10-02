import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import type { Lead, LeadListResponse, ProblemDetails } from '@crm/contracts';

/**
 * Cliente de `GET /api/v1/leads` (`docs/api.md` §9.2).
 *
 * El endpoint ahora está implementado con un repositorio en memoria y se protege en desarrollo con
 * `X-Dev-Api-Token`. Sigue escrito a mano y tipado contra `@crm/contracts`, contra la decisión
 * ADR-012 —que preveía generarlo desde OpenAPI— y por la misma razón que `core/health.ts`: ese
 * pipeline no existe todavía. Los tipos vienen del contrato compartido; la comprobación en tiempo
 * de ejecución es una comprobación de forma, no una validación con Zod (ver `comoListaDeLeads`, y
 * el porqué de la diferencia: 460 kB de bundle).
 *
 * ## Los tres desenlaces, y por qué se distinguen
 *
 * - **`ok`** → el API respondió y la respuesta cumple el contrato.
 * - **`problem`** → el API respondió con un error del contrato (4xx/5xx problem+json).
 * - **`unreachable`** → no hubo respuesta (API caído, puerto equivocado), o la respuesta no se pudo
 *   interpretar. Exigen acciones distintas —mirar el API encendido o mirar el contrato— y mezclarlas
 *   convertiría un API caído en un «error 500» que apunta al sitio equivocado.
 */
export type LeadsOutcome = 'ok' | 'problem' | 'unreachable';

export interface LeadsResult {
  readonly outcome: LeadsOutcome;
  readonly httpStatus: number | null;
  readonly traceId: string | null;
  readonly leads: readonly Lead[];
  /**
   * Hay más leads de los que trae esta página (`pageInfo.hasMore`).
   *
   * Se expone para que la pantalla **no dé a entender** que esa es la lista completa: con paginación
   * por cursor no hay `total`, así que lo único honesto que se puede decir es «hay más».
   */
  readonly hasMore: boolean;
  readonly problem: ProblemDetails | null;
  /** Qué falló exactamente cuando no hay `problem` del contrato. Se pinta tal cual. */
  readonly transportError: string | null;
}

/** Tope de la primera página. El máximo del contrato es 100; 50 llena una pantalla sin castigar. */
const LIMITE_POR_PAGINA = 50;

const TRACE_ID_HEADER = 'X-Trace-Id';

/**
 * No se reutiliza el `Probe<T>` de `core/health.ts` a propósito: aquel describe una sonda con un
 * cuerpo genérico, y este una lista ya validada. Compartir el tipo obligaría a leer la lista de
 * leads como si fuera un `body` cualquiera, y a acoplar dos pantallas que no tienen por qué
 * evolucionar juntas. La forma se repite; el significado no.
 */
@Injectable({ providedIn: 'root' })
export class LeadsApi {
  readonly #http = inject(HttpClient);

  async list(): Promise<LeadsResult> {
    try {
      const response = await firstValueFrom(
        this.#http.get<unknown>('/api/v1/leads', {
          observe: 'response',
          params: { limit: LIMITE_POR_PAGINA },
        }),
      );

      // Se comprueba la forma, no se asume. Ver `comoListaDeLeads` para por qué esto no es Zod.
      const lista = comoListaDeLeads(response.body);

      if (lista === null) {
        return {
          outcome: 'unreachable',
          httpStatus: response.status,
          traceId: response.headers.get(TRACE_ID_HEADER),
          leads: [],
          hasMore: false,
          problem: null,
          transportError:
            'El API respondió, pero la respuesta no tiene la forma de una lista de leads. No se muestran datos que no se puedan verificar.',
        };
      }

      return {
        outcome: 'ok',
        httpStatus: response.status,
        traceId: response.headers.get(TRACE_ID_HEADER),
        leads: lista.items,
        hasMore: lista.pageInfo.hasMore,
        problem: null,
        transportError: null,
      };
    } catch (error: unknown) {
      return this.#comoFallo(error);
    }
  }

  #comoFallo(error: unknown): LeadsResult {
    if (!(error instanceof HttpErrorResponse)) {
      return {
        outcome: 'unreachable',
        httpStatus: null,
        traceId: null,
        leads: [],
        hasMore: false,
        problem: null,
        transportError: 'Fallo inesperado en el cliente HTTP.',
      };
    }

    // status 0 = el navegador no llegó al servidor.
    if (error.status === 0) {
      return {
        outcome: 'unreachable',
        httpStatus: null,
        traceId: null,
        leads: [],
        hasMore: false,
        problem: null,
        transportError: 'No hubo respuesta del API. ¿Está arrancado en el puerto 3000?',
      };
    }

    const problem = asProblemDetails(error);

    return {
      outcome: problem === null ? 'unreachable' : 'problem',
      httpStatus: error.status,
      traceId: error.headers.get(TRACE_ID_HEADER),
      leads: [],
      hasMore: false,
      problem,
      transportError:
        problem === null ? 'Respuesta de error con un cuerpo que no es problem+json.' : null,
    };
  }
}

/**
 * Comprueba que la respuesta tenga la forma que esta pantalla va a leer.
 *
 * ## Por qué NO se usa `leadListResponseSchema`
 *
 * Importar cualquier schema de `@crm/contracts` **como valor** arrastra Zod entero —y su locale en
 * español— al bundle del navegador. Medido en este proyecto: el chunk de esta ruta pasaba de 11 kB a
 * 472 kB (de 4 kB a 82 kB comprimido), por una comprobación de forma.
 *
 * Quien valida de verdad es el API, con esos mismos schemas. Revalidar aquí no protege de un dato
 * malo —el API no lo deja pasar—, sino de que **nuestro propio despliegue** esté desajustado (una web
 * vieja contra un API nuevo). Para eso basta con saber si lo que llegó es una lista; el resto de
 * campos se leen de forma defensiva y un campo desconocido se pinta como venga, sin romper la tabla.
 *
 * Es la misma línea que sigue `core/health.ts`, que también importa del contrato solo tipos.
 *
 * ## Qué comprueba, exactamente
 *
 * Que sea un objeto, que `items` sea un array y que `pageInfo.hasMore` sea booleano. **No** valida
 * cada lead: una comprobación profunda es trabajo del contrato, y hacerla a mano aquí sería una
 * segunda verdad que se desincroniza.
 *
 * @returns el cuerpo tipado si tiene la forma esperada; `null` si no.
 */
function comoListaDeLeads(valor: unknown): LeadListResponse | null {
  if (typeof valor !== 'object' || valor === null) {
    return null;
  }

  const { items, pageInfo } = valor as { items?: unknown; pageInfo?: unknown };

  if (!Array.isArray(items) || typeof pageInfo !== 'object' || pageInfo === null) {
    return null;
  }

  if (typeof (pageInfo as { hasMore?: unknown }).hasMore !== 'boolean') {
    return null;
  }

  return valor as LeadListResponse;
}

/**
 * Reconoce un `ProblemDetails` sin fiarse del cliente.
 *
 * Se comprueba que existan `code` y `title` antes de aceptarlo: un proxy caído devuelve su propia
 * página HTML, y pintarla como si fuera un problema del contrato daría un mensaje sin sentido.
 */
function asProblemDetails(error: HttpErrorResponse): ProblemDetails | null {
  const raw: unknown = error.error;
  const candidate: unknown = typeof raw === 'string' ? parseJson(raw) : raw;

  if (candidate === null || typeof candidate !== 'object') {
    return null;
  }

  const value = candidate as Record<string, unknown>;
  if (typeof value['code'] !== 'string' || typeof value['title'] !== 'string') {
    return null;
  }

  return candidate as ProblemDetails;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
