import type { TransactionRunner } from '../../database/with-transaction';
import { AppError } from '../../shared/errors/app-error';
import { success } from '../../shared/utils/api-response';
import type { IdempotencyRepository } from '../idempotency/idempotency.repository';
import type { WalletRepository } from '../wallets/wallets.repository';
import type { LedgerService } from './ledger.service';

export interface TransferResult {
  reference: string;
  amount: number;
  balance_after: number;
  recipient_wallet_id: string;
}

export class TransferService {
  constructor(
    private readonly runTransaction: TransactionRunner,
    private readonly walletsRepository: WalletRepository,
    private readonly ledgerService: LedgerService,
    private readonly idempotencyRepository: IdempotencyRepository,
  ) {}

  async transfer(params: {
    userId: string;
    recipientWalletId: string;
    amount: number;
    narration?: string;
    idempotencyRecordId: string;
  }): Promise<TransferResult> {
    return this.runTransaction(async (trx) => {
      const senderWallet = await this.walletsRepository.findByUserId(params.userId);
      if (!senderWallet) {
        throw AppError.notFound('WALLET_NOT_FOUND', 'Wallet does not exist');
      }
      if (senderWallet.id === params.recipientWalletId) {
        throw AppError.unprocessable('SELF_TRANSFER', 'Cannot transfer to your own wallet');
      }

      const locked = await this.walletsRepository.findManyByIdsForUpdate(
        [senderWallet.id, params.recipientWalletId],
        trx,
      );
      const sender = locked.find((w) => w.id === senderWallet.id);
      const recipient = locked.find((w) => w.id === params.recipientWalletId);
      if (!sender) {
        throw AppError.notFound('WALLET_NOT_FOUND', 'Wallet does not exist');
      }
      if (!recipient) {
        throw AppError.notFound('RECIPIENT_NOT_FOUND', 'Recipient wallet does not exist');
      }
      if (sender.status !== 'active') {
        throw AppError.unprocessable('WALLET_NOT_ACTIVE', 'This wallet cannot send funds');
      }
      if (recipient.status !== 'active') {
        throw AppError.unprocessable(
          'RECIPIENT_NOT_ACTIVE',
          'Recipient wallet cannot receive funds',
        );
      }
      // Checked under the row lock — a concurrent spend cannot slip between
      // this read and the balance update below
      if (sender.balance < params.amount) {
        throw AppError.unprocessable('INSUFFICIENT_FUNDS', 'Wallet balance is too low');
      }

      const senderBalanceAfter = sender.balance - params.amount;
      const recipientBalanceAfter = recipient.balance + params.amount;
      const { transactionId, reference } = await this.ledgerService.record(
        {
          type: 'TRANSFER',
          amount: params.amount,
          narration: params.narration,
          entries: [
            {
              walletId: sender.id,
              direction: 'DEBIT',
              amount: params.amount,
              balanceAfter: senderBalanceAfter,
            },
            {
              walletId: recipient.id,
              direction: 'CREDIT',
              amount: params.amount,
              balanceAfter: recipientBalanceAfter,
            },
          ],
        },
        trx,
      );
      await this.walletsRepository.updateBalance(sender.id, senderBalanceAfter, trx);
      await this.walletsRepository.updateBalance(recipient.id, recipientBalanceAfter, trx);

      const result: TransferResult = {
        reference,
        amount: params.amount,
        balance_after: senderBalanceAfter,
        recipient_wallet_id: recipient.id,
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
}
