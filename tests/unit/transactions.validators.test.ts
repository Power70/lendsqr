import {
  listTransactionsQuerySchema,
  referenceParamsSchema,
  transferSchema,
} from '../../src/modules/transactions/transactions.validators';

const validTransfer = {
  recipient_wallet_id: '30211d1f-0643-49f9-b70c-b84dc4269555',
  amount: 5000,
};

describe('transferSchema', () => {
  it('accepts a valid transfer with optional narration', () => {
    expect(transferSchema.safeParse(validTransfer).success).toBe(true);
    expect(transferSchema.safeParse({ ...validTransfer, narration: 'rent' }).success).toBe(true);
  });

  it.each([
    ['a non-uuid recipient', { recipient_wallet_id: 'not-a-uuid' }],
    ['a float amount', { amount: 50.5 }],
    ['a negative amount', { amount: -5000 }],
    ['a string amount', { amount: '5000' }],
    ['an amount above the cap', { amount: 10_000_000_001 }],
  ])('rejects %s', (_label, override) => {
    expect(transferSchema.safeParse({ ...validTransfer, ...override }).success).toBe(false);
  });
});

describe('listTransactionsQuerySchema', () => {
  it('defaults the limit and coerces string query values', () => {
    expect(listTransactionsQuerySchema.parse({})).toEqual({ limit: 20 });
    expect(listTransactionsQuerySchema.parse({ limit: '5', cursor: '42' })).toEqual({
      limit: 5,
      cursor: 42,
    });
  });

  it.each([
    ['a limit above 100', { limit: '101' }],
    ['a zero limit', { limit: '0' }],
    ['a non-numeric cursor', { cursor: 'abc' }],
    ['a negative cursor', { cursor: '-1' }],
  ])('rejects %s', (_label, query) => {
    expect(listTransactionsQuerySchema.safeParse(query).success).toBe(false);
  });
});

describe('referenceParamsSchema', () => {
  it('accepts a well-formed reference', () => {
    expect(referenceParamsSchema.safeParse({ reference: 'TXN-20260711-7QG26D7H' }).success).toBe(
      true,
    );
  });

  it.each([
    ['a malformed prefix', 'PAY-20260711-7QG26D7H'],
    ['a short suffix', 'TXN-20260711-7QG2'],
    ['sql injection noise', "TXN-20260711-' OR 1=1"],
  ])('rejects %s', (_label, reference) => {
    expect(referenceParamsSchema.safeParse({ reference }).success).toBe(false);
  });
});
