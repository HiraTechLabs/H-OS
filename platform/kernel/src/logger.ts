import pino from 'pino';
import type { Logger as PinoLogger } from 'pino';

/**
 * Structured JSON logs through one shared logger (LOG-001). Redaction is configured here and
 * covered by a test (LOG-003); personal, payroll and credential data must never be logged.
 */
const REDACT_PATHS: readonly string[] = [
  'password',
  '*.password',
  'passwordHash',
  '*.passwordHash',
  'token',
  '*.token',
  'tokenHash',
  '*.tokenHash',
  'authorization',
  'req.headers.authorization',
  'req.headers.cookie',
  'cookie',
  'nationalId',
  '*.nationalId',
  'passportNumber',
  '*.passportNumber',
  'iban',
  '*.iban',
  'salary',
  '*.salary',
  'netAmount',
  '*.netAmount',
  'payload',
  '*.payload',
  'before',
  'after',
  '*.before',
  '*.after',
];

export type Logger = PinoLogger;

export function createLogger(level: string, service: string): Logger {
  return pino({
    level,
    base: { service },
    redact: { paths: [...REDACT_PATHS], censor: '[redacted]' },
    timestamp: pino.stdTimeFunctions.isoTime,
    messageKey: 'event',
    formatters: {
      level: (label) => ({ level: label }),
    },
  });
}
