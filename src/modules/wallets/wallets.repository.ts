import type { Knex } from 'knex';
import { db } from '../../database/connection';
import type { WalletRecord } from './wallets.types';

export class WalletRepository {
  constructor(private readonly db: Knex) {}

  findByUserId(userId: string): Promise<WalletRecord | undefined> {
    return this.db<WalletRecord>('wallets').where({ user_id: userId }).first();
  }

  // Row lock: concurrent operations on the same wallet serialise here,
  // so balance checks and updates under the lock cannot race
  findByUserIdForUpdate(userId: string, trx: Knex.Transaction): Promise<WalletRecord | undefined> {
    return trx<WalletRecord>('wallets').where({ user_id: userId }).forUpdate().first();
  }

  // Ascending-id lock order makes deadlocks between crossing transfers
  // (A→B racing B→A) impossible: both requests queue on the same first row
  findManyByIdsForUpdate(ids: string[], trx: Knex.Transaction): Promise<WalletRecord[]> {
    return trx<WalletRecord>('wallets').whereIn('id', ids).orderBy('id').forUpdate();
  }

  async updateBalance(walletId: string, balance: number, trx: Knex.Transaction): Promise<void> {
    await trx('wallets').where({ id: walletId }).update({ balance, updated_at: trx.fn.now() });
  }

  async create(wallet: { id: string; user_id: string }, trx: Knex.Transaction): Promise<void> {
    await trx('wallets').insert(wallet);
  }
}

export const walletsRepository = new WalletRepository(db);
