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
    connectTimeout: env.DB_CONNECT_TIMEOUT_MS,
    ...(env.DB_SSL
      ? {
          ssl: {
            rejectUnauthorized: true,
            ...(env.DB_SSL_CA
              ? { ca: Buffer.from(env.DB_SSL_CA, 'base64').toString('utf8') }
              : {}),
          },
        }
      : {}),
  },
  pool: {
    min: env.DB_POOL_MIN,
    max: env.DB_POOL_MAX,
  },
  acquireConnectionTimeout: env.DB_CONNECT_TIMEOUT_MS,
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
