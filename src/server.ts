import { createApp } from './app';
import { env } from './config/env';
import { db } from './database/connection';
import { logger } from './shared/logger/logger';

const SHUTDOWN_TIMEOUT_MS = 10_000;

const app = createApp();
const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'demo-credit-api listening');
});

// Stop accepting new connections, drain in-flight requests, then release the
// DB pool; force-exit if draining exceeds the platform's grace period.
function shutdown(signal: string): void {
  logger.info({ signal }, 'shutting down');

  const forceExit = setTimeout(() => {
    logger.error('shutdown timed out — forcing exit');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceExit.unref();

  server.close((closeErr) => {
    void (async () => {
      if (closeErr) {
        logger.error({ err: closeErr }, 'error closing http server');
      }
      await db.destroy();
      logger.info('shutdown complete');
      process.exit(closeErr ? 1 : 0);
    })();
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// A process in an unknown state must not keep handling money operations
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'uncaught exception');
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  logger.fatal({ err: reason }, 'unhandled rejection');
  process.exit(1);
});
