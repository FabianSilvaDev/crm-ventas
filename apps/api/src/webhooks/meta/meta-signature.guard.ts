import { Inject, Injectable, Logger } from '@nestjs/common';
import type { CanActivate, ExecutionContext, RawBodyRequest } from '@nestjs/common';

import { AppError } from '../../common/app-error.js';
import type { RequestWithContext } from '../../common/trace-id.middleware.js';
import { ENV } from '../../config/config.module.js';
import type { Env } from '../../config/env.js';
import { META_SIGNATURE_HEADER, verifyMetaSignature } from './meta-signature.js';

/**
 * Rechaza cualquier webhook de Meta que no venga firmado con el *App Secret*.
 *
 * Es un **guard** y no un pipe: los guards corren antes que los pipes, así que ningún schema ni
 * transformación se aplica a un cuerpo cuya firma no se ha comprobado todavía.
 *
 * Ojo con una afirmación tentadora pero **falsa**: que el cuerpo "no se haya parseado aún". Express
 * parsea el JSON en su middleware, antes de llegar al router, y eso es inevitable. Lo que sí se
 * controla es de dónde se lee el cuerpo crudo: `req.rawBody`, que existe porque `createApp` levanta
 * la app con `rawBody: true`. La firma **nunca** se recalcula sobre `req.body` ya parseado ni sobre
 * `JSON.stringify(req.body)`, porque ambos dan bytes distintos a los que llegaron por el cable y la
 * verificación fallaría —o peor, coincidiría por casualidad con un cuerpo reescrito.
 *
 * ## Auditoría
 *
 * Un rechazo se registra con `action: 'webhook.signature_invalid'` y **sin el cuerpo**, que traería
 * PII de una persona que ni siquiera ha demostrado ser quien dice. Tampoco se registra la cabecera
 * de firma: no es un secreto, pero no aporta nada y es material que no elegimos.
 *
 * Hoy esto es una **línea de log estructurada, no una fila de `audit_logs`**, porque en esta
 * rebanada no hay base de datos. `docs/security.md` §36 exige auditoría persistida y trazable; esa
 * parte queda pendiente y no se declara cumplida (ver la deuda registrada en el plan).
 */
@Injectable()
export class MetaSignatureGuard implements CanActivate {
  private readonly logger = new Logger(MetaSignatureGuard.name);

  constructor(@Inject(ENV) private readonly env: Env) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RawBodyRequest<RequestWithContext>>();

    const valid = verifyMetaSignature({
      rawBody: request.rawBody,
      signatureHeader: request.header(META_SIGNATURE_HEADER),
      appSecret: this.env.META_APP_SECRET,
    });

    if (!valid) {
      this.logger.warn({
        action: 'webhook.signature_invalid',
        provider: 'meta',
        method: request.method,
        // `path` y no `originalUrl`: la query no aporta nada aquí y no queremos arrastrarla al log.
        path: request.path,
        traceId: request.traceId,
        // Solo la **presencia** de cada pieza, nunca su contenido.
        hasSignatureHeader: request.header(META_SIGNATURE_HEADER) !== undefined,
        hasRawBody: request.rawBody !== undefined,
      });

      throw new AppError('WEBHOOK_SIGNATURE_INVALID', 'La firma del webhook no es válida.');
    }

    return true;
  }
}
