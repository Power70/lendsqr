import type { Knex } from 'knex';
import type { EntryDirection, TransactionStatus, TransactionType } from './transactions.types';

interface NewTransactionRow {
  id: string;
  reference: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: number;
  narration: string | null;
}

interface NewEntryRow {
  transaction_id: string;
  wallet_id: string | null;
  direction: EntryDirection;
  amount: number;
  balance_after: number | null;
}

export class TransactionRepository {
  async createTransaction(row: NewTransactionRow, trx: Knex.Transaction): Promise<void> {
    await trx('transactions').insert(row);
  }

  async createEntries(rows: NewEntryRow[], trx: Knex.Transaction): Promise<void> {
    await trx('transaction_entries').insert(rows);
  }
}

export const transactionsRepository = new TransactionRepository();
