import {
  Catch,
  HttpException,
  Inject,
  Logger,
} from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { ZodError } from 'zod';
import type { Response } from 'express';
import { PROBLEM_CONTENT_TYPE } from '@h-os/contracts';
import type { ProblemDetail } from '@h-os/contracts';
import { CONFIG } from '../config.js';
import type { AppConfig } from '../config.js';
import { AppError } from '../errors.js';
import { currentRequestContext } from './request-context.js';
import type { AuthenticatedRequest } from '../auth/auth.guard.js';

const TITLES: Readonly<Record<number, string>> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  412: 'Precondition Failed',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  501: 'Not Implemented',
};

/**
 * Maps every failure to RFC 9457 problem+json (STK-007). Unexpected errors are logged with the
 * trace ID and answered with a generic message: internals and personal data never leak (SEC-008).
 */
@Catch()
export class ProblemFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemFilter.name);

  constructor(@Inject(CONFIG) private readonly config: AppConfig) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<AuthenticatedRequest>();
    const problem = this.toProblem(exception, request);

    if (problem.status >= 500) {
      this.logger.error({
        event: 'http.error',
        status: problem.status,
        code: problem.code,
        traceId: problem.requestId,
        path: request.url,
        errorName: exception instanceof Error ? exception.name : typeof exception,
        // Diagnostic detail is available outside production only: messages can contain SQL or
        // personal data and must never be emitted by a production deployment (SEC-008, LOG-003).
        ...(this.config.nodeEnv === 'production'
          ? {}
          : { errorMessage: exception instanceof Error ? exception.message : String(exception) }),
      });
    }

    response.status(problem.status).type(PROBLEM_CONTENT_TYPE).json(problem);
  }

  private toProblem(exception: unknown, request: AuthenticatedRequest): ProblemDetail {
    const context = currentRequestContext();
    const requestId = context?.requestId ?? 'unknown';
    const instance = request?.url;

    if (exception instanceof AppError) {
      return {
        type: `https://h-os.local/problems/${exception.code}`,
        title: TITLES[exception.status] ?? 'Error',
        status: exception.status,
        detail: exception.message,
        code: exception.code,
        instance,
        requestId,
        ...(exception.details ? { errors: [...exception.details] } : {}),
      };
    }

    if (exception instanceof ZodError) {
      return {
        type: 'https://h-os.local/problems/validation_failed',
        title: TITLES[400] ?? 'Bad Request',
        status: 400,
        detail: 'The request contains invalid values.',
        code: 'validation_failed',
        instance,
        requestId,
        errors: exception.issues.map((issue) => ({
          field: issue.path.join('.') || '(root)',
          code: issue.code,
          message: issue.message,
        })),
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      return {
        type: `https://h-os.local/problems/http_${status}`,
        title: TITLES[status] ?? 'Error',
        status,
        detail: status >= 500 ? 'An unexpected error occurred.' : exception.message,
        code: status >= 500 ? 'internal_error' : `http_${status}`,
        instance,
        requestId,
      };
    }

    return {
      type: 'https://h-os.local/problems/internal_error',
      title: TITLES[500] ?? 'Internal Server Error',
      status: 500,
      detail: 'An unexpected error occurred.',
      code: 'internal_error',
      instance,
      requestId,
    };
  }
}
