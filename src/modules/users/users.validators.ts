import { z } from 'zod';

export const createUserSchema = z.object({
  email: z.email().max(255),
  phone: z
    .string()
    .regex(/^\+234\d{10}$/, 'must be a Nigerian number in E.164 format, e.g. +2348012345678'),
  bvn: z.string().regex(/^\d{11}$/, 'must be exactly 11 digits'),
  // 72-byte cap is a bcrypt limit — longer input is silently truncated by the algorithm
  password: z.string().min(8, 'must be at least 8 characters').max(72),
  first_name: z.string().trim().min(2).max(100),
  last_name: z.string().trim().min(2).max(100),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
