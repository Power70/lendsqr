import type { Knex } from 'knex';

// Append-only double-entry ledger: every transaction writes balanced
// DEBIT/CREDIT lines. A NULL wallet_id is the system/settlement side of
// funding and withdrawal, so all entries of a transaction sum to zero.
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('transaction_entries', (table) => {
    table.bigIncrements('id').primary();
    table.string('transaction_id', 36).notNullable().references('id').inTable('transactions');
    table.string('wallet_id', 36).nullable().references('id').inTable('wallets');
    table.enum('direction', ['DEBIT', 'CREDIT']).notNullable();
    table.bigInteger('amount').unsigned().notNullable();
    // Wallet balance snapshot after this entry; NULL for system entries
    table.bigInteger('balance_after').unsigned().nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    table.index(['wallet_id', 'created_at'], 'idx_entries_wallet_created');
    table.index(['transaction_id'], 'idx_entries_transaction');
    table.check('?? > 0', ['amount'], 'chk_entries_amount_positive');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('transaction_entries');
}
