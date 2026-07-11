import type { Knex } from 'knex';
import { db } from '../../database/connection';
import type {
  EntryDirection,
  StatementItem,
  TransactionStatus,
  TransactionType,
} from './transactions.types';

interface NewTransactionRow {
  id: string;
  reference: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: number;
  narration: string | null;
  metadata: string | null;
}

interface NewEntryRow {
  transaction_id: string;
  wallet_id: string | null;
  direction: EntryDirection;
  amount: number;
  balance_after: number | null;
}

const STATEMENT_COLUMNS = [
  'e.id as entry_id',
  't.reference',
  't.type',
  't.status',
  'e.direction',
  'e.amount',
  'e.balance_after',
  't.narration',
  'e.created_at',
];

export class TransactionRepository {
  constructor(private readonly db: Knex) {}

  async createTransaction(row: NewTransactionRow, trx: Knex.Transaction): Promise<void> {
    await trx('transactions').insert(row);
  }

  async createEntries(rows: NewEntryRow[], trx: Knex.Transaction): Promise<void> {
    await trx('transaction_entries').insert(rows);
  }

  // Keyset pagination on the entry id — stable under concurrent inserts,
  // unlike offset pagination
  listStatement(
    walletId: string,
    options: { limit: number; beforeEntryId?: number },
  ): Promise<StatementItem[]> {
    const query = this.db('transaction_entries as e')
      .join('transactions as t', 't.id', 'e.transaction_id')
      .where('e.wallet_id', walletId)
      .orderBy('e.id', 'desc')
      .limit(options.limit)
      .select(STATEMENT_COLUMNS);
    if (options.beforeEntryId !== undefined) {
      void query.andWhere('e.id', '<', options.beforeEntryId);
    }
    return query;
  }

  findStatementItemByReference(
    reference: string,
    walletId: string,
  ): Promise<StatementItem | undefined> {
    return this.db('transaction_entries as e')
      .join('transactions as t', 't.id', 'e.transaction_id')
      .where({ 't.reference': reference, 'e.wallet_id': walletId })
      .select(STATEMENT_COLUMNS)
      .first();
  }
}

export const transactionsRepository = new TransactionRepository(db);
