import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import type { TransactionRunner } from '../../database/with-transaction';
import { AppError } from '../../shared/errors/app-error';
import { isDuplicateEntry } from '../../shared/utils/db-errors';
import type { TokenService } from '../auth/token.service';
import type { KarmaService } from '../karma/karma.service';
import type { WalletRepository } from '../wallets/wallets.repository';
import type { WalletStatus } from '../wallets/wallets.types';
import { toPublicUser, type PublicUser } from './users.types';
import type { UserRepository } from './users.repository';
import type { CreateUserInput } from './users.validators';

const BCRYPT_COST = 12;

export interface SignUpResult {
  user: PublicUser;
  wallet: { id: string; balance: number; currency: string; status: WalletStatus };
  token: string;
}

export class UsersService {
  constructor(
    private readonly runTransaction: TransactionRunner,
    private readonly usersRepository: UserRepository,
    private readonly walletsRepository: WalletRepository,
    private readonly tokenService: TokenService,
    private readonly karmaService: KarmaService,
  ) {}

  async signUp(input: CreateUserInput): Promise<SignUpResult> {
    const duplicateError = AppError.conflict(
      'USER_ALREADY_EXISTS',
      'An account with this email, phone or BVN already exists',
    );

    const existing = await this.usersRepository.findByAnyIdentity(
      input.email,
      input.phone,
      input.bvn,
    );
    if (existing) {
      throw duplicateError;
    }

    // Duplicates are rejected first so doomed signups never spend Adjutor quota
    await this.karmaService.assertNotBlacklisted({
      bvn: input.bvn,
      email: input.email,
      phone: input.phone,
    });

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);
    const userId = randomUUID();
    const walletId = randomUUID();
    const newUser = {
      id: userId,
      email: input.email,
      phone: input.phone,
      bvn: input.bvn,
      password_hash: passwordHash,
      first_name: input.first_name,
      last_name: input.last_name,
    };

    try {
      // Atomic pair: a user without a wallet (or vice versa) must not exist
      await this.runTransaction(async (trx) => {
        await this.usersRepository.create(newUser, trx);
        await this.walletsRepository.create({ id: walletId, user_id: userId }, trx);
      });
    } catch (err) {
      // Concurrent signups can both pass the pre-check; unique constraints win the race
      if (isDuplicateEntry(err)) {
        throw duplicateError;
      }
      throw err;
    }

    return {
      user: toPublicUser(newUser),
      wallet: { id: walletId, balance: 0, currency: 'NGN', status: 'active' },
      token: this.tokenService.sign(userId),
    };
  }
}
