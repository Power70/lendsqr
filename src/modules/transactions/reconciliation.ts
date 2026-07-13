import type { Knex } from 'knex';
import { db } from '../../database/connection';

// Signed ledger value for one entries table (aliased or not): credits add to
// a wallet, debits subtract from it.
const signedAmount = (entries: string): string =>
  `CASE ${entries}.direction WHEN 'CREDIT' THEN ${entries}.amount ELSE -${entries}.amount END`;

export interface ReconciliationReport {
  ok: boolean;
  wallets_checked: number;
  drifted_wallets: Array<{ id: string; balance: number; ledger_sum: number }>;
  global_entry_sum: number;
}

/**
 * The ledger is the source of truth; `wallets.balance` is a derived cache.
 * This proves the two still agree: any wallet where they disagree — or a
 * nonzero global entry sum — means money was created or destroyed and must be
 * investigated. Takes the connection as a parameter so the `reconcile` CLI,
 * the admin oversight endpoint, and the integration suite share one
 * implementation.
 */
export async function reconcile(database: Knex = db): Promise<ReconciliationReport> {
  const walletSums = await database('wallets as w')
    .leftJoin('transaction_entries as e', 'e.wallet_id', 'w.id')
    .groupBy('w.id', 'w.balance')
    .select<{ id: string; balance: unknown; ledger_sum: unknown }[]>(
      'w.id',
      'w.balance',
      database.raw(`COALESCE(SUM(${signedAmount('e')}), 0) as ledger_sum`),
    );

  const [globalRow] = await database('transaction_entries').select<{ global_sum: unknown }[]>(
    database.raw(`COALESCE(SUM(${signedAmount('transaction_entries')}), 0) as global_sum`),
  );

  const driftedWallets = walletSums
    .map((row) => ({ id: row.id, balance: Number(row.balance), ledger_sum: Number(row.ledger_sum) }))
    .filter((row) => row.balance !== row.ledger_sum);
  const globalEntrySum = Number(globalRow?.global_sum ?? 0);

  return {
    ok: driftedWallets.length === 0 && globalEntrySum === 0,
    wallets_checked: walletSums.length,
    drifted_wallets: driftedWallets,
    global_entry_sum: globalEntrySum,
  };
}
