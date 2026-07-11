import type { Knex } from 'knex';
import { db } from './connection';

// Narrow seam services depend on instead of the whole Knex instance —
// unit tests inject a fake runner and never touch a database.
export type TransactionRunner = <T>(work: (trx: Knex.Transaction) => Promise<T>) => Promise<T>;

export const withTransaction: TransactionRunner = (work) => db.transaction(work);
