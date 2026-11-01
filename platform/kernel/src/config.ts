import { z } from 'zod';

/**
 * Runtime configuration is validated at boot and the process fails fast (STK-003).
 * No configuration value is hardcoded anywhere else in the codebase.
 */
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  API_BASE_URL: z.url(),
  DATABASE_URL: z.string().min(1),
  CORS_ORIGINS: z
    .string()
    .default('')
    .transform((value) =>
      value
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0),
    ),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  SESSION_TTL_MINUTES: z.coerce.number().int().min(1).max(60 * 24 * 30).default(480),
  SESSION_IDLE_TIMEOUT_MINUTES: z.coerce.number().int().min(1).max(60 * 24).default(120),
  LOGIN_RATE_LIMIT: z.coerce.number().int().min(1).max(1000).default(20),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  BOOTSTRAP_ADMIN_EMAIL: z.email(),
  BOOTSTRAP_ADMIN_PASSWORD: z.string().min(12).max(256),
  ORGANIZATION_CODE: z.string().min(2).max(32),
  ORGANIZATION_NAME_EN: z.string().min(1).max(200),
  ORGANIZATION_NAME_AR: z.string().min(1).max(200),
  ORGANIZATION_TIMEZONE: z.string().min(1).max(64),
});

export type AppConfig = Readonly<{
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  apiBaseUrl: string;
  databaseUrl: string;
  corsOrigins: readonly string[];
  sessionSecret: string;
  sessionTtlMinutes: number;
  sessionIdleTimeoutMinutes: number;
  /** Failed login attempts tolerated per source address per minute (SEC-011). */
  loginRateLimit: number;
  logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';
  bootstrapAdmin: { email: string; password: string };
  organization: { code: string; nameEn: string; nameAr: string; timeZone: string };
}>;

export class ConfigurationError extends Error {
  constructor(readonly issues: readonly string[]) {
    super(`Invalid configuration:\n${issues.join('\n')}`);
    this.name = 'ConfigurationError';
  }
}

export function loadConfig(env: NodeJS.ProcessEnv): AppConfig {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    throw new ConfigurationError(
      parsed.error.issues.map((issue) => `  ${issue.path.join('.')}: ${issue.message}`),
    );
  }
  const value = parsed.data;
  return Object.freeze({
    nodeEnv: value.NODE_ENV,
    port: value.PORT,
    apiBaseUrl: value.API_BASE_URL,
    databaseUrl: value.DATABASE_URL,
    corsOrigins: Object.freeze(value.CORS_ORIGINS),
    sessionSecret: value.SESSION_SECRET,
    sessionTtlMinutes: value.SESSION_TTL_MINUTES,
    sessionIdleTimeoutMinutes: value.SESSION_IDLE_TIMEOUT_MINUTES,
    loginRateLimit: value.LOGIN_RATE_LIMIT,
    logLevel: value.LOG_LEVEL,
    bootstrapAdmin: Object.freeze({
      email: value.BOOTSTRAP_ADMIN_EMAIL,
      password: value.BOOTSTRAP_ADMIN_PASSWORD,
    }),
    organization: Object.freeze({
      code: value.ORGANIZATION_CODE,
      nameEn: value.ORGANIZATION_NAME_EN,
      nameAr: value.ORGANIZATION_NAME_AR,
      timeZone: value.ORGANIZATION_TIMEZONE,
    }),
  });
}

export const CONFIG = Symbol('H_OS_CONFIG');
