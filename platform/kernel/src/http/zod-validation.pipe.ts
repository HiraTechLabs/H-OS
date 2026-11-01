import type { PipeTransform } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import type { ZodType } from 'zod';
import { ValidationError } from '../errors.js';

/**
 * Validates and narrows all external input at the boundary with a schema; unknown fields are
 * rejected by the strict object schemas (SEC-004).
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform<unknown, unknown> {
  constructor(private readonly schema: ZodType) {}

  transform(value: unknown): unknown {
    const result = this.schema.safeParse(value);
    if (result.success) return result.data;
    throw new ValidationError(
      'The request contains invalid values.',
      result.error.issues.map((issue) => ({
        field: issue.path.join('.') || '(root)',
        code: issue.code,
        message: issue.message,
      })),
    );
  }
}
