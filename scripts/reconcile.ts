import { db } from '../src/database/connection';
import { reconcile } from '../src/modules/transactions/reconciliation';

// Thin CLI wrapper around the reconciliation domain logic in `src`. Prints the
// report and exits nonzero on any drift, so it can gate CI or run on a cron.
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
