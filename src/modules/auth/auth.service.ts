import bcrypt from 'bcrypt';
import { AppError } from '../../shared/errors/app-error';
import type { UserRepository } from '../users/users.repository';
import { toPublicUser, type PublicUser } from '../users/users.types';
import type { TokenService } from './token.service';

export class AuthService {
  constructor(
    private readonly usersRepository: UserRepository,
    private readonly tokenService: TokenService,
  ) {}

  async login(email: string, password: string): Promise<{ user: PublicUser; token: string }> {
    const user = await this.usersRepository.findByEmail(email);

    // Identical error for unknown email and wrong password — no account enumeration
    const invalidCredentials = AppError.unauthorized(
      'INVALID_CREDENTIALS',
      'Email or password is incorrect',
    );
    if (!user) {
      throw invalidCredentials;
    }
    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      throw invalidCredentials;
    }
    if (user.status === 'suspended') {
      throw AppError.forbidden('ACCOUNT_SUSPENDED', 'This account has been suspended');
    }

    return { user: toPublicUser(user), token: this.tokenService.sign(user.id) };
  }
}
