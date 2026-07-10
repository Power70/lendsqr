import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('idempotency_keys', (table) => {
    table.string('id', 36).primary();
    table.string('user_id', 36).notNullable().references('id').inTable('users');
    table.string('idempotency_key', 64).notNullable();
    table.string('endpoint', 100).notNullable();
    table.enum('status', ['processing', 'completed', 'failed']).notNullable().defaultTo('processing');
    // sha256 of the request body — detects key reuse with a different payload
    table.string('request_hash', 64).notNullable();
    table.json('response_snapshot').nullable();
    table.string('transaction_id', 36).nullable().references('id').inTable('transactions');
    table.timestamps(true, true);

    table.unique(['user_id', 'idempotency_key', 'endpoint'], {
      indexName: 'uq_idem_user_key_endpoint',
    });
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('idempotency_keys');
}
