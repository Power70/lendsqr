import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { AppError } from '../shared/errors/app-error';

// Parses and REPLACES req.body: handlers only ever see validated, typed data
// with unknown keys stripped — never the raw client payload.
export function validate(schema: ZodType): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const message = result.error.issues
        .map((issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`)
        .join('; ');
      next(AppError.badRequest('VALIDATION_ERROR', message));
      return;
    }
    req.body = result.data;
    next();
  };
}
