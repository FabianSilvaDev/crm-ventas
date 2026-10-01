import { Inject, Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { Response } from 'express';

import { AppError } from '../app-error.js';
import type { RequestWithContext } from '../trace-id.middleware.js';
import { RATE_LIMITER } from './rate-limiter.js';
import type { RateLimiter } from './rate-limiter.js';

/**
 * Limita las peticiones por IP en los endpoints públicos.
 *
 * ## De dónde sale la IP, y por qué no se mira `X-Forwarded-For`
 *
 * Se usa `req.ip`, es decir, la IP de la conexión TCP. **No** se lee `X-Forwarded-For`: sin un proxy
 * delante declarado de forma explícita (`trust proxy`), esa cabecera la escribe el cliente y
 * cualquiera podría inventarse una IP distinta por petición para esquivar el límite — el limitador
 * se convertiría en decoración.
 *
 * Consecuencia a tener presente al desplegar: **detrás de un proxy, todas las peticiones parecen
 * venir de la misma IP** y el límite se agota entre todos. Ese día hay que configurar `trust proxy`
 * con el número exacto de saltos, que es una decisión de despliegue y no un ajuste de este código.
 *
 * ## Un solo proceso
 *
 * La implementación en memoria cuenta por proceso. Con varias réplicas el límite efectivo se
 * multiplica por el número de réplicas; ver `rate-limiter.ts`.
 */
@Injectable()
export class IpRateLimitGuard implements CanActivate {
  constructor(@Inject(RATE_LIMITER) private readonly limiter: RateLimiter) {}

  canActivate(context: ExecutionContext): boolean {
    const http = context.switchToHttp();
    const request = http.getRequest<RequestWithContext>();
    const response = http.getResponse<Response>();

    const decision = this.limiter.check(request.ip ?? 'ip-desconocida');

    if (!decision.allowed) {
      // `Retry-After` no lo emite el filtro de errores (solo construye el cuerpo), así que se fija
      // aquí antes de lanzar. Un 429 sin esta cabecera deja al cliente adivinando cuánto esperar.
      response.setHeader('Retry-After', String(decision.retryAfterSeconds));

      throw new AppError('RATE_LIMIT_EXCEEDED', 'Demasiadas peticiones. Inténtalo más tarde.', {
        context: { retryAfterSeconds: decision.retryAfterSeconds },
      });
    }

    return true;
  }
}
