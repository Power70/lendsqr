import 'dotenv/config';
import { z } from 'zod';

// A variable is only required here once code consumes it — required-but-unused
// vars would force placeholder secrets into every environment.
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().positive().default(3306),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  DB_NAME: z.string().min(1),
  DB_POOL_MIN: z.coerce.number().int().min(0).default(2),
  DB_POOL_MAX: z.coerce.number().int().positive().default(10),
  // Managed MySQL providers commonly require TLS
  DB_SSL: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  // Base64-encoded CA certificate (PEM). Providers like Aiven sign their
  // server certs with a private CA; supplying it keeps verification strict
  // instead of falling back to rejectUnauthorized:false.
  DB_SSL_CA: z.string().optional(),
  // Local Docker connects in milliseconds; a remote managed MySQL needs room
  // for the TCP + TLS handshake. Still bounded so a dead DB fails fast.
  DB_CONNECT_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('24h'),

  ADJUTOR_BASE_URL: z.url().default('https://adjutor.lendsqr.com/v2'),
  ADJUTOR_API_KEY: z.string().min(1),
  ADJUTOR_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    console.error(`Invalid environment configuration:\n${details}`);
    process.exit(1);
  }
  return parsed.data;
}

export const env = loadEnv();
