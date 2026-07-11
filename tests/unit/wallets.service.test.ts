import type { Knex } from 'knex';
import { WalletsService } from '../../src/modules/wallets/wallets.service';

const fakeTrx = {} as Knex.Transaction;

const activeWallet = () => ({
  id: 'wallet-1',
  user_id: 'user-1',
  balance: 10000,
  currency: 'NGN',
  status: 'active' as const,
});

function buildService(wallet: ReturnType<typeof activeWallet> | null = activeWallet()) {
  const walletsRepository = {
    findByUserIdForUpdate: jest.fn().mockResolvedValue(wallet ?? undefined),
    updateBalance: jest.fn().mockResolvedValue(undefined),
  };
  const ledgerService = {
    record: jest.fn().mockResolvedValue({ transactionId: 'txn-1', reference: 'TXN-20260711-ABCDEFGH' }),
  };
  const idempotencyRepository = {
    complete: jest.fn().mockResolvedValue(undefined),
  };
  const runTransaction = jest.fn(async (work: (trx: Knex.Transaction) => Promise<unknown>) =>
    work(fakeTrx),
  );

  const service = new WalletsService(
    runTransaction as never,
    walletsRepository as never,
    ledgerService as never,
    idempotencyRepository as never,
  );
  return { service, walletsRepository, ledgerService, idempotencyRepository, runTransaction };
}

const fundParams = {
  userId: 'user-1',
  amount: 5000,
  narration: 'top-up',
  idempotencyRecordId: 'idem-1',
};

describe('WalletsService.fund', () => {
  it('locks the wallet, records a balanced posting and updates the balance', async () => {
    const { service, walletsRepository, ledgerService } = buildService();

    const result = await service.fund(fundParams);

    expect(walletsRepository.findByUserIdForUpdate).toHaveBeenCalledWith('user-1', fakeTrx);
    expect(ledgerService.record).toHaveBeenCalledWith(
      {
        type: 'FUNDING',
        amount: 5000,
        narration: 'top-up',
        entries: [
          { walletId: 'wallet-1', direction: 'CREDIT', amount: 5000, balanceAfter: 15000 },
          { walletId: null, direction: 'DEBIT', amount: 5000, balanceAfter: null },
        ],
      },
      fakeTrx,
    );
    expect(walletsRepository.updateBalance).toHaveBeenCalledWith('wallet-1', 15000, fakeTrx);
    expect(result).toEqual({
      reference: 'TXN-20260711-ABCDEFGH',
      amount: 5000,
      balance_after: 15000,
    });
  });

  it('completes the idempotency record inside the same transaction', async () => {
    const { service, idempotencyRepository } = buildService();

    const result = await service.fund(fundParams);

    expect(idempotencyRepository.complete).toHaveBeenCalledWith(
      {
        id: 'idem-1',
        transactionId: 'txn-1',
        snapshot: { status_code: 201, body: { status: 'success', data: result } },
      },
      fakeTrx,
    );
  });

  it('rejects 404 when the wallet does not exist and moves no money', async () => {
    const { service, ledgerService, walletsRepository } = buildService(null);

    await expect(service.fund(fundParams)).rejects.toMatchObject({
      httpStatus: 404,
      code: 'WALLET_NOT_FOUND',
    });
    expect(ledgerService.record).not.toHaveBeenCalled();
    expect(walletsRepository.updateBalance).not.toHaveBeenCalled();
  });

  it('rejects 422 when the wallet is frozen and moves no money', async () => {
    const { service, ledgerService } = buildService({ ...activeWallet(), status: 'frozen' as never });

    await expect(service.fund(fundParams)).rejects.toMatchObject({
      httpStatus: 422,
      code: 'WALLET_NOT_ACTIVE',
    });
    expect(ledgerService.record).not.toHaveBeenCalled();
  });

  it('runs every step inside one transaction', async () => {
    const { service, runTransaction } = buildService();

    await service.fund(fundParams);

    expect(runTransaction).toHaveBeenCalledTimes(1);
  });
});

const withdrawParams = {
  userId: 'user-1',
  amount: 4000,
  bankCode: '058',
  accountNumber: '0123456789',
  idempotencyRecordId: 'idem-2',
};

describe('WalletsService.withdraw', () => {
  it('debits the wallet and stores only masked destination details', async () => {
    const { service, walletsRepository, ledgerService } = buildService();

    const result = await service.withdraw(withdrawParams);

    expect(ledgerService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'WITHDRAWAL',
        amount: 4000,
        metadata: { destination: { bank_code: '058', account_last4: '6789' } },
        entries: [
          { walletId: 'wallet-1', direction: 'DEBIT', amount: 4000, balanceAfter: 6000 },
          { walletId: null, direction: 'CREDIT', amount: 4000, balanceAfter: null },
        ],
      }),
      fakeTrx,
    );
    expect(walletsRepository.updateBalance).toHaveBeenCalledWith('wallet-1', 6000, fakeTrx);
    expect(result.balance_after).toBe(6000);
  });

  it('allows withdrawing the exact balance (boundary)', async () => {
    const { service } = buildService();

    const result = await service.withdraw({ ...withdrawParams, amount: 10000 });

    expect(result.balance_after).toBe(0);
  });

  it('rejects insufficient funds and moves nothing', async () => {
    const { service, ledgerService, walletsRepository } = buildService();

    await expect(service.withdraw({ ...withdrawParams, amount: 10001 })).rejects.toMatchObject({
      httpStatus: 422,
      code: 'INSUFFICIENT_FUNDS',
    });
    expect(ledgerService.record).not.toHaveBeenCalled();
    expect(walletsRepository.updateBalance).not.toHaveBeenCalled();
  });

  it('rejects a frozen wallet', async () => {
    const { service } = buildService({ ...activeWallet(), status: 'frozen' as never });

    await expect(service.withdraw(withdrawParams)).rejects.toMatchObject({
      httpStatus: 422,
      code: 'WALLET_NOT_ACTIVE',
    });
  });

  it('rejects a missing wallet', async () => {
    const { service } = buildService(null);

    await expect(service.withdraw(withdrawParams)).rejects.toMatchObject({
      httpStatus: 404,
      code: 'WALLET_NOT_FOUND',
    });
  });
});
