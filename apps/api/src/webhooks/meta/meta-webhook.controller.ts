import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Inject,
  Logger,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { metaLeadgenValueSchema, metaWebhookEnvelopeSchema, metaWebhookVerifyQuerySchema } from '@crm/contracts';
import type {
  MetaLeadgenValue,
  MetaWebhookAccepted,
  MetaWebhookEnvelope,
  MetaWebhookVerifyQuery,
} from '@crm/contracts';

import { AppError } from '../../common/app-error.js';
import { IpRateLimitGuard } from '../../common/rate-limit/ip-rate-limit.guard.js';
import { timingSafeEqualStrings } from '../../common/timing-safe.js';
import { ENV } from '../../config/config.module.js';
import type { Env } from '../../config/env.js';
import { META_LEAD_INTAKE } from './meta-lead-intake.js';
import type { MetaLeadEvent, MetaLeadIntake, MetaLeadIntakeResult } from './meta-lead-intake.js';
import { MetaSignatureGuard } from './meta-signature.guard.js';

/**
 * Tope del `challenge` que devolvemos en el handshake.
 *
 * Es un valor que **reflejamos tal cual**, así que se acota: sin tope, el endpoint devolvería el
 * cuerpo que le pidieran (hasta el límite de la URL) y podría usarse como amplificador. 256
 * caracteres sobran para el valor que Meta manda.
 */
const MAX_CHALLENGE_LENGTH = 256;

/**
 * Webhook de Meta Lead Ads (`docs/api.md` §8, ADR-017). **Es la vía de entrada principal de leads**,
 * y el único endpoint público que no pasa por autenticación de usuario: su autenticación es la firma
 * HMAC.
 *
 * ## `GET` — handshake de verificación
 *
 * Meta lo llama **una sola vez**, al configurar la URL del webhook, y espera recibir el `challenge`
 * en crudo. Se devuelve `text/plain` y no JSON por dos razones: es literalmente lo que Meta compara,
 * y un `Content-Type` de texto evita que un valor reflejado se interprete como HTML.
 *
 * ## `POST` — notificación de entrega
 *
 * Responde **siempre `200`** salvo que la firma no valide o el sobre sea inservible: `docs/api.md`
 * §8.4 prohíbe los 4xx por eventos no reconocidos o duplicados, porque Meta los reintentaría sin
 * fin. Un `409` por duplicado sería, además de incorrecto, una forma de perder leads.
 */
@Controller('webhooks/meta')
export class MetaWebhookController {
  private readonly logger = new Logger(MetaWebhookController.name);

  constructor(
    @Inject(ENV) private readonly env: Env,
    @Inject(META_LEAD_INTAKE) private readonly intake: MetaLeadIntake,
  ) {}

  @Get()
  @UseGuards(IpRateLimitGuard)
  @Header('Content-Type', 'text/plain; charset=utf-8')
  verificar(@Query({ schema: metaWebhookVerifyQuerySchema }) query: MetaWebhookVerifyQuery): string {
    const tokenValido = timingSafeEqualStrings(query['hub.verify_token'], this.env.META_VERIFY_TOKEN);

    if (query['hub.mode'] !== 'subscribe' || !tokenValido) {
      // Auditoría del intento: si alguien está probando el token, quiero verlo en los logs. El
      // token recibido **no** se registra (podría ser el correcto con un typo, y es material ajeno).
      this.logger.warn({
        action: 'webhook.handshake_rejected',
        provider: 'meta',
        mode: query['hub.mode'],
        tokenCoincide: tokenValido,
      });

      throw new AppError('FORBIDDEN_PERMISSION', 'La verificación del webhook no es válida.');
    }

    return query['hub.challenge'].slice(0, MAX_CHALLENGE_LENGTH);
  }

  @Post()
  // Primero el límite, después la firma: la verificación HMAC es trabajo de CPU y no queremos
  // gastarlo a peticiones de quien ni siquiera está autorizado a mandarlas.
  @UseGuards(IpRateLimitGuard, MetaSignatureGuard)
  @HttpCode(HttpStatus.OK)
  async recibir(
    @Body({ schema: metaWebhookEnvelopeSchema }) envelope: MetaWebhookEnvelope,
  ): Promise<MetaWebhookAccepted> {
    // Un sobre firmado por Meta pero de otra superficie (Instagram, WhatsApp…) no es un error
    // nuestro: `packages/contracts` deja `object` como `string` y no como literal exactamente para
    // poder responder `200 {ignored:true}` en vez de un 422 que Meta reintentaría sin fin.
    if (envelope.object !== 'page') {
      return { received: true, ignored: true };
    }

    const eventos = extraerEventosDeLead(envelope);

    if (eventos.length === 0) {
      // Sobre firmado por Meta, pero sin nada de `leadgen`. Se responde 200 y se sigue: es la
      // diferencia entre "no me interesa" y "algo ha ido mal".
      return { received: true, ignored: true };
    }

    const resultados = await Promise.all(
      eventos.map((evento) => this.intake.intake(evento)),
    );

    return respuestaDe(resultados);
  }
}

/**
 * Traduce el resultado de la ingesta a la respuesta que espera Meta.
 *
 * `duplicate` es **informativo y nunca un error**: si respondiéramos `409`, Meta lo leería como fallo
 * nuestro y reintentaría, que es justo lo contrario de lo que queremos con un duplicado.
 *
 * Se saca como función pura porque en esta rebanada la rama de duplicado es inalcanzable por HTTP
 * —el doble de desarrollo siempre devuelve `stored`— y una rama sin cubrir es una rama que nadie sabe
 * si funciona cuando por fin exista la base de datos.
 */
export function respuestaDe(resultados: readonly MetaLeadIntakeResult[]): MetaWebhookAccepted {
  if (resultados.every((resultado) => resultado === 'duplicate')) {
    return { received: true, duplicate: true };
  }

  return { received: true };
}

/**
 * Saca los eventos de lead del sobre.
 *
 * Un `change` de tipo `leadgen` cuyo `value` no traiga `leadgen_id` **se ignora en vez de provocar un
 * 422**: es un payload que Meta consideraría entregado, y un 4xx aquí solo conseguiría reintentos
 * eternos de un cuerpo que nunca vamos a poder usar.
 *
 * El resto de `changes` (comentarios, mensajes…) se ignoran sin registrarse: no son nuestros.
 */
function extraerEventosDeLead(envelope: MetaWebhookEnvelope): MetaLeadEvent[] {
  const eventos: MetaLeadEvent[] = [];

  for (const entry of envelope.entry) {
    for (const change of entry.changes) {
      if (change.field !== 'leadgen') {
        continue;
      }

      const parsed = metaLeadgenValueSchema.safeParse(change.value);

      if (!parsed.success) {
        continue;
      }

      eventos.push(aEvento(parsed.data, entry.id, change));
    }
  }

  return eventos;
}

function aEvento(value: MetaLeadgenValue, pageId: string, rawChange: unknown): MetaLeadEvent {
  return {
    leadgenId: value.leadgen_id,
    formId: value.form_id ?? null,
    // El `page_id` del valor es el de la página que originó el lead; el `id` de la entrada es la
    // página que entrega el webhook. Se prefiere el del valor cuando viene.
    pageId: value.page_id ?? pageId,
    adId: value.ad_id ?? null,
    adsetId: value.adset_id ?? null,
    campaignId: value.campaign_id ?? null,
    createdTime: value.created_time === undefined ? null : String(value.created_time),
    rawChange,
  };
}
