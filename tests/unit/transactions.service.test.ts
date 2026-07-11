import { TransactionsService } from '../../src/modules/transactions/transactions.service';
import type { StatementItem } from '../../src/modules/transactions/transactions.types';

const WALLET = { id: 'wallet-1', user_id: 'user-1', balance: 5000, currency: 'NGN', status: 'active' };

const item = (entryId: number): StatementItem => ({
  entry_id: entryId,
  reference: `TXN-20260711-REF${entryId}`,
  type: 'FUNDING',
  status: 'SUCCESS',
  direction: 'CREDIT',
  amount: 1000,
  balance_after: 1000 * entryId,
  narration: null,
  created_at: new Date(),
});

function buildService(options: { wallet?: object | null; rows?: StatementItem[] } = {}) {
  const transactionsRepository = {
    listStatement: jest.fn().mockResolvedValue(options.rows ?? []),
    findStatementItemByReference: jest.fn().mockResolvedValue(undefined),
  };
  const walletsRepository = {
    findByUserId: jest
      .fn()
      .mockResolvedValue(options.wallet === undefined ? WALLET : (options.wallet ?? undefined)),
  };
  const service = new TransactionsService(
    transactionsRepository as never,
    walletsRepository as never,
  );
  return { service, transactionsRepository };
}

describe('TransactionsService.listForUser', () => {
  it('returns a page with a cursor when more rows exist', async () => {
    const { service, transactionsRepository } = buildService({ rows: [item(5), item(4), item(3)] });

    const page = await service.listForUser('user-1', { limit: 2 });

    expect(transactionsRepository.listStatement).toHaveBeenCalledWith('wallet-1', {
      limit: 3,
      beforeEntryId: undefined,
    });
    expect(page.items).toHaveLength(2);
    expect(page.next_cursor).toBe(4);
  });

  it('returns a null cursor on the last page', async () => {
    const { service } = buildService({ rows: [item(2), item(1)] });

    const page = await service.listForUser('user-1', { limit: 2 });

    expect(page.items).toHaveLength(2);
    expect(page.next_cursor).toBeNull();
  });

  it('passes the cursor through for the next page', async () => {
    const { service, transactionsRepository } = buildService({ rows: [] });

    await service.listForUser('user-1', { limit: 20, cursor: 42 });

    expect(transactionsRepository.listStatement).toHaveBeenCalledWith('wallet-1', {
      limit: 21,
      beforeEntryId: 42,
    });
  });

  it('rejects 404 when the user has no wallet', async () => {
    const { service } = buildService({ wallet: null });

    await expect(service.listForUser('user-1', { limit: 20 })).rejects.toMatchObject({
      httpStatus: 404,
      code: 'WALLET_NOT_FOUND',
    });
  });
});

describe('TransactionsService.getByReferenceForUser', () => {
  it('returns the statement item scoped to the caller wallet', async () => {
    const { service, transactionsRepository } = buildService();
    transactionsRepository.findStatementItemByReference.mockResolvedValue(item(7));

    const found = await service.getByReferenceForUser('user-1', 'TXN-20260711-REF7');

    expect(transactionsRepository.findStatementItemByReference).toHaveBeenCalledWith(
      'TXN-20260711-REF7',
      'wallet-1',
    );
    expect(found.entry_id).toBe(7);
  });

  it("rejects 404 for another user's transaction reference", async () => {
    const { service } = buildService();

    await expect(
      service.getByReferenceForUser('user-1', 'TXN-20260711-NOTMINE1'),
    ).rejects.toMatchObject({ httpStatus: 404, code: 'TRANSACTION_NOT_FOUND' });
  });
});
