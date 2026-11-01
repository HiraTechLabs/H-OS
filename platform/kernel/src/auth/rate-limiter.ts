import { RateLimitedError } from '../errors.js';

/**
 * Fixed-window in-process rate limiter for hot, unauthenticated endpoints (SEC-011). It bounds
 * network-level abuse against a single process; per-account lockout adds the second layer in
 * `SessionService`. As a single-process limiter it resets on restart — that is a stated
 * limitation, not a distributed-traffic control.
 */
export interface RateLimiterClock {
  now(): number;
}

export class FixedWindowRateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly clock: RateLimiterClock = { now: () => Date.now() },
  ) {}

  /**
   * Records one hit for `key` and throws `RateLimitedError` when the fixed window is exhausted.
   * The check and the increment are the same operation, so concurrent callers cannot exceed the
   * limit by racing the counter.
   */
  hit(key: string): void {
    const now = this.clock.now();
    this.prune(now);

    const windowStart = Math.floor(now / this.windowMs) * this.windowMs;
    const hits = this.hits.get(key) ?? [];
    const inWindow = hits.filter((at) => at >= windowStart);
    if (inWindow.length >= this.limit) {
      this.hits.set(key, inWindow);
      throw new RateLimitedError();
    }
    inWindow.push(now);
    this.hits.set(key, inWindow);
  }

  /** Test and operator escape hatch: clears the window of one key, or all keys. */
  reset(key?: string): void {
    if (key === undefined) {
      this.hits.clear();
      return;
    }
    this.hits.delete(key);
  }

  private prune(now: number): void {
    for (const [key, hits] of this.hits) {
      if (!hits.some((at) => now - at < this.windowMs)) {
        this.hits.delete(key);
      }
    }
  }
}
