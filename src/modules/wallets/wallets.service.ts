import type { Knex } from 'knex';
import type { TransactionRunner } from '../../database/with-transaction';
import { AppError } from '../../shared/errors/app-error';
import { success } from '../../shared/utils/api-response';
import type { IdempotencyRepository } from '../idempotency/idempotency.repository';
import type { LedgerService } from '../transactions/ledger.service';
import type { WalletRecord } from './wallets.types';
import type { WalletRepository } from './wallets.repository';

export interface MoneyOperationResult {
  reference: string;
  amount: number;
  balance_after: number;
}

export class WalletsService {
  constructor(
    private readonly runTransaction: TransactionRunner,
    private readonly walletsRepository: WalletRepository,
    private readonly ledgerService: LedgerService,
    private readonly idempotencyRepository: IdempotencyRepository,
  ) {}

  async getForUser(userId: string): Promise<WalletRecord> {
    const wallet = await this.walletsRepository.findByUserId(userId);
    if (!wallet) {
      throw AppError.notFound('WALLET_NOT_FOUND', 'Wallet does not exist');
    }
    return wallet;
  }

  async fund(params: {
    userId: string;
    amount: number;
    narration?: string;
    idempotencyRecordId: string;
  }): Promise<MoneyOperationResult> {
    return this.runTransaction(async (trx) => {
      const wallet = await this.lockActiveWallet(params.userId, trx);

      const balanceAfter = wallet.balance + params.amount;
      const { transactionId, reference } = await this.ledgerService.record(
        {
          type: 'FUNDING',
          amount: params.amount,
          narration: params.narration,
          entries: [
            {
              walletId: wallet.id,
              direction: 'CREDIT',
              amount: params.amount,
              balanceAfter,
            },
            { walletId: null, direction: 'DEBIT', amount: params.amount, balanceAfter: null },
          ],
        },
        trx,
      );
      await this.walletsRepository.updateBalance(wallet.id, balanceAfter, trx);

      const result: MoneyOperationResult = {
        reference,
        amount: params.amount,
        balance_after: balanceAfter,
      };
      // Same transaction as the ledger write: a replayable success can only
      // exist if the money movement actually committed
      await this.idempotencyRepository.complete(
        {
          id: params.idempotencyRecordId,
          transactionId,
          snapshot: { status_code: 201, body: success(result) },
        },
        trx,
      );
      return result;
    });
  }

  async withdraw(params: {
    userId: string;
    amount: number;
    bankCode: string;
    accountNumber: string;
    narration?: string;
    idempotencyRecordId: string;
  }): Promise<MoneyOperationResult> {
    return this.runTransaction(async (trx) => {
      const wallet = await this.lockActiveWallet(params.userId, trx);
      if (wallet.balance < params.amount) {
        throw AppError.unprocessable('INSUFFICIENT_FUNDS', 'Wallet balance is too low');
      }

      const balanceAfter = wallet.balance - params.amount;
      const { transactionId, reference } = await this.ledgerService.record(
        {
          type: 'WITHDRAWAL',
          amount: params.amount,
          narration: params.narration,
          // Last four digits only — full account numbers stay out of the ledger
          metadata: {
            destination: {
              bank_code: params.bankCode,
              account_last4: params.accountNumber.slice(-4),
            },
          },
          entries: [
            { walletId: wallet.id, direction: 'DEBIT', amount: params.amount, balanceAfter },
            { walletId: null, direction: 'CREDIT', amount: params.amount, balanceAfter: null },
          ],
        },
        trx,
      );
      await this.walletsRepository.updateBalance(wallet.id, balanceAfter, trx);

      const result: MoneyOperationResult = {
        reference,
        amount: params.amount,
        balance_after: balanceAfter,
      };
      await this.idempotencyRepository.complete(
        {
          id: params.idempotencyRecordId,
          transactionId,
          snapshot: { status_code: 201, body: success(result) },
        },
        trx,
      );
      return result;
    });
  }

  private async lockActiveWallet(userId: string, trx: Knex.Transaction): Promise<WalletRecord> {
    const wallet = await this.walletsRepository.findByUserIdForUpdate(userId, trx);
    if (!wallet) {
      throw AppError.notFound('WALLET_NOT_FOUND', 'Wallet does not exist');
    }
    if (wallet.status !== 'active') {
      throw AppError.unprocessable('WALLET_NOT_ACTIVE', 'This wallet is not active');
    }
    return wallet;
  }
}
