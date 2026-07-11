import express from 'express';
import request from 'supertest';
import { buildRateLimiter } from '../../src/middleware/rate-limiter';

function buildApp(limit: number) {
  const app = express();
  app.set('trust proxy', 1);
  app.get('/ping', buildRateLimiter({ windowMs: 60_000, limit }), (_req, res) => {
    res.json({ status: 'success', data: 'pong' });
  });
  return app;
}

describe('rate limiter', () => {
  it('allows requests within the limit', async () => {
    const app = buildApp(2);

    expect((await request(app).get('/ping')).status).toBe(200);
    expect((await request(app).get('/ping')).status).toBe(200);
  });

  it('rejects requests over the limit with the structured envelope', async () => {
    const app = buildApp(2);
    await request(app).get('/ping');
    await request(app).get('/ping');

    const res = await request(app).get('/ping');

    expect(res.status).toBe(429);
    expect(res.body).toMatchObject({ status: 'error', code: 'RATE_LIMITED' });
  });

  it('advertises the limit via standard draft headers', async () => {
    const app = buildApp(5);

    const res = await request(app).get('/ping');

    expect(res.headers['ratelimit-policy'] ?? res.headers['ratelimit-limit']).toBeDefined();
  });
});
