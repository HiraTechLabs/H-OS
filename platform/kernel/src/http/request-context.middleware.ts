import type { NextFunction, Response } from 'express';
import { randomUUID } from 'node:crypto';
import type { AuthenticatedRequest } from '../auth/auth.guard.js';
import { runWithRequestContext } from './request-context.js';

const REQUEST_ID_HEADER = 'x-request-id';
const TRACE_ID_HEADER = 'traceparent';

function traceIdFrom(header: string | undefined): string {
  if (!header) return randomUUID();
  // W3C traceparent: 00-<32 hex trace id>-<16 hex span id>-<flags>
  const parts = header.split('-');
  const traceId = parts[1];
  return traceId && /^[0-9a-f]{32}$/.test(traceId) ? traceId : randomUUID();
}

/** Every request carries a request ID and a trace ID (LOG-004). */
export function requestContextMiddleware(
  request: AuthenticatedRequest,
  response: Response,
  next: NextFunction,
): void {
  const requestId = request.header(REQUEST_ID_HEADER) ?? randomUUID();
  const traceId = traceIdFrom(request.header(TRACE_ID_HEADER));
  request.requestId = requestId;
  request.traceId = traceId;
  response.setHeader(REQUEST_ID_HEADER, requestId);
  runWithRequestContext({ requestId, traceId }, () => {
    next();
  });
}
