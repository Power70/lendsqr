import { z } from 'zod';
import { amountSchema, narrationSchema } from '../../shared/utils/money';

export const transferSchema = z.object({
  recipient_wallet_id: z.uuid(),
  amount: amountSchema,
  narration: narrationSchema.optional(),
});

export const listTransactionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.coerce.number().int().positive().optional(),
});

export const referenceParamsSchema = z.object({
  reference: z.string().regex(/^TXN-\d{8}-[A-Z0-9]{8}$/, 'malformed transaction reference'),
});

export type TransferInput = z.infer<typeof transferSchema>;
export type ListTransactionsQuery = z.infer<typeof listTransactionsQuerySchema>;
