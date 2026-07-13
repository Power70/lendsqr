import type { RequestHandler } from 'express';
import type { UserRole } from '../modules/users/users.types';
import { AppError } from '../shared/errors/app-error';

// Role gate. Runs AFTER `authenticate` (which loads the fresh role from the DB
// every request), so a demoted admin loses access immediately, not at token
// expiry. Missing `req.user` means the middleware order is wrong — a bug, not a
// client error, so it surfaces as a non-operational 500.
export function requireRole(...roles: UserRole[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) {
      next(new AppError(500, 'AUTHORIZE_REQUIRES_AUTH', 'authenticate must run first', false));
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(AppError.forbidden('FORBIDDEN', 'You do not have access to this resource'));
      return;
    }
    next();
  };
}

export const requireAdmin = requireRole('admin');
