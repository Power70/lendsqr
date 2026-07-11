import type { Knex } from 'knex';
import { db } from '../src/database/connection';

const SIGNED_AMOUNT = "CASE direction WHEN 'CREDIT' THEN amount ELSE -amount END";

export interface ReconciliationReport {
  ok: boolean;
  wallets_checked: number;
  drifted_wallets: Array<{ id: string; balance: number; ledger_sum: number }>;
  global_entry_sum: number;
}

// The ledger is the source of truth; the balance column is a cache.
// Any wallet where the two disagree — or a nonzero global entry sum —
// means money was created or destroyed and must be investigated.
export async function reconcile(database: Knex = db): Promise<ReconciliationReport> {
  const walletSums = await database('wallets as w')
    .leftJoin('transaction_entries as e', 'e.wallet_id', 'w.id')
    .groupBy('w.id', 'w.balance')
    .select(
      'w.id',
      'w.balance',
      database.raw(
        `COALESCE(SUM(CASE e.direction WHEN 'CREDIT' THEN e.amount ELSE -e.amount END), 0) as ledger_sum`,
      ),
    );

  const [globalRow] = await database('transaction_entries').select(
    database.raw(`COALESCE(SUM(${SIGNED_AMOUNT}), 0) as global_sum`),
  );

  const driftedWallets = walletSums
    .map((row) => ({ id: row.id, balance: Number(row.balance), ledger_sum: Number(row.ledger_sum) }))
    .filter((row) => row.balance !== row.ledger_sum);
  const globalEntrySum = Number((globalRow as { global_sum?: unknown })?.global_sum ?? 0);

  return {
    ok: driftedWallets.length === 0 && globalEntrySum === 0,
    wallets_checked: walletSums.length,
    drifted_wallets: driftedWallets,
    global_entry_sum: globalEntrySum,
  };
}

if (require.main === module) {
  reconcile()
    .then((report) => {
      console.log(JSON.stringify(report, null, 2));
      process.exitCode = report.ok ? 0 : 1;
    })
    .catch((err) => {
      console.error('reconciliation failed to run:', err);
      process.exitCode = 1;
    })
    .finally(() => void db.destroy());
}
