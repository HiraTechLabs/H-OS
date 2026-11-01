import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { AuthController } from '../../src/auth/auth.controller.js';
import { RateLimitedError, UnauthenticatedError } from '@h-os/kernel';
import type { AppConfig } from '@h-os/kernel';

const config = {
  nodeEnv: 'test',
  port: 3000,
  apiBaseUrl: 'http://127.0.0.1:3000/api/v1',
  databaseUrl: 'postgres://localhost:1/db',
  corsOrigins: [],
  sessionSecret: 'unit-test-session-secret-at-least-32-chars',
  sessionTtlMinutes: 480,
  sessionIdleTimeoutMinutes: 120,
  loginRateLimit: 3,
  logLevel: 'silent',
  bootstrapAdmin: { email: 'admin@h-os.local', password: 'ChangeThis-Local-Dev-Only-1' },
  organization: { code: 'HOS', nameEn: 'H', nameAr: 'H', timeZone: 'UTC' },
} as Readonly<AppConfig>;

describe('AuthController login rate limiting', () => {
  it('blocks the nth attempt from one source before credentials are even checked', async () => {
    const authenticate = vi.fn(() => Promise.reject(new UnauthenticatedError('no')));
    const sessions = { authenticate, resolve: vi.fn() } as never;
    const controller = new AuthController(sessions, config);
    const request = { ip: '203.0.113.9', headers: {} } as never;
    const response = { cookie: vi.fn(), clearCookie: vi.fn() } as never;
    const credentials = { email: 'admin@h-os.local', password: 'whatever' };

    // The limiter is checked before authentication, so the attempt beyond the limit must be
    // refused without another (deliberately expensive) password computation: three attempts are
    // allowed, the fourth is blocked.
    await expect(controller.login(request, credentials, response)).rejects.toBeInstanceOf(
      UnauthenticatedError,
    );
    await expect(controller.login(request, credentials, response)).rejects.toBeInstanceOf(
      UnauthenticatedError,
    );
    await expect(controller.login(request, credentials, response)).rejects.toBeInstanceOf(
      UnauthenticatedError,
    );
    expect(authenticate).toHaveBeenCalledTimes(3);

    await expect(controller.login(request, credentials, response)).rejects.toBeInstanceOf(
      RateLimitedError,
    );
    expect(authenticate).toHaveBeenCalledTimes(3);
  });

  it('tracks source addresses independently', async () => {
    const authenticate = vi.fn(() => Promise.reject(new UnauthenticatedError('no')));
    const sessions = { authenticate, resolve: vi.fn() } as never;
    const controller = new AuthController(sessions, config);
    const blocked = { ip: '203.0.113.10', headers: {} } as never;
    const other = { ip: '203.0.113.11', headers: {} } as never;
    const response = { cookie: vi.fn(), clearCookie: vi.fn() } as never;
    const credentials = { email: 'admin@h-os.local', password: 'whatever' };

    await expect(controller.login(blocked, credentials, response)).rejects.toBeInstanceOf(
      UnauthenticatedError,
    );
    await expect(controller.login(blocked, credentials, response)).rejects.toBeInstanceOf(
      UnauthenticatedError,
    );
    await expect(controller.login(blocked, credentials, response)).rejects.toBeInstanceOf(
      UnauthenticatedError,
    );
    await expect(controller.login(blocked, credentials, response)).rejects.toBeInstanceOf(
      RateLimitedError,
    );
    await expect(controller.login(other, credentials, response)).rejects.toBeInstanceOf(
      UnauthenticatedError,
    );
  });
});
