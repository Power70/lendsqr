export type WalletStatus = 'active' | 'frozen';

// Row shape of the `wallets` table; balance is in minor units (kobo)
export interface WalletRecord {
  id: string;
  user_id: string;
  balance: number;
  currency: string;
  status: WalletStatus;
  created_at: Date;
  updated_at: Date;
}
