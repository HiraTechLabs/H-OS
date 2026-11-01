import { describe, expect, it } from 'vitest';
import {
  AesGcmFieldCipher,
  createFieldCipherFromEnv,
  safeEqual,
} from '../../src/infrastructure/field-cipher.js';

const KEY = Buffer.from(
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  'hex',
);
const OTHER_KEY = Buffer.from(
  'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210',
  'hex',
);

describe('field cipher', () => {
  it('round-trips plain values including Arabic text', () => {
    const cipher = new AesGcmFieldCipher(KEY);
    for (const value of ['1234567890', 'A1234567', 'سارة علي', 'x'.repeat(2000)]) {
      const payload = cipher.encrypt(value);
      expect(payload).not.toContain(value);
      expect(cipher.decrypt(payload)).toBe(value);
    }
  });

  it('uses a fresh IV so the same value encrypts differently every time', () => {
    const cipher = new AesGcmFieldCipher(KEY);
    const first = cipher.encrypt('1234567890');
    const second = cipher.encrypt('1234567890');
    expect(first).not.toBe(second);
    expect(first.split('.')[0]).toBe('v1');
    expect(first.split('.')).toHaveLength(4);
  });

  it('produces a deterministic, normalised lookup hash', () => {
    const cipher = new AesGcmFieldCipher(KEY);
    expect(cipher.lookupHash(' 1234567890 ')).toBe(cipher.lookupHash('1234567890'));
    expect(new AesGcmFieldCipher(KEY).lookupHash('1234567890')).toBe(
      cipher.lookupHash('1234567890'),
    );
    expect(cipher.lookupHash('1234567890')).not.toBe(cipher.lookupHash('1234567891'));
    expect(cipher.lookupHash('1234567890')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('detects tampering with the authentication tag or ciphertext', () => {
    const cipher = new AesGcmFieldCipher(KEY);
    const payload = cipher.encrypt('1234567890');
    const [version, iv, tag, data] = payload.split('.');
    const tamper = (part: string): string => {
      const bytes = Buffer.from(part ?? '', 'base64url');
      bytes[0] = (bytes[0] ?? 0) ^ 0x01;
      return bytes.toString('base64url');
    };
    expect(() => cipher.decrypt([version, iv, tamper(tag ?? ''), data].join('.'))).toThrow();
    expect(() => cipher.decrypt([version, iv, tag, tamper(data ?? '')].join('.'))).toThrow();
    expect(() => cipher.decrypt('not-a-payload')).toThrow(/format/i);
    expect(() => cipher.decrypt('v2.a.b.c')).toThrow(/format/i);
  });

  it('cannot decrypt with a different key', () => {
    const payload = new AesGcmFieldCipher(KEY).encrypt('1234567890');
    expect(() => new AesGcmFieldCipher(OTHER_KEY).decrypt(payload)).toThrow();
  });

  it('refuses a key that is not exactly 32 bytes', () => {
    expect(() => new AesGcmFieldCipher(Buffer.alloc(16))).toThrow(/32 bytes/);
    expect(() => createFieldCipherFromEnv({ FIELD_ENCRYPTION_KEY: 'short' })).toThrow(/32 bytes/);
  });

  it('requires an explicit key in production', () => {
    expect(() => createFieldCipherFromEnv({ NODE_ENV: 'production' })).toThrow(
      /FIELD_ENCRYPTION_KEY is required/,
    );
  });

  it('accepts 64 hex characters and base64 keys', () => {
    const fromHex = createFieldCipherFromEnv({ FIELD_ENCRYPTION_KEY: KEY.toString('hex') });
    const fromBase64 = createFieldCipherFromEnv({ FIELD_ENCRYPTION_KEY: KEY.toString('base64') });
    const payload = fromHex.encrypt('secret-value');
    expect(fromBase64.decrypt(payload)).toBe('secret-value');
  });

  it('uses an ephemeral development key when none is configured', () => {
    const first = createFieldCipherFromEnv({ NODE_ENV: 'development' });
    const second = createFieldCipherFromEnv({ NODE_ENV: 'development' });
    expect(() => second.decrypt(first.encrypt('value'))).toThrow();
  });

  it('compares token-like values in constant time and without length leaks', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });
});
