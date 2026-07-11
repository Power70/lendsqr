import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { AppError } from '../shared/errors/app-error';

type ValidationTarget = 'body' | 'query' | 'params';

// Parses and REPLACES the target: handlers only ever see validated, typed data
// with unknown keys stripped — never the raw client payload.
export function validate(schema: ZodType, target: ValidationTarget = 'body'): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req[target]);
    if (!result.success) {
      const message = result.error.issues
        .map((issue) => `${issue.path.join('.') || target}: ${issue.message}`)
        .join('; ');
      next(AppError.badRequest('VALIDATION_ERROR', message));
      return;
    }
    req[target] = result.data as never;
    next();
  };
}
