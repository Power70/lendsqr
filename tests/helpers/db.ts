import { db } from '../../src/database/connection';

// FK-child tables first so truncation never trips constraint checks
const TABLES = ['transaction_entries', 'idempotency_keys', 'transactions', 'wallets', 'users'];

export async function resetDatabase(): Promise<void> {
  await db.raw('SET FOREIGN_KEY_CHECKS = 0');
  try {
    for (const table of TABLES) {
      await db(table).truncate();
    }
  } finally {
    await db.raw('SET FOREIGN_KEY_CHECKS = 1');
  }
}
