import { execSync } from 'node:child_process';
import knex from 'knex';
import { env } from '../../src/config/env';

// Runs once before the whole suite: provision the isolated test database
// and bring its schema up to date via the same migrations production uses.
export default async function globalSetup(): Promise<void> {
  const admin = knex({
    client: 'mysql2',
    connection: {
      host: env.DB_HOST,
      port: env.DB_PORT,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
    },
  });
  try {
    await admin.raw('CREATE DATABASE IF NOT EXISTS ??', [`${env.DB_NAME}_test`]);
  } finally {
    await admin.destroy();
  }

  execSync('npx knex migrate:latest --knexfile knexfile.ts --env test', { stdio: 'inherit' });
}
