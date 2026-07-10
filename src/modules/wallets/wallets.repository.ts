import type { Knex } from 'knex';
import { db } from '../../database/connection';
import type { WalletRecord } from './wallets.types';

export class WalletRepository {
  constructor(private readonly db: Knex) {}

  findByUserId(userId: string): Promise<WalletRecord | undefined> {
    return this.db<WalletRecord>('wallets').where({ user_id: userId }).first();
  }

  async create(wallet: { id: string; user_id: string }, trx: Knex.Transaction): Promise<void> {
    await trx('wallets').insert(wallet);
  }
}

export const walletsRepository = new WalletRepository(db);
