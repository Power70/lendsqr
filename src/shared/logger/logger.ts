import pino from 'pino';
import { env } from '../../config/env';

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: ['req.headers.authorization', '*.password', '*.password_hash'],
    censor: '[REDACTED]',
  },
});
