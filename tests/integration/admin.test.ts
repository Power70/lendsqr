import request from 'supertest';
import { createApp } from '../../src/app';
import { db } from '../../src/database/connection';
import { resetDatabase } from '../helpers/db';
import { createAdmin, createFundedUser } from '../helpers/factories';

// Full HTTP + middleware chain against real MySQL: proves RBAC, the audit
// trail, and that admin status changes are actually enforced downstream.
describe('admin module', () => {
  const app = createApp();

  beforeEach(resetDatabase);
  afterAll(async () => {
    await db.destroy();
  });

  it('rejects an unauthenticated request', async () => {
    const res = await request(app).get('/api/v1/admin/users');
    expect(res.status).toBe(401);
  });

  it('forbids a non-admin (customer) token', async () => {
    const user = await createFundedUser(0);
    const res = await request(app)
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${user.token}`);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('lists users with their wallets, without leaking secrets', async () => {
    const admin = await createAdmin();
    await createFundedUser(5_000);

    const res = await request(app)
      .get('/api/v1/admin/users?role=customer')
      .set('Authorization', `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(1);
    const item = res.body.data.items[0];
    expect(item.wallet.balance).toBe(5_000);
    expect(item).not.toHaveProperty('password_hash');
    expect(item).not.toHaveProperty('bvn');
    expect(item.bvn_last4).toHaveLength(4);
  });

  it('suspends a user, records an audit row, and locks them out immediately', async () => {
    const admin = await createAdmin();
    const user = await createFundedUser(0);

    const res = await request(app)
      .patch(`/api/v1/admin/users/${user.userId}/status`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ status: 'suspended', reason: 'confirmed fraud' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('suspended');

    const audit = await db('admin_audit_log').where({ target_id: user.userId }).first();
    expect(audit.action).toBe('user.status.updated');
    expect(audit.admin_id).toBe(admin.userId);

    // The suspended user can no longer use an authenticated endpoint
    const me = await request(app)
      .get('/api/v1/wallets/me')
      .set('Authorization', `Bearer ${user.token}`);
    expect(me.status).toBe(403);
    expect(me.body.code).toBe('ACCOUNT_SUSPENDED');
  });

  it('is idempotent: re-suspending writes no second audit row', async () => {
    const admin = await createAdmin();
    const user = await createFundedUser(0);
    const suspend = () =>
      request(app)
        .patch(`/api/v1/admin/users/${user.userId}/status`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ status: 'suspended' });

    await suspend();
    await suspend();

    const [row] = await db('admin_audit_log').where({ target_id: user.userId }).count('id as n');
    expect(Number(row?.n)).toBe(1);
  });

  it('freezes a wallet, which blocks funding', async () => {
    const admin = await createAdmin();
    const user = await createFundedUser(0);
    const wallet = await db('wallets').where({ user_id: user.userId }).first();

    const res = await request(app)
      .patch(`/api/v1/admin/wallets/${wallet.id}/status`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ status: 'frozen' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('frozen');

    const fund = await request(app)
      .post('/api/v1/wallets/fund')
      .set('Authorization', `Bearer ${user.token}`)
      .set('Idempotency-Key', 'admin-frozen-fund-1')
      .send({ amount: 1_000 });
    expect(fund.status).toBe(422);
    expect(fund.body.code).toBe('WALLET_NOT_ACTIVE');
  });

  it('prevents an admin from changing their own status', async () => {
    const admin = await createAdmin();

    const res = await request(app)
      .patch(`/api/v1/admin/users/${admin.userId}/status`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ status: 'suspended' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('CANNOT_MODIFY_SELF');
  });

  it('exposes ledger reconciliation to admins', async () => {
    const admin = await createAdmin();
    await createFundedUser(5_000);

    const res = await request(app)
      .get('/api/v1/admin/reconciliation')
      .set('Authorization', `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.ok).toBe(true);
    expect(res.body.data.global_entry_sum).toBe(0);
  });
});
