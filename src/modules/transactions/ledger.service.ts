import { randomUUID } from 'node:crypto';
import type { Knex } from 'knex';
import { AppError } from '../../shared/errors/app-error';
import { generateReference } from '../../shared/utils/reference';
import { transactionsRepository, type TransactionRepository } from './transactions.repository';
import type { LedgerPosting } from './transactions.types';

// Single writer for the ledger: every money movement becomes one immutable
// header plus balanced DEBIT/CREDIT lines, inside the caller's transaction.
export class LedgerService {
  constructor(private readonly transactionsRepository: TransactionRepository) {}

  async record(
    posting: LedgerPosting,
    trx: Knex.Transaction,
  ): Promise<{ transactionId: string; reference: string }> {
    this.assertBalanced(posting);

    const transactionId = randomUUID();
    const reference = generateReference();

    await this.transactionsRepository.createTransaction(
      {
        id: transactionId,
        reference,
        type: posting.type,
        status: 'SUCCESS',
        amount: posting.amount,
        narration: posting.narration ?? null,
        metadata: posting.metadata ? JSON.stringify(posting.metadata) : null,
      },
      trx,
    );
    await this.transactionsRepository.createEntries(
      posting.entries.map((entry) => ({
        transaction_id: transactionId,
        wallet_id: entry.walletId,
        direction: entry.direction,
        amount: entry.amount,
        balance_after: entry.balanceAfter,
      })),
      trx,
    );

    return { transactionId, reference };
  }

  // An unbalanced posting is a programming bug, never client input —
  // surfaced as a non-operational error so it pages instead of replying 4xx
  private assertBalanced(posting: LedgerPosting): void {
    const invariant = (condition: boolean, message: string): void => {
      if (!condition) {
        throw new AppError(500, 'LEDGER_INVARIANT_VIOLATION', message, false);
      }
    };

    invariant(posting.entries.length >= 2, 'a posting needs at least two entries');
    invariant(
      Number.isSafeInteger(posting.amount) && posting.amount > 0,
      'amount must be a positive integer',
    );
    invariant(
      posting.entries.every((e) => Number.isSafeInteger(e.amount) && e.amount > 0),
      'every entry amount must be a positive integer',
    );

    const total = (direction: 'DEBIT' | 'CREDIT'): number =>
      posting.entries
        .filter((e) => e.direction === direction)
        .reduce((sum, e) => sum + e.amount, 0);
    const debits = total('DEBIT');
    const credits = total('CREDIT');

    invariant(debits === credits, 'debits and credits must balance');
    invariant(debits === posting.amount, 'entry totals must equal the posting amount');
  }
}

export const ledgerService = new LedgerService(transactionsRepository);
