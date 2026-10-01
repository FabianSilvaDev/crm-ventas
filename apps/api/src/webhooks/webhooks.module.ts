import { Module } from '@nestjs/common';

import { InMemoryRateLimiter } from '../common/rate-limit/in-memory-rate-limiter.js';
import { IpRateLimitGuard } from '../common/rate-limit/ip-rate-limit.guard.js';
import { RATE_LIMITER } from '../common/rate-limit/rate-limiter.js';
import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';
import { DevMetaLeadIntakeNoPersistencia } from './meta/dev-meta-lead-intake.js';
import { FixtureMetaGraphClient } from './meta/fixture-meta-graph.client.js';
import { HttpMetaGraphClient } from './meta/http-meta-graph.client.js';
import { META_LEAD_GRAPH_CLIENT } from './meta/meta-graph.client.js';
import type { MetaLeadGraphClient } from './meta/meta-graph.client.js';
import { MetaSignatureGuard } from './meta/meta-signature.guard.js';
import { MetaWebhookController } from './meta/meta-webhook.controller.js';
import { META_LEAD_INTAKE } from './meta/meta-lead-intake.js';

/**
 * Webhooks de terceros.
 *
 * Estos endpoints son **públicos** (los llama Meta, no un usuario nuestro) y por eso su autenticación
 * es la firma HMAC, no un token de sesión.
 *
 * Los guards se declaran como providers —y no se dejan instanciar al vuelo desde `@UseGuards`— para
 * que sus dependencias se resuelvan aquí y un error de inyección aparezca al arrancar y no en la
 * primera petición real de Meta. Por el mismo motivo se declara aquí el cliente del Graph API: así un
 * `META_GRAPH_MODE` mal puesto falla al arrancar y no cuando llegue el primer lead.
 */
@Module({
  controllers: [MetaWebhookController],
  providers: [
    MetaSignatureGuard,
    IpRateLimitGuard,
    {
      provide: RATE_LIMITER,
      inject: [ENV],
      useFactory: (env: Env) => new InMemoryRateLimiter(env.PUBLIC_RATE_LIMIT_PER_MINUTE),
    },
    {
      provide: META_LEAD_INTAKE,
      inject: [ENV],
      useFactory: (env: Env) => crearIngesta(env),
    },
    {
      provide: META_LEAD_GRAPH_CLIENT,
      inject: [ENV],
      useFactory: (env: Env) => crearClienteDeGrafo(env),
    },
  ],
})
export class WebhooksModule {}

/**
 * Elige la implementación de la ingesta.
 *
 * **En producción no hay ninguna**: la ingesta real necesita base de datos (identidad, lead,
 * testimonio de consentimiento, `audit_logs`) y esa parte es el Hito 2. Se lanza al arrancar, y es
 * deliberado:
 *
 * - Con el doble de desarrollo en producción, el webhook respondería `200 {received:true}` y **el
 *   lead se perdería para siempre**: Meta lo daría por entregado y no lo reintentaría. Un CRM
 *   perdiendo leads en silencio, uno a uno, sin que nada falle, es el peor desenlace posible.
 * - Sin implementación (o con un `503` permanente), el fallo es ruidoso y reversible.
 *
 * Preferimos que la app no arranque a que arranque mintiendo.
 */
function crearIngesta(env: Env): DevMetaLeadIntakeNoPersistencia {
  if (env.NODE_ENV === 'production') {
    throw new Error(
      'No hay implementación de la ingesta de leads: requiere base de datos (Hito 2). ' +
        'Arrancar en producción con el doble de desarrollo haría que los leads se aceptaran y se ' +
        'perdieran sin dejar rastro.',
    );
  }

  return new DevMetaLeadIntakeNoPersistencia();
}

/**
 * Elige el cliente del Graph API según `META_GRAPH_MODE`.
 *
 * `fixture` no es un atajo de desarrollo que se pueda colar en producción: `env.ts` **rechaza** esa
 * combinación al arrancar, así que aquí no hace falta volver a comprobarlo.
 *
 * **Hoy nadie consume este cliente todavía.** La ingesta que lo usa —leer el lead, resolver la
 * identidad, comprobar el consentimiento— necesita base de datos y es el Hito 2. Se registra ya por
 * dos razones: deja el camino del Graph API cerrado y probado con fixtures, y hace que una
 * configuración imposible se vea al arrancar. Es una dependencia cableada y sin consumidor, y se dice
 * en voz alta para que no parezca que la ingesta ya está hecha.
 */
function crearClienteDeGrafo(env: Env): MetaLeadGraphClient {
  if (env.META_GRAPH_MODE === 'fixture') {
    return new FixtureMetaGraphClient();
  }

  const token = env.META_ACCESS_TOKEN;

  if (token === undefined) {
    // `env.ts` ya lo exige cuando el modo es `live`; esto es la segunda barrera, por si alguien
    // relaja aquella validación sin mirar aquí.
    throw new Error('META_GRAPH_MODE=live exige META_ACCESS_TOKEN.');
  }

  return new HttpMetaGraphClient({
    accessToken: token,
    apiVersion: env.META_GRAPH_API_VERSION,
    timeoutMs: env.META_GRAPH_TIMEOUT_MS,
  });
}
