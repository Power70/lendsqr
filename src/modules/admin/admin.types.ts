import type { UserRecord, UserRole, UserStatus } from '../users/users.types';
import type { WalletRecord, WalletStatus } from '../wallets/wallets.types';

export type AuditTargetType = 'user' | 'wallet';
export type AuditAction = 'user.status.updated' | 'wallet.status.updated';

// What an admin is allowed to see about a wallet.
export interface AdminWalletView {
  id: string;
  balance: number;
  currency: string;
  status: WalletStatus;
}

// Admin view of a user. Deliberately omits `password_hash` and masks the BVN
// to its last 4 digits — oversight never needs the raw KYC identifier.
export interface AdminUserView {
  id: string;
  email: string;
  phone: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  status: UserStatus;
  bvn_last4: string;
  created_at: Date;
  updated_at: Date;
  wallet: AdminWalletView | null;
}

export interface AdminAuditRecord {
  id: string;
  admin_id: string;
  action: AuditAction;
  target_type: AuditTargetType;
  target_id: string;
  metadata: Record<string, unknown> | null;
  created_at: Date;
}

export function toAdminWalletView(wallet: WalletRecord): AdminWalletView {
  return {
    id: wallet.id,
    balance: wallet.balance,
    currency: wallet.currency,
    status: wallet.status,
  };
}

export function toAdminUserView(user: UserRecord, wallet?: WalletRecord | null): AdminUserView {
  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    first_name: user.first_name,
    last_name: user.last_name,
    role: user.role,
    status: user.status,
    bvn_last4: user.bvn.slice(-4),
    created_at: user.created_at,
    updated_at: user.updated_at,
    wallet: wallet ? toAdminWalletView(wallet) : null,
  };
}
