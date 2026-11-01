import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Field-level protection for identity numbers, passports and bank identifiers (SEC-008,
 * HHR-SEC-006). Values are encrypted with AES-256-GCM using a key from the environment; no
 * hand-rolled cryptography (SEC-006). A separate deterministic HMAC allows duplicate detection
 * without decrypting anything.
 */
export interface FieldCipher {
  /** Returns `v1.<iv>.<tag>.<ciphertext>` in base64url, all segments opaque. */
  encrypt(plain: string): string;
  decrypt(payload: string): string;
  /** Deterministic, non-reversible lookup hash used for uniqueness checks only. */
  lookupHash(plain: string): string;
}

const VERSION = 'v1';
const IV_BYTES = 12;
const KEY_BYTES = 32;

function decodeKey(raw: string): Buffer {
  const trimmed = raw.trim();
  const candidate = /^[0-9a-fA-F]{64}$/.test(trimmed)
    ? Buffer.from(trimmed, 'hex')
    : Buffer.from(trimmed, 'base64');
  if (candidate.length !== KEY_BYTES) {
    throw new Error(
      'FIELD_ENCRYPTION_KEY must decode to exactly 32 bytes (64 hex characters or base64).',
    );
  }
  return candidate;
}

export class AesGcmFieldCipher implements FieldCipher {
  private readonly encryptionKey: Buffer;
  private readonly lookupKey: Buffer;

  constructor(key: Buffer) {
    if (key.length !== KEY_BYTES) {
      throw new Error('Field encryption key must be 32 bytes.');
    }
    this.encryptionKey = key;
    // Derivation is deterministic so the lookup hash is stable across restarts.
    this.lookupKey = createHmac('sha256', key).update('h-os:field-lookup:v1').digest();
  }

  encrypt(plain: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [VERSION, iv.toString('base64url'), tag.toString('base64url'), ciphertext.toString('base64url')].join(
      '.',
    );
  }

  decrypt(payload: string): string {
    const parts = payload.split('.');
    if (parts.length !== 4 || parts[0] !== VERSION) {
      throw new Error('Unsupported encrypted field format.');
    }
    const [, ivPart, tagPart, dataPart] = parts;
    if (!ivPart || !tagPart || !dataPart) {
      throw new Error('Malformed encrypted field.');
    }
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.encryptionKey,
      Buffer.from(ivPart, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(dataPart, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }

  lookupHash(plain: string): string {
    return createHmac('sha256', this.lookupKey).update(plain.trim().toLowerCase()).digest('hex');
  }
}

export function createFieldCipherFromEnv(
  env: NodeJS.ProcessEnv = process.env,
  createKey: () => Buffer = () => randomBytes(KEY_BYTES),
): FieldCipher {
  const raw = env.FIELD_ENCRYPTION_KEY;
  if (!raw || raw.trim().length === 0) {
    if (env.NODE_ENV === 'production') {
      throw new Error('FIELD_ENCRYPTION_KEY is required in production.');
    }
    // Development convenience only: a process-local key. Values encrypted with it cannot be read
    // after a restart, which would surface immediately as a decryption failure rather than a
    // silent security downgrade. Production always requires an explicit key.
    return new AesGcmFieldCipher(createKey());
  }
  return new AesGcmFieldCipher(decodeKey(raw));
}

/** Constant-time comparison for token-like values. */
export function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
