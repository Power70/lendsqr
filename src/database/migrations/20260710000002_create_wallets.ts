import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('wallets', (table) => {
    table.string('id', 36).primary();
    table.string('user_id', 36).notNullable().unique().references('id').inTable('users');
    // Minor units (kobo). Unsigned + CHECK: balance can never go negative,
    // even if a future code path skips the in-application guard.
    table.bigInteger('balance').unsigned().notNullable().defaultTo(0);
    table.string('currency', 3).notNullable().defaultTo('NGN');
    table.enum('status', ['active', 'frozen']).notNullable().defaultTo('active');
    table.timestamps(true, true);
    table.check('?? >= 0', ['balance'], 'chk_wallets_balance_non_negative');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('wallets');
}
