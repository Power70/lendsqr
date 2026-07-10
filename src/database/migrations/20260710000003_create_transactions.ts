import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('transactions', (table) => {
    table.string('id', 36).primary();
    table.string('reference', 40).notNullable().unique();
    table.enum('type', ['FUNDING', 'TRANSFER', 'WITHDRAWAL']).notNullable();
    table.enum('status', ['SUCCESS', 'FAILED', 'REVERSED']).notNullable();
    table.bigInteger('amount').unsigned().notNullable();
    table.string('currency', 3).notNullable().defaultTo('NGN');
    table.string('narration', 255).nullable();
    table.json('metadata').nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.check('?? > 0', ['amount'], 'chk_transactions_amount_positive');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('transactions');
}
