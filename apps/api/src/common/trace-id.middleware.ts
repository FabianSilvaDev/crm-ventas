import type { NextFunction, Request, Response } from 'express';

import { generateTraceId, runWithRequestContext, sanitizeRequestId } from './request-context.js';

/** `Request` de Express con el contexto ya resuelto. */
export interface RequestWithContext extends Request {
  traceId?: string;
  requestId?: string;
}

/**
 * Middleware de correlación. Se registra con `app.use()` en `main.ts`, **no** con
 * `MiddlewareConsumer`.
 *
 * Motivo: NestJS 12 monta Express 5 (path-to-regexp 8), donde `forRoutes('*')` ya no es válido y
 * la sintaxis de comodín cambió. `app.use()` se ejecuta antes del routing, vale para cualquier
 * ruta presente o futura (incluidos `/health/*` y `/metrics`) y no depende de esa sintaxis.
 *
 * Deja el `traceId` en dos sitios a propósito: en `req` (para que el filtro de excepciones lo lea
 * aunque el contexto asíncrono se haya perdido) y en `AsyncLocalStorage` (para que los servicios
 * lo lean sin recibirlo por parámetro). `docs/api.md` §1.9 exige que sea el mismo en respuesta,
 * error y logs.
 */
export function traceIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const traceId = generateTraceId();
  const requestId = sanitizeRequestId(req.header('x-request-id'));

  const request = req as RequestWithContext;
  request.traceId = traceId;
  if (requestId !== undefined) {
    request.requestId = requestId;
  }

  // `X-Trace-Id` en TODA respuesta, no solo en los errores (`docs/api.md` §1.2).
  res.setHeader('X-Trace-Id', traceId);

  const context = requestId === undefined ? { traceId } : { traceId, requestId };
  runWithRequestContext(context, () => {
    next();
  });
}
