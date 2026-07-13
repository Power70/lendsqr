import type { Knex } from 'knex';
import { AdminService } from '../../src/modules/admin/admin.service';

const fakeTrx = {} as Knex.Transaction;

const baseUser = (over: Record<string, unknown> = {}) => ({
  id: 'user-1',
  email: 'ada@example.com',
  phone: '+2348012345678',
  bvn: '12345678901',
  password_hash: 'hash',
  first_name: 'Ada',
  last_name: 'Obi',
  role: 'customer' as const,
  status: 'active' as const,
  created_at: new Date('2026-01-01T00:00:00Z'),
  updated_at: new Date('2026-01-01T00:00:00Z'),
  ...over,
});

const baseWallet = (over: Record<string, unknown> = {}) => ({
  id: 'wallet-1',
  user_id: 'user-1',
  balance: 10000,
  currency: 'NGN',
  status: 'active' as const,
  created_at: new Date('2026-01-01T00:00:00Z'),
  updated_at: new Date('2026-01-01T00:00:00Z'),
  ...over,
});

function build() {
  const usersRepository = {
    findById: jest.fn(),
    findByIdForUpdate: jest.fn(),
    updateStatus: jest.fn().mockResolvedValue(undefined),
    list: jest.fn(),
    count: jest.fn(),
  };
  const walletsRepository = {
    findByUserId: jest.fn().mockResolvedValue(baseWallet()),
    findByIdForUpdate: jest.fn(),
    findByUserIds: jest.fn().mockResolvedValue([]),
    updateStatus: jest.fn().mockResolvedValue(undefined),
  };
  const adminRepository = {
    recordAction: jest.fn().mockResolvedValue(undefined),
    listActions: jest.fn(),
    count: jest.fn(),
  };
  const reconcileLedger = jest.fn().mockResolvedValue({
    ok: true,
    wallets_checked: 3,
    drifted_wallets: [],
    global_entry_sum: 0,
  });
  const runTransaction = jest.fn(async (work: (trx: Knex.Transaction) => Promise<unknown>) =>
    work(fakeTrx),
  );

  const service = new AdminService(
    runTransaction as never,
    usersRepository as never,
    walletsRepository as never,
    adminRepository as never,
    reconcileLedger as never,
  );
  return { service, usersRepository, walletsRepository, adminRepository, reconcileLedger, runTransaction };
}

describe('AdminService.updateUserStatus', () => {
  it('suspends an active user and writes an audit record in the same transaction', async () => {
    const { service, usersRepository, adminRepository, runTransaction } = build();
    usersRepository.findByIdForUpdate.mockResolvedValue(baseUser());

    const result = await service.updateUserStatus({
      adminId: 'admin-1',
      userId: 'user-1',
      status: 'suspended',
      reason: 'confirmed fraud',
    });

    expect(usersRepository.updateStatus).toHaveBeenCalledWith('user-1', 'suspended', fakeTrx);
    expect(adminRepository.recordAction).toHaveBeenCalledWith(
      expect.objectContaining({
        adminId: 'admin-1',
        action: 'user.status.updated',
        targetType: 'user',
        targetId: 'user-1',
        metadata: { from: 'active', to: 'suspended', reason: 'confirmed fraud' },
      }),
      fakeTrx,
    );
    expect(runTransaction).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('suspended');
    expect(result.bvn_last4).toBe('8901');
    expect(result.wallet).toMatchObject({ id: 'wallet-1', status: 'active' });
  });

  it('is a no-op with no audit when the status is unchanged', async () => {
    const { service, usersRepository, adminRepository } = build();
    usersRepository.findByIdForUpdate.mockResolvedValue(baseUser({ status: 'active' }));

    const result = await service.updateUserStatus({
      adminId: 'admin-1',
      userId: 'user-1',
      status: 'active',
    });

    expect(usersRepository.updateStatus).not.toHaveBeenCalled();
    expect(adminRepository.recordAction).not.toHaveBeenCalled();
    expect(result.status).toBe('active');
  });

  it('refuses to let an admin change their own status', async () => {
    const { service, usersRepository, adminRepository } = build();
    usersRepository.findByIdForUpdate.mockResolvedValue(baseUser({ id: 'admin-1', role: 'admin' }));

    await expect(
      service.updateUserStatus({ adminId: 'admin-1', userId: 'admin-1', status: 'suspended' }),
    ).rejects.toMatchObject({ httpStatus: 403, code: 'CANNOT_MODIFY_SELF' });
    expect(usersRepository.updateStatus).not.toHaveBeenCalled();
    expect(adminRepository.recordAction).not.toHaveBeenCalled();
  });

  it('rejects a missing user with 404 and writes nothing', async () => {
    const { service, usersRepository, adminRepository } = build();
    usersRepository.findByIdForUpdate.mockResolvedValue(undefined);

    await expect(
      service.updateUserStatus({ adminId: 'admin-1', userId: 'ghost', status: 'suspended' }),
    ).rejects.toMatchObject({ httpStatus: 404, code: 'USER_NOT_FOUND' });
    expect(usersRepository.updateStatus).not.toHaveBeenCalled();
    expect(adminRepository.recordAction).not.toHaveBeenCalled();
  });
});

describe('AdminService.updateWalletStatus', () => {
  it('freezes an active wallet and audits the change', async () => {
    const { service, walletsRepository, adminRepository } = build();
    walletsRepository.findByIdForUpdate.mockResolvedValue(baseWallet());

    const result = await service.updateWalletStatus({
      adminId: 'admin-1',
      walletId: 'wallet-1',
      status: 'frozen',
      reason: 'chargeback investigation',
    });

    expect(walletsRepository.updateStatus).toHaveBeenCalledWith('wallet-1', 'frozen', fakeTrx);
    expect(adminRepository.recordAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'wallet.status.updated',
        targetType: 'wallet',
        targetId: 'wallet-1',
        metadata: { from: 'active', to: 'frozen', reason: 'chargeback investigation' },
      }),
      fakeTrx,
    );
    expect(result).toEqual({ id: 'wallet-1', balance: 10000, currency: 'NGN', status: 'frozen' });
  });

  it('is a no-op with no audit when the wallet already has that status', async () => {
    const { service, walletsRepository, adminRepository } = build();
    walletsRepository.findByIdForUpdate.mockResolvedValue(baseWallet({ status: 'frozen' }));

    await service.updateWalletStatus({ adminId: 'admin-1', walletId: 'wallet-1', status: 'frozen' });

    expect(walletsRepository.updateStatus).not.toHaveBeenCalled();
    expect(adminRepository.recordAction).not.toHaveBeenCalled();
  });

  it('rejects a missing wallet with 404', async () => {
    const { service, walletsRepository } = build();
    walletsRepository.findByIdForUpdate.mockResolvedValue(undefined);

    await expect(
      service.updateWalletStatus({ adminId: 'admin-1', walletId: 'ghost', status: 'frozen' }),
    ).rejects.toMatchObject({ httpStatus: 404, code: 'WALLET_NOT_FOUND' });
  });
});

describe('AdminService.listUsers', () => {
  it('stitches wallets onto users without an N+1 and computes pagination', async () => {
    const { service, usersRepository, walletsRepository } = build();
    const u1 = baseUser({ id: 'user-1' });
    const u2 = baseUser({ id: 'user-2', email: 'no-wallet@example.com' });
    usersRepository.list.mockResolvedValue([u1, u2]);
    usersRepository.count.mockResolvedValue(5);
    walletsRepository.findByUserIds.mockResolvedValue([baseWallet({ id: 'w1', user_id: 'user-1' })]);

    const page = await service.listUsers({ page: 1, limit: 2 });

    // one batched wallet query for the whole page
    expect(walletsRepository.findByUserIds).toHaveBeenCalledTimes(1);
    expect(walletsRepository.findByUserIds).toHaveBeenCalledWith(['user-1', 'user-2']);
    expect(page.items).toHaveLength(2);
    expect(page.items[0]?.wallet).toMatchObject({ id: 'w1' });
    expect(page.items[1]?.wallet).toBeNull();
    expect(page).toMatchObject({ page: 1, limit: 2, total: 5, total_pages: 3 });
  });

  it('translates page/limit into a SQL offset and forwards filters', async () => {
    const { service, usersRepository } = build();
    usersRepository.list.mockResolvedValue([]);
    usersRepository.count.mockResolvedValue(0);

    await service.listUsers({ page: 3, limit: 10, status: 'suspended', role: 'customer', search: 'ada' });

    expect(usersRepository.list).toHaveBeenCalledWith({
      status: 'suspended',
      role: 'customer',
      search: 'ada',
      limit: 10,
      offset: 20,
    });
    expect(usersRepository.count).toHaveBeenCalledWith({
      status: 'suspended',
      role: 'customer',
      search: 'ada',
    });
  });
});

describe('AdminService.getUser', () => {
  it('returns the user with its wallet', async () => {
    const { service, usersRepository } = build();
    usersRepository.findById.mockResolvedValue(baseUser());

    const result = await service.getUser('user-1');

    expect(result.id).toBe('user-1');
    expect(result.wallet).toMatchObject({ id: 'wallet-1' });
  });

  it('rejects a missing user with 404', async () => {
    const { service, usersRepository } = build();
    usersRepository.findById.mockResolvedValue(undefined);

    await expect(service.getUser('ghost')).rejects.toMatchObject({
      httpStatus: 404,
      code: 'USER_NOT_FOUND',
    });
  });
});

describe('AdminService oversight reads', () => {
  it('delegates reconciliation to the injected ledger checker', async () => {
    const { service, reconcileLedger } = build();

    const report = await service.getReconciliation();

    expect(reconcileLedger).toHaveBeenCalledTimes(1);
    expect(report.ok).toBe(true);
  });

  it('paginates the audit log', async () => {
    const { service, adminRepository } = build();
    adminRepository.listActions.mockResolvedValue([{ id: 'a1' }]);
    adminRepository.count.mockResolvedValue(1);

    const page = await service.listAuditLog({ page: 1, limit: 20 });

    expect(adminRepository.listActions).toHaveBeenCalledWith({ limit: 20, offset: 0 });
    expect(page).toMatchObject({ total: 1, total_pages: 1, page: 1, limit: 20 });
  });
});
