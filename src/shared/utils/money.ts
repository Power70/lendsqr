import { z } from 'zod';

// All monetary amounts are integers in kobo (minor units)
export const MIN_TRANSACTION_AMOUNT_KOBO = 100;

// ₦100m cap per request — bounds both abuse and JS safe-integer arithmetic
export const MAX_TRANSACTION_AMOUNT_KOBO = 10_000_000_000;

// One source of truth for every money endpoint's amount and narration rules
export const amountSchema = z
  .number()
  .int('amount must be an integer in kobo')
  .min(MIN_TRANSACTION_AMOUNT_KOBO)
  .max(MAX_TRANSACTION_AMOUNT_KOBO);

export const narrationSchema = z.string().trim().min(1).max(255);
