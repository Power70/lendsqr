import type { Knex } from 'knex';
import { env, type Env } from './env';

const baseConfig: Knex.Config = {
  client: 'mysql2',
  connection: {
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
  },
  pool: {
    min: env.DB_POOL_MIN,
    max: env.DB_POOL_MAX,
  },
  // Bounded so a dead DB fails readiness checks fast instead of queueing
  acquireConnectionTimeout: 5000,
  migrations: {
    directory: './src/database/migrations',
    tableName: 'knex_migrations',
    extension: 'ts',
  },
  seeds: {
    directory: './src/database/seeds',
    extension: 'ts',
  },
};

const knexConfig: Record<Env['NODE_ENV'], Knex.Config> = {
  development: baseConfig,
  // Isolated database so integration tests can truncate tables freely
  test: {
    ...baseConfig,
    connection: { ...(baseConfig.connection as object), database: `${env.DB_NAME}_test` },
  },
  production: baseConfig,
};

export default knexConfig;
