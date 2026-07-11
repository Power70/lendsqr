import { randomUUID } from 'node:crypto';
import type { RequestHandler, Response } from 'express';
import {
  idempotencyRepository,
  type IdempotencyRepository,
} from '../modules/idempotency/idempotency.repository';
import { AppError } from '../shared/errors/app-error';
import { logger } from '../shared/logger/logger';
import { asyncHandler } from '../shared/utils/async-handler';
import { hashRequestBody } from '../shared/utils/request-hash';

const KEY_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

// A row stuck in `processing` past this age belongs to a crashed request;
// the next retry may take it over instead of being locked out forever.
const STALE_PROCESSING_MS = 60_000;

export function createIdempotency(
  repository: IdempotencyRepository,
  endpoint: string,
): RequestHandler {
  return asyncHandler(async (req, res, next) => {
    if (!req.user) {
      throw new AppError(500, 'IDEMPOTENCY_REQUIRES_AUTH', 'authenticate must run first', false);
    }

    const key = req.get('Idempotency-Key');
    if (!key || !KEY_PATTERN.test(key)) {
      throw AppError.badRequest(
        'MISSING_IDEMPOTENCY_KEY',
        'An Idempotency-Key header of 8-64 url-safe characters is required',
      );
    }
    const requestHash = hashRequestBody(req.body);

    const recordId = randomUUID();
    const created = await repository.tryCreate({
      id: recordId,
      userId: req.user.id,
      key,
      endpoint,
      requestHash,
    });
    if (created) {
      proceed(req, res, repository, recordId, next);
      return;
    }

    const existing = await repository.findByScope(req.user.id, key, endpoint);
    if (!existing) {
      throw inFlight();
    }

    if (existing.status === 'completed') {
      if (existing.request_hash !== requestHash) {
        throw keyReused();
      }
      replay(res, existing.response_snapshot);
      return;
    }

    if (existing.status === 'failed') {
      if (await repository.takeOverFailed(existing.id, requestHash)) {
        proceed(req, res, repository, existing.id, next);
        return;
      }
      throw inFlight();
    }

    if (existing.request_hash !== requestHash) {
      throw keyReused();
    }
    const staleBefore = new Date(Date.now() - STALE_PROCESSING_MS);
    if (
      new Date(existing.updated_at) < staleBefore &&
      (await repository.takeOverStale(existing.id, requestHash, staleBefore))
    ) {
      proceed(req, res, repository, existing.id, next);
      return;
    }
    throw inFlight();
  });
}

function proceed(
  req: Parameters<RequestHandler>[0],
  res: Response,
  repository: IdempotencyRepository,
  recordId: string,
  next: Parameters<RequestHandler>[2],
): void {
  req.idempotency = { recordId };
  // Success paths complete the row inside their DB transaction; anything
  // still `processing` when the response ends is a failure to release.
  res.on('finish', () => {
    repository.markFailedIfProcessing(recordId).catch((err: unknown) => {
      logger.error({ err, idempotency_record_id: recordId }, 'failed to release idempotency key');
    });
  });
  next();
}

function replay(res: Response, snapshot: { status_code: number; body: unknown } | null): void {
  if (!snapshot) {
    throw inFlight();
  }
  res.setHeader('X-Idempotent-Replay', 'true');
  res.status(snapshot.status_code).json(snapshot.body);
}

const keyReused = (): AppError =>
  AppError.conflict(
    'IDEMPOTENCY_KEY_REUSED',
    'This Idempotency-Key was already used with a different request body',
  );

const inFlight = (): AppError =>
  AppError.conflict('REQUEST_IN_FLIGHT', 'This request is already being processed. Retry shortly.');

export const idempotency = (endpoint: string): RequestHandler =>
  createIdempotency(idempotencyRepository, endpoint);
