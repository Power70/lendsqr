import type { Knex } from 'knex';

// Role-based access control. `customer` is every account created through the
// public sign-up (the default); `admin` is granted out-of-band (seed/CLI), so
// the onboarding endpoint can never mint privileged accounts.
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('users', (table) => {
    table.enum('role', ['customer', 'admin']).notNullable().defaultTo('customer').after('last_name');
    table.index(['role'], 'idx_users_role');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('users', (table) => {
    table.dropIndex(['role'], 'idx_users_role');
    table.dropColumn('role');
  });
}
