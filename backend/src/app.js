/**
 * Construccion de la aplicacion Express.
 * Se separa de `server.js` para que las pruebas puedan crear la app sin abrir un
 * puerto fijo ni depender del arranque real.
 */
import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { AppError } from './errors.js';
import { errorHandler, notFound, rateLimit, requestContext } from './middleware/index.js';
import { apiRouter, describeApi } from './routes/index.js';

export const createApp = () => {
  const app = express();

  // No revelamos la tecnologia del servidor.
  app.disable('x-powered-by');
  // Necesario para que `req.ip` sea fiable detras de un proxy local.
  app.set('trust proxy', true);

  app.use(
    cors({
      origin: (origin, callback) => {
        // Sin origen (curl, health checks, misma maquina) siempre permitido.
        if (!origin || config.corsOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(
          new AppError(403, 'CORS_REJECTED', `Origen no permitido por CORS: ${origin}`, {
            allowedOrigins: config.corsOrigins,
          }),
        );
      },
      methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Accept', 'x-request-id'],
      exposedHeaders: ['x-request-id', 'x-demo-data', 'x-poll-interval-ms'],
      maxAge: 600,
    }),
  );

  app.use(express.json({ limit: '128kb' }));
  app.use(express.urlencoded({ extended: false, limit: '128kb' }));
  app.use(requestContext);
  app.use(rateLimit());

  // Indice de la API en la raiz, util al abrir http://localhost:3000
  app.get('/', (_req, res) => {
    res.json({
      data: describeApi(),
      meta: { generatedAt: new Date().toISOString(), demo: config.demo, apiVersion: config.version },
    });
  });

  app.get('/favicon.ico', (_req, res) => res.status(204).end());

  app.use(config.apiPrefix, apiRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
};
