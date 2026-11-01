import argon2 from 'argon2';

/**
 * Authentication sits behind an interface so a local provider can be replaced by OIDC without
 * touching callers (SEC-006, STK-005).
 */
export interface AuthProvider {
  hash(plain: string): Promise<string>;
  verify(hash: string, plain: string): Promise<boolean>;
}

/** argon2id with the OWASP-recommended interactive parameters. */
const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export class LocalAuthProvider implements AuthProvider {
  async hash(plain: string): Promise<string> {
    return argon2.hash(plain, ARGON2_OPTIONS);
  }

  async verify(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      // A malformed hash must never authenticate anybody, and the reason is not disclosed.
      return false;
    }
  }
}

export const AUTH_PROVIDER = Symbol('H_OS_AUTH_PROVIDER');
