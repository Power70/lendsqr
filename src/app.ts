import { randomUUID } from 'node:crypto';
import express from 'express';
import { pinoHttp } from 'pino-http';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { healthRouter } from './modules/health/health.routes';
import { logger } from './shared/logger/logger';

// App wiring only — no .listen() here, so tests can drive it via supertest
export function createApp(): express.Express {
  const app = express();

  app.disable('x-powered-by');
  // Platform (Heroku/Render) terminates TLS in front of us
  app.set('trust proxy', 1);

  app.use(
    pinoHttp({
      logger,
      genReqId: (req, res) => {
        const requestId = (req.headers['x-request-id'] as string | undefined) ?? randomUUID();
        res.setHeader('X-Request-Id', requestId);
        return requestId;
      },
      autoLogging: {
        ignore: (req) => req.url === '/health',
      },
    }),
  );

  app.use(express.json({ limit: '100kb' }));

  app.use(healthRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
