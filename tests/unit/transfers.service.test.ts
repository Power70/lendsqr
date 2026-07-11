import type { Knex } from 'knex';
import { TransferService } from '../../src/modules/transactions/transfers.service';

const fakeTrx = {} as Knex.Transaction;

const SENDER = { id: 'aaa-wallet', user_id: 'user-1', balance: 10000, currency: 'NGN', status: 'active' };
const RECIPIENT = { id: 'bbb-wallet', user_id: 'user-2', balance: 2000, currency: 'NGN', status: 'active' };

function buildService(overrides: { sender?: object | null; recipient?: object | null } = {}) {
  const sender = overrides.sender === undefined ? SENDER : overrides.sender;
  const recipient = overrides.recipient === undefined ? RECIPIENT : overrides.recipient;
  const lockedRows = [sender, recipient].filter((w): w is typeof SENDER => w !== null);

  const walletsRepository = {
    findByUserId: jest.fn().mockResolvedValue(sender ?? undefined),
    findManyByIdsForUpdate: jest.fn().mockResolvedValue(lockedRows),
    updateBalance: jest.fn().mockResolvedValue(undefined),
  };
  const ledgerService = {
    record: jest.fn().mockResolvedValue({ transactionId: 'txn-1', reference: 'TXN-20260711-TRANSFER' }),
  };
  const idempotencyRepository = { complete: jest.fn().mockResolvedValue(undefined) };
  const runTransaction = jest.fn(async (work: (trx: Knex.Transaction) => Promise<unknown>) =>
    work(fakeTrx),
  );

  const service = new TransferService(
    runTransaction as never,
    walletsRepository as never,
    ledgerService as never,
    idempotencyRepository as never,
  );
  return { service, walletsRepository, ledgerService, idempotencyRepository };
}

const params = {
  userId: 'user-1',
  recipientWalletId: 'bbb-wallet',
  amount: 4000,
  narration: 'rent',
  idempotencyRecordId: 'idem-1',
};

describe('TransferService.transfer', () => {
  it('locks both wallets and moves the money with a balanced posting', async () => {
    const { service, walletsRepository, ledgerService } = buildService();

    const result = await service.transfer(params);

    expect(walletsRepository.findManyByIdsForUpdate).toHaveBeenCalledWith(
      ['aaa-wallet', 'bbb-wallet'],
      fakeTrx,
    );
    expect(ledgerService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'TRANSFER',
        amount: 4000,
        entries: [
          { walletId: 'aaa-wallet', direction: 'DEBIT', amount: 4000, balanceAfter: 6000 },
          { walletId: 'bbb-wallet', direction: 'CREDIT', amount: 4000, balanceAfter: 6000 },
        ],
      }),
      fakeTrx,
    );
    expect(walletsRepository.updateBalance).toHaveBeenCalledWith('aaa-wallet', 6000, fakeTrx);
    expect(walletsRepository.updateBalance).toHaveBeenCalledWith('bbb-wallet', 6000, fakeTrx);
    expect(result).toEqual({
      reference: 'TXN-20260711-TRANSFER',
      amount: 4000,
      balance_after: 6000,
      recipient_wallet_id: 'bbb-wallet',
    });
  });

  it('completes the idempotency record inside the same transaction', async () => {
    const { service, idempotencyRepository } = buildService();

    const result = await service.transfer(params);

    expect(idempotencyRepository.complete).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'idem-1',
        transactionId: 'txn-1',
        snapshot: { status_code: 201, body: { status: 'success', data: result } },
      }),
      fakeTrx,
    );
  });

  it('allows an exact-balance transfer (boundary)', async () => {
    const { service } = buildService();

    const result = await service.transfer({ ...params, amount: 10000 });

    expect(result.balance_after).toBe(0);
  });

  it('rejects insufficient funds under the lock and moves nothing', async () => {
    const { service, ledgerService, walletsRepository } = buildService();

    await expect(service.transfer({ ...params, amount: 10001 })).rejects.toMatchObject({
      httpStatus: 422,
      code: 'INSUFFICIENT_FUNDS',
    });
    expect(ledgerService.record).not.toHaveBeenCalled();
    expect(walletsRepository.updateBalance).not.toHaveBeenCalled();
  });

  it('rejects a self-transfer before taking any locks', async () => {
    const { service, walletsRepository } = buildService();

    await expect(
      service.transfer({ ...params, recipientWalletId: 'aaa-wallet' }),
    ).rejects.toMatchObject({ httpStatus: 422, code: 'SELF_TRANSFER' });
    expect(walletsRepository.findManyByIdsForUpdate).not.toHaveBeenCalled();
  });

  it('rejects when the sender has no wallet', async () => {
    const { service } = buildService({ sender: null });

    await expect(service.transfer(params)).rejects.toMatchObject({
      httpStatus: 404,
      code: 'WALLET_NOT_FOUND',
    });
  });

  it('rejects when the recipient wallet does not exist', async () => {
    const { service } = buildService({ recipient: null });

    await expect(service.transfer(params)).rejects.toMatchObject({
      httpStatus: 404,
      code: 'RECIPIENT_NOT_FOUND',
    });
  });

  it('rejects when the sender wallet is frozen', async () => {
    const { service } = buildService({ sender: { ...SENDER, status: 'frozen' } });

    await expect(service.transfer(params)).rejects.toMatchObject({
      httpStatus: 422,
      code: 'WALLET_NOT_ACTIVE',
    });
  });

  it('rejects when the recipient wallet is frozen and moves nothing', async () => {
    const { service, ledgerService } = buildService({
      recipient: { ...RECIPIENT, status: 'frozen' },
    });

    await expect(service.transfer(params)).rejects.toMatchObject({
      httpStatus: 422,
      code: 'RECIPIENT_NOT_ACTIVE',
    });
    expect(ledgerService.record).not.toHaveBeenCalled();
  });
});
