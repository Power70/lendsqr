import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../../config/env';
import { AppError } from '../../shared/errors/app-error';

// Faux token auth: signed, expiring JWT carrying
// only the user id — no refresh tokens, rotation, or sessions.
export class TokenService {
  sign(userId: string): string {
    return jwt.sign({}, env.JWT_SECRET, {
      subject: userId,
      expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
    });
  }

  verify(token: string): { userId: string } {
    try {
      const payload = jwt.verify(token, env.JWT_SECRET);
      if (typeof payload === 'string' || typeof payload.sub !== 'string') {
        throw new Error('token has no subject');
      }
      return { userId: payload.sub };
    } catch {
      throw AppError.unauthorized('INVALID_TOKEN', 'Token is invalid or expired');
    }
  }
}

export const tokenService = new TokenService();
