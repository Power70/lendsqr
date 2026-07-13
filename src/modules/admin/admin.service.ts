import { randomUUID } from 'node:crypto';
import type { TransactionRunner } from '../../database/with-transaction';
import { AppError } from '../../shared/errors/app-error';
import type { ReconciliationReport } from '../transactions/reconciliation';
import type { UserRepository } from '../users/users.repository';
import type { UserRole, UserStatus } from '../users/users.types';
import type { WalletRepository } from '../wallets/wallets.repository';
import type { WalletStatus } from '../wallets/wallets.types';
import type { AdminRepository } from './admin.repository';
import {
  toAdminUserView,
  toAdminWalletView,
  type AdminAuditRecord,
  type AdminUserView,
  type AdminWalletView,
} from './admin.types';

export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

export interface ListUsersParams {
  page: number;
  limit: number;
  status?: UserStatus;
  role?: UserRole;
  search?: string;
}

// Admin oversight: read users/wallets, change their status (each change
// audited), and inspect ledger integrity. Every mutation is one transaction
// that updates state and appends its audit row atomically.
export class AdminService {
  constructor(
    private readonly runTransaction: TransactionRunner,
    private readonly usersRepository: UserRepository,
    private readonly walletsRepository: WalletRepository,
    private readonly adminRepository: AdminRepository,
    private readonly reconcileLedger: () => Promise<ReconciliationReport>,
  ) {}

  async listUsers(params: ListUsersParams): Promise<Paginated<AdminUserView>> {
    const offset = (params.page - 1) * params.limit;
    const filters = { status: params.status, role: params.role, search: params.search };

    const [users, total] = await Promise.all([
      this.usersRepository.list({ ...filters, limit: params.limit, offset }),
      this.usersRepository.count(filters),
    ]);

    // Single batched wallet lookup instead of one query per user (no N+1)
    const wallets = await this.walletsRepository.findByUserIds(users.map((u) => u.id));
    const walletByUserId = new Map(wallets.map((w) => [w.user_id, w]));

    return {
      items: users.map((u) => toAdminUserView(u, walletByUserId.get(u.id) ?? null)),
      page: params.page,
      limit: params.limit,
      total,
      total_pages: Math.ceil(total / params.limit),
    };
  }

  async getUser(userId: string): Promise<AdminUserView> {
    const user = await this.usersRepository.findById(userId);
    if (!user) {
      throw AppError.notFound('USER_NOT_FOUND', 'User does not exist');
    }
    const wallet = await this.walletsRepository.findByUserId(userId);
    return toAdminUserView(user, wallet);
  }

  async updateUserStatus(params: {
    adminId: string;
    userId: string;
    status: UserStatus;
    reason?: string;
  }): Promise<AdminUserView> {
    return this.runTransaction(async (trx) => {
      const user = await this.usersRepository.findByIdForUpdate(params.userId, trx);
      if (!user) {
        throw AppError.notFound('USER_NOT_FOUND', 'User does not exist');
      }
      // An admin locking themselves out is almost always a mistake, and
      // enables no legitimate workflow — block it explicitly.
      if (user.id === params.adminId) {
        throw AppError.forbidden(
          'CANNOT_MODIFY_SELF',
          'Admins cannot change their own account status',
        );
      }

      // Idempotent: setting the status it already has is a no-op and writes no
      // audit noise.
      if (user.status !== params.status) {
        await this.usersRepository.updateStatus(user.id, params.status, trx);
        await this.adminRepository.recordAction(
          {
            id: randomUUID(),
            adminId: params.adminId,
            action: 'user.status.updated',
            targetType: 'user',
            targetId: user.id,
            metadata: { from: user.status, to: params.status, reason: params.reason ?? null },
          },
          trx,
        );
      }

      const wallet = await this.walletsRepository.findByUserId(user.id);
      return toAdminUserView({ ...user, status: params.status }, wallet);
    });
  }

  async updateWalletStatus(params: {
    adminId: string;
    walletId: string;
    status: WalletStatus;
    reason?: string;
  }): Promise<AdminWalletView> {
    return this.runTransaction(async (trx) => {
      const wallet = await this.walletsRepository.findByIdForUpdate(params.walletId, trx);
      if (!wallet) {
        throw AppError.notFound('WALLET_NOT_FOUND', 'Wallet does not exist');
      }

      if (wallet.status !== params.status) {
        await this.walletsRepository.updateStatus(wallet.id, params.status, trx);
        await this.adminRepository.recordAction(
          {
            id: randomUUID(),
            adminId: params.adminId,
            action: 'wallet.status.updated',
            targetType: 'wallet',
            targetId: wallet.id,
            metadata: { from: wallet.status, to: params.status, reason: params.reason ?? null },
          },
          trx,
        );
      }

      return toAdminWalletView({ ...wallet, status: params.status });
    });
  }

  getReconciliation(): Promise<ReconciliationReport> {
    return this.reconcileLedger();
  }

  async listAuditLog(params: { page: number; limit: number }): Promise<Paginated<AdminAuditRecord>> {
    const offset = (params.page - 1) * params.limit;
    const [items, total] = await Promise.all([
      this.adminRepository.listActions({ limit: params.limit, offset }),
      this.adminRepository.count(),
    ]);
    return {
      items,
      page: params.page,
      limit: params.limit,
      total,
      total_pages: Math.ceil(total / params.limit),
    };
  }
}
