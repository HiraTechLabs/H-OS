import { z } from 'zod';

/** Opaque UUID identifier used by every H-OS entity. */
export const IdSchema = z.uuid();

export const LocaleSchema = z.enum(['en', 'ar']);
export type Locale = z.infer<typeof LocaleSchema>;

/** A value that must be rendered in the active locale. */
export const LocalizedTextSchema = z.strictObject({
  en: z.string().min(1).max(200),
  ar: z.string().min(1).max(200),
});
export type LocalizedText = z.infer<typeof LocalizedTextSchema>;

/** ISO-8601 calendar date (`YYYY-MM-DD`), business dates are never instants (BIZ-010). */
export const BusinessDateSchema = z.iso.date();
export type BusinessDate = z.infer<typeof BusinessDateSchema>;

/** ISO-8601 instant in UTC with an explicit offset. */
export const InstantSchema = z.iso.datetime({ offset: true });
export type Instant = z.infer<typeof InstantSchema>;

export const IanaTimeZoneSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z]+(?:\/[A-Za-z0-9_+-]+)*$/, 'Must be an IANA time zone identifier');

export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 25;

/** Keyset pagination request. Unbounded queries are forbidden (PERF-003). */
export const PageQuerySchema = z.strictObject({
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  cursor: z.string().max(512).optional(),
});
export type PageQuery = z.infer<typeof PageQuerySchema>;

export interface Page<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
}

const CursorSchema = z.strictObject({
  key: z.string().min(1).max(200),
  id: IdSchema,
});

/**
 * Base64url helpers implemented with web-standard globals so the same contract module runs
 * unchanged in the browser and on Node (no `Buffer` dependency).
 */
function encodeBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeBase64Url(value: string): string {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, '='));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new TextDecoder().decode(bytes);
}

export function encodeCursor(key: string, id: string): string {
  return encodeBase64Url(JSON.stringify({ key, id }));
}

export function decodeCursor(cursor: string): { key: string; id: string } {
  return CursorSchema.parse(JSON.parse(decodeBase64Url(cursor)));
}

/** Sort direction shared by list endpoints. */
export const SortDirectionSchema = z.enum(['asc', 'desc']);
export type SortDirection = z.infer<typeof SortDirectionSchema>;
