import type { RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import { env } from '../config/env';

export function buildRateLimiter(options: { windowMs: number; limit: number }): RequestHandler {
  return rateLimit({
    windowMs: options.windowMs,
    limit: options.limit,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        status: 'error',
        code: 'RATE_LIMITED',
        message: 'Too many requests. Try again shortly.',
        ...(req.id !== undefined && { request_id: String(req.id) }),
      });
    },
  });
}

export const apiRateLimiter = buildRateLimiter({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.RATE_LIMIT_MAX,
});

// Credential endpoints get a far smaller budget — brute force protection,
// not throughput management
const AUTH_ATTEMPTS_PER_WINDOW = 10;

export const authRateLimiter = buildRateLimiter({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: AUTH_ATTEMPTS_PER_WINDOW,
});
