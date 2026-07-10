import type { RequestHandler } from 'express';
import { tokenService, type TokenService } from '../modules/auth/token.service';
import { usersRepository, type UserRepository } from '../modules/users/users.repository';
import { AppError } from '../shared/errors/app-error';
import { asyncHandler } from '../shared/utils/async-handler';

// Factory so tests can inject fakes; the app uses the configured export below.
// The user is re-loaded per request: a token stays useless once the account
// is suspended or deleted, even before it expires.
export function createAuthenticate(
  users: UserRepository,
  tokens: TokenService,
): RequestHandler {
  return asyncHandler(async (req, _res, next) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw AppError.unauthorized('MISSING_TOKEN', 'Authorization bearer token is required');
    }

    const { userId } = tokens.verify(header.slice('Bearer '.length));

    const user = await users.findById(userId);
    if (!user) {
      throw AppError.unauthorized('INVALID_TOKEN', 'Token is invalid or expired');
    }
    if (user.status === 'suspended') {
      throw AppError.forbidden('ACCOUNT_SUSPENDED', 'This account has been suspended');
    }

    req.user = { id: user.id, status: user.status };
    next();
  });
}

export const authenticate = createAuthenticate(usersRepository, tokenService);
