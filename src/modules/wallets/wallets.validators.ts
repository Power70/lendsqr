import { z } from 'zod';
import {
  MAX_TRANSACTION_AMOUNT_KOBO,
  MIN_TRANSACTION_AMOUNT_KOBO,
} from '../../shared/utils/money';

export const fundWalletSchema = z.object({
  amount: z
    .number()
    .int('amount must be an integer in kobo')
    .min(MIN_TRANSACTION_AMOUNT_KOBO)
    .max(MAX_TRANSACTION_AMOUNT_KOBO),
  narration: z.string().trim().min(1).max(255).optional(),
});

export type FundWalletInput = z.infer<typeof fundWalletSchema>;
