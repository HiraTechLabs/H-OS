import { z } from 'zod';

/**
 * RFC 9457 problem+json (STK-007). The `code` is a stable machine identifier; `detail` is
 * already localized by the server and safe to display.
 */
export const PROBLEM_CONTENT_TYPE = 'application/problem+json';

export const ProblemCode = {
  VALIDATION_FAILED: 'validation_failed',
  UNAUTHENTICATED: 'unauthenticated',
  FORBIDDEN: 'forbidden',
  NOT_FOUND: 'not_found',
  CONFLICT: 'conflict',
  PRECONDITION_FAILED: 'precondition_failed',
  RATE_LIMITED: 'rate_limited',
  INTERNAL: 'internal_error',
  INTEGRATION_PENDING: 'integration_pending',
} as const;

export type ProblemCode = (typeof ProblemCode)[keyof typeof ProblemCode];

export const ProblemDetailSchema = z.strictObject({
  type: z.string(),
  title: z.string(),
  status: z.number().int().min(400).max(599),
  detail: z.string(),
  code: z.string(),
  instance: z.string().optional(),
  requestId: z.string().optional(),
  errors: z
    .array(
      z.strictObject({
        field: z.string(),
        code: z.string(),
        message: z.string(),
      }),
    )
    .optional(),
});
export type ProblemDetail = z.infer<typeof ProblemDetailSchema>;
