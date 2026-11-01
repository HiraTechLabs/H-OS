import { PROBLEM_CONTENT_TYPE, ProblemCode } from '@h-os/contracts';
import { ForbiddenError } from '../errors.js';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { AppConfig } from '../config.js';

const SAFE_METHODS: readonly string[] = ['GET', 'HEAD', 'OPTIONS'];

/**
 * Baseline secure headers for the API (SEC-011). The API serves JSON only, so a strict set is
 * sufficient and no template engine or static asset rules are needed.
 */
export function securityHeadersMiddleware(
  _request: Request,
  response: Response,
  next: NextFunction,
): void {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Content-Security-Policy', "frame-ancestors 'none'");
  response.setHeader('Referrer-Policy', 'same-origin');
  next();
}

/**
 * Origins a state-changing request may arrive from: the API origin itself and the configured
 * CORS allowlist. Same-origin callers do not send an Origin header, and cross-origin callers
 * must be allowlisted (SEC-011). SameSite cookies and this check together close the form-based
 * CSRF path that SameSite alone does not cover.
 */
export function csrfAllowedOrigins(config: AppConfig): readonly string[] {
  const permitted = new Set<string>();
  try {
    permitted.add(new URL(config.apiBaseUrl).origin);
  } catch {
    // apiBaseUrl is validated by the boot schema; an invalid value fails start-up anyway.
  }
  for (const origin of config.corsOrigins) {
    try {
      permitted.add(new URL(origin).origin);
    } catch {
      // Ignore unparsable entries: an allowlist must never become permissive by accident.
    }
  }
  return [...permitted];
}

export function createCsrfOriginGuard(config: AppConfig): RequestHandler {
  const permitted = new Set(csrfAllowedOrigins(config));

  return (request: Request, response: Response, next: NextFunction): void => {
    if (SAFE_METHODS.includes(request.method.toUpperCase())) {
      next();
      return;
    }
    const origin = request.headers.origin;
    if (typeof origin !== 'string' || origin.length === 0 || permitted.has(origin)) {
      next();
      return;
    }

    const error = new ForbiddenError('The request origin is not allowed for this method.');
    response
      .status(error.status)
      .type(PROBLEM_CONTENT_TYPE)
      .json({
        type: `https://h-os.local/problems/${ProblemCode.FORBIDDEN}`,
        title: 'Forbidden',
        status: 403,
        detail: error.message,
        code: ProblemCode.FORBIDDEN,
        instance: request.url,
      });
  };
}
