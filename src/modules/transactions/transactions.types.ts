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
  entries: EntrySpec[];
}
