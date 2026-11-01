/**
 * Time and identifiers are injected so tests are deterministic (TEST-005).
 */
export interface Clock {
  /** Current instant. */
  now(): Date;
  /** Current calendar date in the given IANA time zone, as `YYYY-MM-DD`. */
  today(timeZone: string): string;
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }

  today(timeZone: string): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(this.now());
  }
}

export class FixedClock implements Clock {
  constructor(private current: Date) {}

  now(): Date {
    return new Date(this.current);
  }

  today(timeZone: string): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(this.current);
  }

  advance(milliseconds: number): void {
    this.current = new Date(this.current.getTime() + milliseconds);
  }
}

export interface IdGenerator {
  uuid(): string;
}

export class CryptoIdGenerator implements IdGenerator {
  uuid(): string {
    return globalThis.crypto.randomUUID();
  }
}

export const CLOCK = Symbol('H_OS_CLOCK');
export const ID_GENERATOR = Symbol('H_OS_ID_GENERATOR');
