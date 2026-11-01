import { ProblemCode } from '@h-os/contracts';

/**
 * Expected failures are typed domain errors and are mapped to RFC 9457 at the HTTP boundary
 * (CODE-007). Messages are safe to display and never contain personal data (SEC-008).
 */
export abstract class AppError extends Error {
  protected constructor(
    readonly code: ProblemCode,
    readonly status: number,
    message: string,
    readonly details?: readonly { field: string; code: string; message: string }[],
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  constructor(
    message: string,
    details?: readonly { field: string; code: string; message: string }[],
  ) {
    super(ProblemCode.VALIDATION_FAILED, 400, message, details);
  }
}

export class UnauthenticatedError extends AppError {
  constructor(message = 'Authentication is required.') {
    super(ProblemCode.UNAUTHENTICATED, 401, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You are not allowed to perform this action.') {
    super(ProblemCode.FORBIDDEN, 403, message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'The requested record does not exist.') {
    super(ProblemCode.NOT_FOUND, 404, message);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'The request conflicts with the current state.') {
    super(ProblemCode.CONFLICT, 409, message);
  }
}

export class PreconditionFailedError extends AppError {
  constructor(message = 'The request cannot be applied to the current state.') {
    super(ProblemCode.PRECONDITION_FAILED, 412, message);
  }
}

export class RateLimitedError extends AppError {
  constructor(message = 'Too many attempts. Try again later.') {
    super(ProblemCode.RATE_LIMITED, 429, message);
  }
}

/** Raised when a downstream feature is intentionally not implemented yet. Never a fake success. */
export class IntegrationPendingError extends AppError {
  constructor(message = 'The downstream integration is not available yet.') {
    super(ProblemCode.INTEGRATION_PENDING, 501, message);
  }
}
