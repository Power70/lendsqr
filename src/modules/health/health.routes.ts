import { Router } from 'express';
import { db } from '../../database/connection';
import { AppError } from '../../shared/errors/app-error';
import { asyncHandler } from '../../shared/utils/async-handler';

export const healthRouter = Router();

// Liveness: the process is up and serving requests
healthRouter.get('/health', (_req, res) => {
  res.json({
    status: 'success',
    data: {
      service: 'demo-credit-api',
      status: 'ok',
      uptime_seconds: Math.round(process.uptime()),
    },
  });
});

// Readiness: the process can reach its dependencies (MySQL)
healthRouter.get(
  '/health/ready',
  asyncHandler(async (_req, res) => {
    try {
      await db.raw('SELECT 1');
    } catch {
      throw AppError.serviceUnavailable('DATABASE_UNREACHABLE', 'Database connection failed');
    }
    res.json({ status: 'success', data: { status: 'ready' } });
  }),
);
