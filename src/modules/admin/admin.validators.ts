import { z } from 'zod';

// Optional free-text justification stored on the audit record.
const reasonSchema = z.string().trim().min(1).max(500);

export const userIdParamsSchema = z.object({ id: z.uuid() });
export const walletIdParamsSchema = z.object({ id: z.uuid() });

export const updateUserStatusSchema = z.object({
  status: z.enum(['active', 'suspended']),
  reason: reasonSchema.optional(),
});

export const updateWalletStatusSchema = z.object({
  status: z.enum(['active', 'frozen']),
  reason: reasonSchema.optional(),
});

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['active', 'suspended']).optional(),
  role: z.enum(['customer', 'admin']).optional(),
  search: z.string().trim().min(1).max(100).optional(),
});

export const listAuditQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>;
export type UpdateWalletStatusInput = z.infer<typeof updateWalletStatusSchema>;
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
export type ListAuditQuery = z.infer<typeof listAuditQuerySchema>;
