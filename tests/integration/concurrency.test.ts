import request from 'supertest';
import { createApp } from '../../src/app';
import { db } from '../../src/database/connection';
import { reconcile } from '../../scripts/reconcile';
import { resetDatabase } from '../helpers/db';
import { createFundedUser, type TestUser } from '../helpers/factories';

// Real MySQL, real locks, full middleware chain — these tests prove the
// concurrency claims that unit tests with mocks cannot.
describe('money movement under concurrency', () => {
  const app = createApp();

  const transfer = (sender: TestUser, recipientWalletId: string, amount: number, key: string) =>
    request(app)
      .post('/api/v1/transactions/transfer')
      .set('Authorization', `Bearer ${sender.token}`)
      .set('Idempotency-Key', key)
      .send({ recipient_wallet_id: recipientWalletId, amount });

  const walletBalance = async (walletId: string): Promise<number> => {
    const row = await db('wallets').where({ id: walletId }).first('balance');
    return Number(row?.balance);
  };

  beforeEach(resetDatabase);

  afterAll(async () => {
    await db.destroy();
  });

  it('allows exactly one of two concurrent transfers that both fit only once', async () => {
    const sender = await createFundedUser(100_000);
    const recipient = await createFundedUser(0);

    const [first, second] = await Promise.all([
      transfer(sender, recipient.walletId, 80_000, 'double-spend-key-1'),
      transfer(sender, recipient.walletId, 80_000, 'double-spend-key-2'),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([201, 422]);
    const failed = first.status === 422 ? first : second;
    expect(failed.body.code).toBe('INSUFFICIENT_FUNDS');

    await expect(walletBalance(sender.walletId)).resolves.toBe(20_000);
    await expect(walletBalance(recipient.walletId)).resolves.toBe(80_000);
  });

  it('settles crossing transfers without deadlocking', async () => {
    const alice = await createFundedUser(50_000);
    const bob = await createFundedUser(50_000);

    const [aToB, bToA] = await Promise.all([
      transfer(alice, bob.walletId, 20_000, 'crossing-key-a'),
      transfer(bob, alice.walletId, 10_000, 'crossing-key-b'),
    ]);

    expect(aToB.status).toBe(201);
    expect(bToA.status).toBe(201);
    await expect(walletBalance(alice.walletId)).resolves.toBe(40_000);
    await expect(walletBalance(bob.walletId)).resolves.toBe(60_000);
  });

  it('writes exactly one ledger transaction for concurrent identical requests', async () => {
    const sender = await createFundedUser(100_000);
    const recipient = await createFundedUser(0);
    const key = 'idempotent-race-key';

    const results = await Promise.all([
      transfer(sender, recipient.walletId, 30_000, key),
      transfer(sender, recipient.walletId, 30_000, key),
    ]);

    // Winner commits; the loser either replays the snapshot or is told
    // the request is in flight — never a second movement
    const statuses = results.map((r) => r.status).sort();
    expect([[201, 201], [201, 409]]).toContainEqual(statuses);

    const [count] = await db('transactions').where({ type: 'TRANSFER' }).count('id as n');
    expect(Number(count?.n)).toBe(1);
    await expect(walletBalance(sender.walletId)).resolves.toBe(70_000);

    const retry = await transfer(sender, recipient.walletId, 30_000, key);
    expect(retry.status).toBe(201);
    expect(retry.headers['x-idempotent-replay']).toBe('true');
    await expect(walletBalance(sender.walletId)).resolves.toBe(70_000);
  });

  it('keeps the ledger reconciled after a burst of mixed operations', async () => {
    const alice = await createFundedUser(200_000);
    const bob = await createFundedUser(50_000);

    const fund = (user: TestUser, amount: number, key: string) =>
      request(app)
        .post('/api/v1/wallets/fund')
        .set('Authorization', `Bearer ${user.token}`)
        .set('Idempotency-Key', key)
        .send({ amount });
    const withdraw = (user: TestUser, amount: number, key: string) =>
      request(app)
        .post('/api/v1/wallets/withdraw')
        .set('Authorization', `Bearer ${user.token}`)
        .set('Idempotency-Key', key)
        .send({ amount, bank_code: '058', account_number: '0123456789' });

    const results = await Promise.all([
      transfer(alice, bob.walletId, 30_000, 'burst-t1'),
      transfer(bob, alice.walletId, 10_000, 'burst-t2'),
      fund(alice, 25_000, 'burst-f1'),
      withdraw(bob, 15_000, 'burst-w1'),
      transfer(alice, bob.walletId, 5_000, 'burst-t3'),
    ]);
    expect(results.map((r) => r.status)).toEqual([201, 201, 201, 201, 201]);

    const report = await reconcile(db);
    expect(report.drifted_wallets).toEqual([]);
    expect(report.global_entry_sum).toBe(0);
    expect(report.ok).toBe(true);
  });
});
