import express from 'express';
import request from 'supertest';
import { errorHandler, notFoundHandler } from '../../src/middleware/error-handler';
import { AppError } from '../../src/shared/errors/app-error';
import { asyncHandler } from '../../src/shared/utils/async-handler';

// Minimal app exercising only the middleware under test — no logger/db wiring
function buildTestApp(): express.Express {
  const app = express();

  app.get('/operational', () => {
    throw AppError.unprocessable('INSUFFICIENT_FUNDS', 'Balance is too low for this transfer');
  });

  app.get(
    '/async-operational',
    asyncHandler(async () => {
      throw AppError.notFound('WALLET_NOT_FOUND', 'Wallet does not exist');
    }),
  );

  app.get('/unexpected', () => {
    throw new Error('secret internal detail: db password is hunter2');
  });

  app.get(
    '/async-unexpected',
    asyncHandler(async () => {
      throw new Error('async boom');
    }),
  );

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

describe('error handling middleware', () => {
  const app = buildTestApp();

  it('maps an operational AppError to its status, code and message', async () => {
    const res = await request(app).get('/operational');

    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({
      status: 'error',
      code: 'INSUFFICIENT_FUNDS',
      message: 'Balance is too low for this transfer',
    });
  });

  it('forwards rejected async handlers through asyncHandler', async () => {
    const res = await request(app).get('/async-operational');

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('WALLET_NOT_FOUND');
  });

  it('returns an opaque 500 for unexpected errors without leaking internals', async () => {
    const res = await request(app).get('/unexpected');

    expect(res.status).toBe(500);
    expect(res.body.code).toBe('INTERNAL_SERVER_ERROR');
    expect(JSON.stringify(res.body)).not.toContain('hunter2');
    expect(JSON.stringify(res.body)).not.toContain('secret internal detail');
  });

  it('returns an opaque 500 for unexpected async errors', async () => {
    const res = await request(app).get('/async-unexpected');

    expect(res.status).toBe(500);
    expect(res.body.code).toBe('INTERNAL_SERVER_ERROR');
    expect(JSON.stringify(res.body)).not.toContain('async boom');
  });

  it('returns a structured 404 envelope for unknown routes', async () => {
    const res = await request(app).get('/no/such/route');

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ status: 'error', code: 'ROUTE_NOT_FOUND' });
  });
});
