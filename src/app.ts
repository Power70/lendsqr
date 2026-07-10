import { randomUUID } from 'node:crypto';
import express from 'express';
import { pinoHttp } from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import { openApiDocument } from './docs/openapi';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { authRouter } from './modules/auth/auth.routes';
import { healthRouter } from './modules/health/health.routes';
import { usersRouter } from './modules/users/users.routes';
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
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));
  app.use('/api/v1/users', usersRouter);
  app.use('/api/v1/auth', authRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
