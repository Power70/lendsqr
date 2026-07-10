import knex, { Knex } from 'knex';
import { env } from '../config/env';
import knexConfig from '../config/knexfile';

export const db: Knex = knex(knexConfig[env.NODE_ENV]);
