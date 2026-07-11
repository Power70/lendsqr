import type { Knex } from 'knex';
import { db } from '../../database/connection';
import { isDuplicateEntry } from '../../shared/utils/db-errors';
import type { IdempotencyRecord, ResponseSnapshot } from './idempotency.types';

export class IdempotencyRepository {
  constructor(private readonly db: Knex) {}

  // The unique (user, key, endpoint) constraint decides races between
  // concurrent identical requests: exactly one insert wins.
  async tryCreate(record: {
    id: string;
    userId: string;
    key: string;
    endpoint: string;
    requestHash: string;
  }): Promise<boolean> {
    try {
      await this.db('idempotency_keys').insert({
        id: record.id,
        user_id: record.userId,
        idempotency_key: record.key,
        endpoint: record.endpoint,
        status: 'processing',
        request_hash: record.requestHash,
      });
      return true;
    } catch (err) {
      if (isDuplicateEntry(err)) {
        return false;
      }
      throw err;
    }
  }

  findByScope(
    userId: string,
    key: string,
    endpoint: string,
  ): Promise<IdempotencyRecord | undefined> {
    return this.db<IdempotencyRecord>('idempotency_keys')
      .where({ user_id: userId, idempotency_key: key, endpoint })
      .first();
  }

  // Conditional updates: the WHERE clause makes takeovers race-safe —
  // whoever updates the row wins, everyone else backs off.
  async takeOverFailed(id: string, requestHash: string): Promise<boolean> {
    const updated = await this.db('idempotency_keys')
      .where({ id, status: 'failed' })
      .update({
        status: 'processing',
        request_hash: requestHash,
        response_snapshot: null,
        updated_at: this.db.fn.now(),
      });
    return updated === 1;
  }

  async takeOverStale(id: string, requestHash: string, staleBefore: Date): Promise<boolean> {
    const updated = await this.db('idempotency_keys')
      .where({ id, status: 'processing' })
      .andWhere('updated_at', '<', staleBefore)
      .update({ status: 'processing', request_hash: requestHash, updated_at: this.db.fn.now() });
    return updated === 1;
  }

  // Called inside the money transaction so completion commits atomically
  // with the ledger write — a crash can never leave a replayable success.
  async complete(
    params: { id: string; transactionId: string; snapshot: ResponseSnapshot },
    trx: Knex.Transaction,
  ): Promise<void> {
    await trx('idempotency_keys').where({ id: params.id }).update({
      status: 'completed',
      transaction_id: params.transactionId,
      response_snapshot: JSON.stringify(params.snapshot),
      updated_at: trx.fn.now(),
    });
  }

  async markFailedIfProcessing(id: string): Promise<void> {
    await this.db('idempotency_keys')
      .where({ id, status: 'processing' })
      .update({ status: 'failed', updated_at: this.db.fn.now() });
  }
}

export const idempotencyRepository = new IdempotencyRepository(db);
