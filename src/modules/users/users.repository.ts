import type { Knex } from 'knex';
import { db } from '../../database/connection';
import type { NewUserRow, UserRecord, UserRole, UserStatus } from './users.types';

// Filters shared by `list` and `count` so a page and its total always agree.
export interface UserListFilters {
  status?: UserStatus;
  role?: UserRole;
  search?: string;
}

export interface UserListOptions extends UserListFilters {
  limit: number;
  offset: number;
}

export class UserRepository {
  constructor(private readonly db: Knex) {}

  findById(id: string): Promise<UserRecord | undefined> {
    return this.db<UserRecord>('users').where({ id }).first();
  }

  // Row lock so an admin status change reads and writes under the same lock,
  // and cannot race a concurrent update of the same account.
  findByIdForUpdate(id: string, trx: Knex.Transaction): Promise<UserRecord | undefined> {
    return trx<UserRecord>('users').where({ id }).forUpdate().first();
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

  async updateStatus(id: string, status: UserStatus, trx: Knex.Transaction): Promise<void> {
    await trx('users').where({ id }).update({ status, updated_at: trx.fn.now() });
  }

  // Newest-first admin listing. Offset pagination is acceptable here: this is a
  // low-traffic oversight surface where page numbers matter more than the
  // insert-stability the customer-facing statement needs.
  list(options: UserListOptions): Promise<UserRecord[]> {
    return this.applyFilters(this.db<UserRecord>('users'), options)
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
      .limit(options.limit)
      .offset(options.offset);
  }

  async count(filters: UserListFilters): Promise<number> {
    const [row] = await this.applyFilters(this.db('users'), filters).count<{ n: number }[]>(
      'id as n',
    );
    return Number(row?.n ?? 0);
  }

  // One place that translates filters into WHERE clauses, so list and count
  // can never drift apart.
  private applyFilters(query: Knex.QueryBuilder, filters: UserListFilters): Knex.QueryBuilder {
    if (filters.status) {
      void query.where('status', filters.status);
    }
    if (filters.role) {
      void query.where('role', filters.role);
    }
    if (filters.search) {
      const term = `%${filters.search}%`;
      void query.where((qb) => qb.whereLike('email', term).orWhereLike('phone', term));
    }
    return query;
  }
}

export const usersRepository = new UserRepository(db);
