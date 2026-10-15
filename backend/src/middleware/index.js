/** Middleware: contexto de peticion, 404 y limitador de peticiones en memoria. */
import { randomUUID } from 'node:crypto';
import { config } from '../config.js';
import { AppError } from '../errors.js';
import { logger } from '../utils/logger.js';

/** Anade `req.context` (id y marca de tiempo) y registra la peticion al terminar. */
export const requestContext = (req, res, next) => {
  const requestId = req.get('x-request-id') ?? randomUUID();
  const startedAt = process.hrtime.bigint();
  req.context = { requestId, startedAt };

  res.setHeader('x-request-id', requestId);
  res.setHeader('x-demo-data', String(config.demo));

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    logger[level]('http_request', {
      requestId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Number(durationMs.toFixed(1)),
    });
  });

  next();
};

/** Limitador fijo por ventana deslizante simple, suficiente para una demo local. */
export const rateLimit = () => {
  const hits = new Map();

  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) {
      if (entry.resetAt <= now) hits.delete(key);
    }
  }, config.rateLimit.windowMs).unref();

  return (req, res, next) => {
    const key = req.ip ?? 'unknown';
    const now = Date.now();
    const entry = hits.get(key);

    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + config.rateLimit.windowMs });
      next();
      return;
    }

    entry.count += 1;
    res.setHeader('x-ratelimit-limit', String(config.rateLimit.max));
    res.setHeader('x-ratelimit-remaining', String(Math.max(0, config.rateLimit.max - entry.count)));

    if (entry.count > config.rateLimit.max) {
      next(new AppError(429, 'RATE_LIMITED', 'Demasiadas peticiones. Intenta de nuevo en unos segundos.'));
      return;
    }

    next();
  };
};

/** 404 en formato de error consistente. */
export const notFound = (req, _res, next) => {
  next(new AppError(404, 'NOT_FOUND', `No existe la ruta ${req.method} ${req.originalUrl}.`));
};

/**
 * Manejador central de errores: unico lugar donde se decide que ve el cliente.
 * Los errores no controlados se registran completos pero se responden en generico.
 */
export const errorHandler = (error, req, res, _next) => {
  const requestId = req.context?.requestId;
  const isKnown = error instanceof AppError;
  const status = isKnown ? error.status : 500;

  if (!isKnown) {
    logger.error('unhandled_error', {
      requestId,
      message: error?.message,
      stack: error?.stack,
    });
  }

  res.status(status).json({
    error: {
      code: isKnown ? error.code : 'INTERNAL_ERROR',
      message: isKnown
        ? error.message
        : 'Ocurrio un error inesperado en el servidor simulado.',
      details: isKnown ? error.details : undefined,
    },
    meta: {
      generatedAt: new Date().toISOString(),
      apiVersion: config.version,
      demo: config.demo,
      requestId,
    },
  });
};
