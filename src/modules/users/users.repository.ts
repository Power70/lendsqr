import type { Knex } from 'knex';
import { db } from '../../database/connection';
import type { NewUserRow, UserRecord } from './users.types';

export class UserRepository {
  constructor(private readonly db: Knex) {}

  findById(id: string): Promise<UserRecord | undefined> {
    return this.db<UserRecord>('users').where({ id }).first();
  }

  findByEmail(email: string): Promise<UserRecord | undefined> {
    return this.db<UserRecord>('users').where({ email }).first();
  }

  findByAnyIdentity(email: string, phone: string, bvn: string): Promise<UserRecord | undefined> {
    return this.db<UserRecord>('users')
      .where({ email })
      .orWhere({ phone })
      .orWhere({ bvn })
      .first();
  }

  async create(user: NewUserRow, trx: Knex.Transaction): Promise<void> {
    await trx('users').insert(user);
  }
}

export const usersRepository = new UserRepository(db);
