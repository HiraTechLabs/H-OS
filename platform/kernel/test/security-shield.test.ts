import { describe, expect, it } from 'vitest';
import type { MockedRequest, MockedResponse } from './helpers/express-mocks.js';
import { createCsrfOriginGuard, csrfAllowedOrigins, securityHeadersMiddleware } from '../src/http/security.middleware.js';
import { FixedWindowRateLimiter } from '../src/auth/rate-limiter.js';
import { RateLimitedError } from '../src/errors.js';

function mockRequest(method: string, origin?: string): MockedRequest {
  return { method: method.toUpperCase(), headers: origin ? { origin } : {} };
}

function mockResponse(): MockedResponse {
  const headers: Record<string, string> = {};
  return {
    headers,
    setHeader: (name, value) => {
      // Express header names are case-insensitive; normalise so assertions on lowercase keys work.
      headers[name.toLowerCase()] = value;
      return headers;
    },
    statusCalls: [],
    status(code: number) {
      this.statusCalls.push(code);
      return this;
    },
    type() {
      return this;
    },
    json() {
      return this;
    },
  };
}

describe('security headers middleware', () => {
  it('sets nosniff, frame denial and referrer policy on every response', () => {
    const response = mockResponse();
    const next = (): void => undefined;

    securityHeadersMiddleware(mockRequest('GET'), response as never, next);

    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('DENY');
    expect(response.headers['content-security-policy']).toBe("frame-ancestors 'none'");
    expect(response.headers['referrer-policy']).toBe('same-origin');
  });
});

describe('CSRF origin guard', () => {
  const config = {
    apiBaseUrl: 'http://127.0.0.1:3000/api/v1',
    corsOrigins: ['https://app.example'] as readonly string[],
    nodeEnv: 'test' as const,
    port: 3000,
    databaseUrl: 'postgres://localhost:1/db',
    sessionSecret: 'x'.repeat(32),
    sessionTtlMinutes: 480,
    sessionIdleTimeoutMinutes: 120,
    loginRateLimit: 20,
    logLevel: 'silent' as const,
    bootstrapAdmin: { email: 'admin@h-os.local', password: 'ChangeThis-Local-Dev-Only-1' },
    organization: { code: 'HOS', nameEn: 'H', nameAr: 'H', timeZone: 'UTC' },
  };
  const guard = createCsrfOriginGuard(config);

  it('passes safe methods without checking the origin', () => {
    for (const method of ['get', 'head', 'options']) {
      const response = mockResponse();
      let called = false;
      guard(mockRequest(method), response as never, () => {
        called = true;
      });
      expect(called).toBe(true);
      expect(response.statusCalls).toHaveLength(0);
    }
  });

  it('passes state-changing requests without an Origin header (same-origin callers)', () => {
    const response = mockResponse();
    let called = false;
    guard(mockRequest('post'), response as never, () => {
      called = true;
    });
    expect(called).toBe(true);
  });

  it('passes state-changing requests from allowlisted origins', () => {
    const response = mockResponse();
    let called = false;
    guard(mockRequest('post', 'https://app.example'), response as never, () => {
      called = true;
    });
    expect(called).toBe(true);
    guard(mockRequest('post', 'http://127.0.0.1:3000'), response as never, () => {
      called = true;
    });
    expect(called).toBe(true);
  });

  it('rejects state-changing requests from unknown origins with a forbidden problem', () => {
    const response = mockResponse();
    let called = false;
    guard(mockRequest('patch', 'https://attacker.example'), response as never, () => {
      called = true;
    });
    expect(called).toBe(false);
    expect(response.statusCalls).toEqual([403]);
  });

  it('derives exactly one permitted origin per configured value', () => {
    const origins = csrfAllowedOrigins({
      ...config,
      corsOrigins: ['https://app.example/', 'not-a-url'],
    }).length;
    expect(origins).toBe(2);
  });
});

describe('FixedWindowRateLimiter', () => {
  function createLimiter(limit: number): {
    limiter: FixedWindowRateLimiter;
    now: { value: number };
  } {
    const now = { value: 0 };
    return {
      limiter: new FixedWindowRateLimiter(limit, 60_000, { now: () => now.value }),
      now,
    };
  }

  it('allows up to the limit inside one window, per key', () => {
    const { limiter } = createLimiter(3);
    expect(() => limiter.hit('ip-a')).not.toThrow();
    expect(() => limiter.hit('ip-a')).not.toThrow();
    expect(() => limiter.hit('ip-a')).not.toThrow();
    expect(() => limiter.hit('ip-a')).toThrow(RateLimitedError);
    expect(() => limiter.hit('ip-b')).not.toThrow();
  });

  it('starts a fresh window after the window elapses', () => {
    const { limiter, now } = createLimiter(2);
    limiter.hit('ip-a');
    limiter.hit('ip-a');
    expect(() => limiter.hit('ip-a')).toThrow(RateLimitedError);
    now.value = 61_000;
    expect(() => limiter.hit('ip-a')).not.toThrow();
  });

  it('reset clears one key without touching the others', () => {
    const { limiter } = createLimiter(1);
    limiter.hit('ip-a');
    expect(() => limiter.hit('ip-a')).toThrow(RateLimitedError);
    limiter.reset('ip-a');
    expect(() => limiter.hit('ip-a')).not.toThrow();
    expect(() => limiter.hit('ip-b')).not.toThrow();
    limiter.reset();
    expect(() => limiter.hit('ip-b')).not.toThrow();
  });
});
