import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import { db } from '../../src/database/connection';
import { tokenService } from '../../src/modules/auth/token.service';
import { generateReference } from '../../src/shared/utils/reference';

// One cheap hash shared by every test user — login is not under test here
const PASSWORD_HASH = bcrypt.hashSync('correct-horse-9', 4);

let sequence = 0;

export interface TestUser {
  userId: string;
  walletId: string;
  token: string;
}

// Inserts directly so integration tests never depend on the Adjutor API.
// A nonzero opening balance is seeded as a real FUNDING posting, keeping
// the ledger-equals-balance invariant true for every test fixture.
export async function createFundedUser(balanceKobo = 0): Promise<TestUser> {
  sequence += 1;
  const userId = randomUUID();
  const walletId = randomUUID();
  const unique = `${Date.now()}${sequence}`.slice(-10);

  await db('users').insert({
    id: userId,
    email: `user-${userId.slice(0, 8)}@test.local`,
    phone: `+234${unique}`,
    bvn: `1${unique}`,
    password_hash: PASSWORD_HASH,
    first_name: 'Test',
    last_name: `User${sequence}`,
  });
  await db('wallets').insert({ id: walletId, user_id: userId, balance: balanceKobo });

  if (balanceKobo > 0) {
    const transactionId = randomUUID();
    await db('transactions').insert({
      id: transactionId,
      reference: generateReference(),
      type: 'FUNDING',
      status: 'SUCCESS',
      amount: balanceKobo,
      narration: 'opening balance',
    });
    await db('transaction_entries').insert([
      {
        transaction_id: transactionId,
        wallet_id: walletId,
        direction: 'CREDIT',
        amount: balanceKobo,
        balance_after: balanceKobo,
      },
      { transaction_id: transactionId, wallet_id: null, direction: 'DEBIT', amount: balanceKobo },
    ]);
  }

  return { userId, walletId, token: tokenService.sign(userId) };
}
