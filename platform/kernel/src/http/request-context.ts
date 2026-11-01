import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
  readonly requestId: string;
  readonly traceId: string;
  readonly organizationId?: string;
  readonly accountId?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext<T>(context: RequestContext, callback: () => T): T {
  return storage.run(context, callback);
}

export function currentRequestContext(): RequestContext | undefined {
  return storage.getStore();
}

/** Trace IDs must propagate across modules, outbox events and jobs (LOG-004). */
export function currentTraceId(fallback: string): string {
  return storage.getStore()?.traceId ?? fallback;
}
