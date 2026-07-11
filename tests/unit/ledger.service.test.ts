import type { Knex } from 'knex';
import { LedgerService } from '../../src/modules/transactions/ledger.service';
import type { LedgerPosting } from '../../src/modules/transactions/transactions.types';

const fakeTrx = {} as Knex.Transaction;

function buildService() {
  const transactionsRepository = {
    createTransaction: jest.fn().mockResolvedValue(undefined),
    createEntries: jest.fn().mockResolvedValue(undefined),
  };
  const service = new LedgerService(transactionsRepository as never);
  return { service, transactionsRepository };
}

const fundingPosting = (): LedgerPosting => ({
  type: 'FUNDING',
  amount: 5000,
  narration: 'top-up',
  entries: [
    { walletId: 'wallet-1', direction: 'CREDIT', amount: 5000, balanceAfter: 15000 },
    { walletId: null, direction: 'DEBIT', amount: 5000, balanceAfter: null },
  ],
});

describe('LedgerService.record', () => {
  it('writes the header and balanced entries under one transaction', async () => {
    const { service, transactionsRepository } = buildService();

    const result = await service.record(fundingPosting(), fakeTrx);

    expect(transactionsRepository.createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        id: result.transactionId,
        reference: result.reference,
        type: 'FUNDING',
        status: 'SUCCESS',
        amount: 5000,
        narration: 'top-up',
      }),
      fakeTrx,
    );
    expect(transactionsRepository.createEntries).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          transaction_id: result.transactionId,
          wallet_id: 'wallet-1',
          direction: 'CREDIT',
          amount: 5000,
          balance_after: 15000,
        }),
        expect.objectContaining({
          transaction_id: result.transactionId,
          wallet_id: null,
          direction: 'DEBIT',
          balance_after: null,
        }),
      ],
      fakeTrx,
    );
  });

  it('generates a dated, unique reference', async () => {
    const { service } = buildService();

    const first = await service.record(fundingPosting(), fakeTrx);
    const second = await service.record(fundingPosting(), fakeTrx);

    expect(first.reference).toMatch(/^TXN-\d{8}-[A-Z0-9]{8}$/);
    expect(first.reference).not.toBe(second.reference);
  });

  it.each([
    [
      'unbalanced debits and credits',
      {
        entries: [
          { walletId: 'w1', direction: 'CREDIT', amount: 5000, balanceAfter: 1 },
          { walletId: null, direction: 'DEBIT', amount: 4000, balanceAfter: null },
        ],
      },
    ],
    [
      'entry totals not matching the posting amount',
      {
        entries: [
          { walletId: 'w1', direction: 'CREDIT', amount: 4000, balanceAfter: 1 },
          { walletId: null, direction: 'DEBIT', amount: 4000, balanceAfter: null },
        ],
      },
    ],
    [
      'a single-sided posting',
      { entries: [{ walletId: 'w1', direction: 'CREDIT', amount: 5000, balanceAfter: 1 }] },
    ],
    ['a non-integer amount', { amount: 50.5 }],
    ['a zero amount', { amount: 0 }],
  ])('rejects %s and writes nothing', async (_label, override) => {
    const { service, transactionsRepository } = buildService();
    const posting = { ...fundingPosting(), ...override } as LedgerPosting;

    await expect(service.record(posting, fakeTrx)).rejects.toMatchObject({
      code: 'LEDGER_INVARIANT_VIOLATION',
      isOperational: false,
    });
    expect(transactionsRepository.createTransaction).not.toHaveBeenCalled();
    expect(transactionsRepository.createEntries).not.toHaveBeenCalled();
  });
});
