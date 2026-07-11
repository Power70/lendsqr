import { AppError } from '../../shared/errors/app-error';
import type { WalletRepository } from '../wallets/wallets.repository';
import type { TransactionRepository } from './transactions.repository';
import type { StatementItem } from './transactions.types';

export interface StatementPage {
  items: StatementItem[];
  next_cursor: number | null;
}

export class TransactionsService {
  constructor(
    private readonly transactionsRepository: TransactionRepository,
    private readonly walletsRepository: WalletRepository,
  ) {}

  async listForUser(
    userId: string,
    options: { limit: number; cursor?: number },
  ): Promise<StatementPage> {
    const wallet = await this.requireWallet(userId);

    // One extra row decides whether another page exists without a COUNT query
    const rows = await this.transactionsRepository.listStatement(wallet.id, {
      limit: options.limit + 1,
      beforeEntryId: options.cursor,
    });
    const items = rows.slice(0, options.limit);
    const lastItem = items[items.length - 1];
    return {
      items,
      next_cursor: rows.length > options.limit && lastItem ? lastItem.entry_id : null,
    };
  }

  async getByReferenceForUser(userId: string, reference: string): Promise<StatementItem> {
    const wallet = await this.requireWallet(userId);

    const item = await this.transactionsRepository.findStatementItemByReference(
      reference,
      wallet.id,
    );
    // Same 404 whether the reference is unknown or belongs to someone else —
    // references must not be probeable
    if (!item) {
      throw AppError.notFound('TRANSACTION_NOT_FOUND', 'Transaction does not exist');
    }
    return item;
  }

  private async requireWallet(userId: string) {
    const wallet = await this.walletsRepository.findByUserId(userId);
    if (!wallet) {
      throw AppError.notFound('WALLET_NOT_FOUND', 'Wallet does not exist');
    }
    return wallet;
  }
}
