import type { Knex } from 'knex';

// Append-only audit trail of privileged actions. Every admin state change
// (suspending a user, freezing a wallet) writes one immutable row recording
// who did what, to which target, and why — the same "corrections are new
// records, never UPDATEs" discipline the money ledger follows.
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('admin_audit_log', (table) => {
    table.string('id', 36).primary();
    table.string('admin_id', 36).notNullable().references('id').inTable('users');
    // Dotted verb of the action, e.g. 'user.status.updated'
    table.string('action', 64).notNullable();
    table.enum('target_type', ['user', 'wallet']).notNullable();
    table.string('target_id', 36).notNullable();
    // Structured context: { from, to, reason }
    table.json('metadata').nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    table.index(['admin_id', 'created_at'], 'idx_audit_admin_created');
    table.index(['target_type', 'target_id'], 'idx_audit_target');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('admin_audit_log');
}
