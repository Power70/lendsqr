import { fundWalletSchema } from '../../src/modules/wallets/wallets.validators';

describe('fundWalletSchema', () => {
  it('accepts a valid amount with optional narration', () => {
    expect(fundWalletSchema.safeParse({ amount: 5000 }).success).toBe(true);
    expect(fundWalletSchema.safeParse({ amount: 5000, narration: 'top-up' }).success).toBe(true);
  });

  it.each([
    ['a float amount', { amount: 50.5 }],
    ['a zero amount', { amount: 0 }],
    ['a negative amount', { amount: -5000 }],
    ['a string amount', { amount: '5000' }],
    ['an amount below the minimum', { amount: 99 }],
    ['an amount above the cap', { amount: 10_000_000_001 }],
    ['a missing amount', {}],
    ['an empty narration', { amount: 5000, narration: '  ' }],
    ['an oversized narration', { amount: 5000, narration: 'x'.repeat(256) }],
  ])('rejects %s', (_label, payload) => {
    expect(fundWalletSchema.safeParse(payload).success).toBe(false);
  });

  it('strips unknown keys', () => {
    const parsed = fundWalletSchema.parse({ amount: 5000, wallet_id: 'someone-else' });

    expect(parsed).not.toHaveProperty('wallet_id');
  });
});
