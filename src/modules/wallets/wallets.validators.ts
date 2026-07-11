import { z } from 'zod';
import { amountSchema, narrationSchema } from '../../shared/utils/money';

export const fundWalletSchema = z.object({
  amount: amountSchema,
  narration: narrationSchema.optional(),
});

export const withdrawSchema = z.object({
  amount: amountSchema,
  bank_code: z.string().regex(/^\d{3,6}$/, 'must be a 3-6 digit bank code'),
  account_number: z.string().regex(/^\d{10}$/, 'must be a 10-digit NUBAN'),
  narration: narrationSchema.optional(),
});

export type FundWalletInput = z.infer<typeof fundWalletSchema>;
export type WithdrawInput = z.infer<typeof withdrawSchema>;
