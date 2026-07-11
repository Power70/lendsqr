import { randomUUID } from 'node:crypto';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import { openApiDocument } from './docs/openapi';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { apiRateLimiter, authRateLimiter } from './middleware/rate-limiter';
import { authRouter } from './modules/auth/auth.routes';
import { healthRouter } from './modules/health/health.routes';
import { transactionsRouter } from './modules/transactions/transactions.routes';
import { usersRouter } from './modules/users/users.routes';
import { walletsRouter } from './modules/wallets/wallets.routes';
import { logger } from './shared/logger/logger';

// App wiring only — no .listen() here, so tests can drive it via supertest
export function createApp(): express.Express {
  const app = express();

  app.disable('x-powered-by');
  // Platform (Heroku/Render) terminates TLS in front of us
  app.set('trust proxy', 1);

  // CSP is off: this is a JSON API, and the default policy breaks the
  // swagger-ui assets. Every other helmet header still applies.
  app.use(helmet({ contentSecurityPolicy: false }));

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

  app.use('/api', apiRateLimiter);
  // Signup and login carry credentials — brute force gets the tight bucket
  app.use('/api/v1/users', authRateLimiter, usersRouter);
  app.use('/api/v1/auth', authRateLimiter, authRouter);
  app.use('/api/v1/wallets', walletsRouter);
  app.use('/api/v1/transactions', transactionsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
