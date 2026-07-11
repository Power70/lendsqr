export type TransactionType = 'FUNDING' | 'TRANSFER' | 'WITHDRAWAL';
export type TransactionStatus = 'SUCCESS' | 'FAILED' | 'REVERSED';
export type EntryDirection = 'DEBIT' | 'CREDIT';

export interface TransactionRecord {
  id: string;
  reference: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: number;
  currency: string;
  narration: string | null;
  metadata: unknown;
  created_at: Date;
}

// One ledger line; a null walletId is the system/settlement side, so
// balanceAfter only exists for real wallets
export interface EntrySpec {
  walletId: string | null;
  direction: EntryDirection;
  amount: number;
  balanceAfter: number | null;
}

export interface LedgerPosting {
  type: TransactionType;
  amount: number;
  narration?: string;
  metadata?: Record<string, unknown>;
  entries: EntrySpec[];
}

// One row of a wallet's statement: the wallet's own ledger line joined
// with its transaction header
export interface StatementItem {
  entry_id: number;
  reference: string;
  type: TransactionType;
  status: TransactionStatus;
  direction: EntryDirection;
  amount: number;
  balance_after: number | null;
  narration: string | null;
  created_at: Date;
}
