import request from 'supertest';
import { createApp } from '../../src/app';
import { db } from '../../src/database/connection';

// Requires the local MySQL container: npm run db:up
describe('health endpoints', () => {
  const app = createApp();

  afterAll(async () => {
    await db.destroy();
  });

  it('GET /health returns liveness without touching the database', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.status).toBe('ok');
  });

  it('GET /health responds with an X-Request-Id header', async () => {
    const res = await request(app).get('/health');

    expect(res.headers['x-request-id']).toBeDefined();
  });

  it('GET /health echoes a caller-supplied X-Request-Id', async () => {
    const res = await request(app).get('/health').set('X-Request-Id', 'trace-me-123');

    expect(res.headers['x-request-id']).toBe('trace-me-123');
  });

  it('GET /health/ready returns 200 when MySQL is reachable', async () => {
    const res = await request(app).get('/health/ready');

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ready');
  });

  it('unknown routes return the structured 404 envelope', async () => {
    const res = await request(app).get('/api/v1/nope');

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ status: 'error', code: 'ROUTE_NOT_FOUND' });
    expect(res.body.request_id).toBeDefined();
  });
});
