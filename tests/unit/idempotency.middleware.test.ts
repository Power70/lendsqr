import express from 'express';
import request from 'supertest';
import { errorHandler } from '../../src/middleware/error-handler';
import { createIdempotency } from '../../src/middleware/idempotency';
import type { IdempotencyRepository } from '../../src/modules/idempotency/idempotency.repository';
import { hashRequestBody } from '../../src/shared/utils/request-hash';

const KEY = 'a1b2c3d4-e5f6-7890';
const BODY = { amount: 5000 };
const HASH = hashRequestBody(BODY);

function buildRepo(overrides: Partial<Record<keyof IdempotencyRepository, jest.Mock>> = {}) {
  return {
    tryCreate: jest.fn().mockResolvedValue(true),
    findByScope: jest.fn().mockResolvedValue(undefined),
    takeOverFailed: jest.fn().mockResolvedValue(true),
    takeOverStale: jest.fn().mockResolvedValue(true),
    markFailedIfProcessing: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function buildApp(repo: ReturnType<typeof buildRepo>, handlerShouldFail = false) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { id: 'user-1', status: 'active' };
    next();
  });
  app.post('/pay', createIdempotency(repo as never, 'test:pay'), (req, res) => {
    if (handlerShouldFail) {
      throw new Error('handler exploded');
    }
    res.status(201).json({ status: 'success', data: { record_id: req.idempotency?.recordId } });
  });
  app.use(errorHandler);
  return app;
}

const post = (app: express.Express, key: string | null = KEY, body: unknown = BODY) => {
  const req = request(app).post('/pay').send(body as object);
  return key === null ? req : req.set('Idempotency-Key', key);
};

const existingRecord = (overrides: Record<string, unknown> = {}) => ({
  id: 'record-1',
  user_id: 'user-1',
  idempotency_key: KEY,
  endpoint: 'test:pay',
  status: 'processing',
  request_hash: HASH,
  response_snapshot: null,
  transaction_id: null,
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides,
});

describe('idempotency middleware', () => {
  it('rejects a request without an Idempotency-Key header', async () => {
    const repo = buildRepo();

    const res = await post(buildApp(repo), null);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('MISSING_IDEMPOTENCY_KEY');
    expect(repo.tryCreate).not.toHaveBeenCalled();
  });

  it('rejects a malformed key', async () => {
    const res = await post(buildApp(buildRepo()), 'short');

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('MISSING_IDEMPOTENCY_KEY');
  });

  it('lets a fresh key through and exposes the record id', async () => {
    const repo = buildRepo();

    const res = await post(buildApp(repo));

    expect(res.status).toBe(201);
    expect(res.body.data.record_id).toBeDefined();
    expect(repo.tryCreate).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', key: KEY, endpoint: 'test:pay', requestHash: HASH }),
    );
  });

  it('replays the stored response for a completed key with the same body', async () => {
    const snapshot = { status_code: 201, body: { status: 'success', data: { reference: 'TXN-1' } } };
    const repo = buildRepo({
      tryCreate: jest.fn().mockResolvedValue(false),
      findByScope: jest
        .fn()
        .mockResolvedValue(existingRecord({ status: 'completed', response_snapshot: snapshot })),
    });

    const res = await post(buildApp(repo));

    expect(res.status).toBe(201);
    expect(res.headers['x-idempotent-replay']).toBe('true');
    expect(res.body.data.reference).toBe('TXN-1');
  });

  it('rejects a completed key replayed with a different body', async () => {
    const repo = buildRepo({
      tryCreate: jest.fn().mockResolvedValue(false),
      findByScope: jest.fn().mockResolvedValue(existingRecord({ status: 'completed' })),
    });

    const res = await post(buildApp(repo), KEY, { amount: 9999 });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('IDEMPOTENCY_KEY_REUSED');
  });

  it('rejects while the original request is still in flight', async () => {
    const repo = buildRepo({
      tryCreate: jest.fn().mockResolvedValue(false),
      findByScope: jest.fn().mockResolvedValue(existingRecord()),
    });

    const res = await post(buildApp(repo));

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('REQUEST_IN_FLIGHT');
  });

  it('rejects an in-flight key sent with a different body', async () => {
    const repo = buildRepo({
      tryCreate: jest.fn().mockResolvedValue(false),
      findByScope: jest.fn().mockResolvedValue(existingRecord()),
    });

    const res = await post(buildApp(repo), KEY, { amount: 9999 });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('IDEMPOTENCY_KEY_REUSED');
  });

  it('takes over a stale processing row from a crashed request', async () => {
    const repo = buildRepo({
      tryCreate: jest.fn().mockResolvedValue(false),
      findByScope: jest
        .fn()
        .mockResolvedValue(existingRecord({ updated_at: new Date(Date.now() - 120_000) })),
    });

    const res = await post(buildApp(repo));

    expect(res.status).toBe(201);
    expect(repo.takeOverStale).toHaveBeenCalled();
  });

  it('lets a failed key be retried, even with a corrected body', async () => {
    const repo = buildRepo({
      tryCreate: jest.fn().mockResolvedValue(false),
      findByScope: jest.fn().mockResolvedValue(existingRecord({ status: 'failed' })),
    });

    const res = await post(buildApp(repo), KEY, { amount: 9999 });

    expect(res.status).toBe(201);
    expect(repo.takeOverFailed).toHaveBeenCalledWith('record-1', hashRequestBody({ amount: 9999 }));
  });

  it('loses the takeover race gracefully', async () => {
    const repo = buildRepo({
      tryCreate: jest.fn().mockResolvedValue(false),
      findByScope: jest.fn().mockResolvedValue(existingRecord({ status: 'failed' })),
      takeOverFailed: jest.fn().mockResolvedValue(false),
    });

    const res = await post(buildApp(repo));

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('REQUEST_IN_FLIGHT');
  });

  it('releases the key as failed when the handler errors', async () => {
    const repo = buildRepo();

    const res = await post(buildApp(repo, true));
    await new Promise((resolve) => setImmediate(resolve));

    expect(res.status).toBe(500);
    expect(repo.markFailedIfProcessing).toHaveBeenCalled();
  });
});
