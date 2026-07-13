import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(4000),
  API_BASE_URL: z.string().default('http://localhost:4000'),
  WEB_ORIGIN: z.string().default('http://localhost:5173'),
  MONGODB_URI: z.string().default('mongodb://127.0.0.1:27017/clinicos'),
  JWT_ACCESS_SECRET: z.string().min(16).default('dev-only-access-secret-change-me'),
  JWT_REFRESH_SECRET: z.string().min(16).default('dev-only-refresh-secret-change-me'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL: z.string().default('30d'),
  COOKIE_SECURE: z.coerce.boolean().default(false),
  REDIS_URL: z.string().optional(),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().default(300),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().default(10),
  LOCKOUT_MAX_ATTEMPTS: z.coerce.number().int().default(5),
  LOCKOUT_DURATION_MINUTES: z.coerce.number().int().default(15),
  /** Hours before an appointment's start time to send the SMS/WhatsApp reminder (apps/worker). */
  APPOINTMENT_REMINDER_HOURS_BEFORE: z.coerce.number().min(0).default(3),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';

if (
  isProd &&
  (env.JWT_ACCESS_SECRET.startsWith('dev-only') || env.JWT_REFRESH_SECRET.startsWith('dev-only'))
) {
  // eslint-disable-next-line no-console
  console.error('Refusing to start in production with default JWT secrets.');
  process.exit(1);
}
