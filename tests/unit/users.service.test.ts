import bcrypt from 'bcrypt';
import type { Knex } from 'knex';
import { UsersService } from '../../src/modules/users/users.service';
import { AppError } from '../../src/shared/errors/app-error';

const input = {
  email: 'ada@example.com',
  phone: '+2348012345678',
  bvn: '12345678901',
  password: 'correct-horse-9',
  first_name: 'Ada',
  last_name: 'Obi',
};

function buildService() {
  const usersRepository = {
    findByAnyIdentity: jest.fn().mockResolvedValue(undefined),
    create: jest.fn().mockResolvedValue(undefined),
  };
  const walletsRepository = {
    create: jest.fn().mockResolvedValue(undefined),
  };
  const tokenService = {
    sign: jest.fn().mockReturnValue('signed.jwt.token'),
  };
  const fakeTrx = {} as Knex.Transaction;
  const db = {
    transaction: jest.fn(async (cb: (trx: Knex.Transaction) => Promise<void>) => cb(fakeTrx)),
  };

  const service = new UsersService(
    db as unknown as Knex,
    usersRepository as never,
    walletsRepository as never,
    tokenService as never,
  );
  return { service, usersRepository, walletsRepository, tokenService, db, fakeTrx };
}

describe('UsersService.signUp', () => {
  it('creates the user and wallet atomically and returns a token', async () => {
    const { service, usersRepository, walletsRepository, db, fakeTrx } = buildService();

    const result = await service.signUp(input);

    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(usersRepository.create).toHaveBeenCalledWith(expect.any(Object), fakeTrx);
    expect(walletsRepository.create).toHaveBeenCalledWith(
      { id: result.wallet.id, user_id: result.user.id },
      fakeTrx,
    );
    expect(result.wallet).toMatchObject({ balance: 0, currency: 'NGN', status: 'active' });
    expect(result.token).toBe('signed.jwt.token');
  });

  it('stores a bcrypt hash, never the plaintext password', async () => {
    const { service, usersRepository } = buildService();

    await service.signUp(input);

    const createdRow = usersRepository.create.mock.calls[0]?.[0] as { password_hash: string };
    expect(createdRow.password_hash).not.toBe(input.password);
    await expect(bcrypt.compare(input.password, createdRow.password_hash)).resolves.toBe(true);
  });

  it('never exposes password_hash or bvn in the response', async () => {
    const { service } = buildService();

    const result = await service.signUp(input);

    expect(result.user).not.toHaveProperty('password_hash');
    expect(result.user).not.toHaveProperty('bvn');
  });

  it('rejects with 409 when email, phone or bvn already exists', async () => {
    const { service, usersRepository, db } = buildService();
    usersRepository.findByAnyIdentity.mockResolvedValue({ id: 'existing-user' });

    await expect(service.signUp(input)).rejects.toMatchObject({
      httpStatus: 409,
      code: 'USER_ALREADY_EXISTS',
    });
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it('maps a duplicate-key race during insert to the same 409', async () => {
    const { service, usersRepository } = buildService();
    usersRepository.create.mockRejectedValue(Object.assign(new Error(), { code: 'ER_DUP_ENTRY' }));

    await expect(service.signUp(input)).rejects.toMatchObject({
      httpStatus: 409,
      code: 'USER_ALREADY_EXISTS',
    });
  });

  it('rethrows unexpected database errors untouched', async () => {
    const { service, usersRepository } = buildService();
    usersRepository.create.mockRejectedValue(new Error('connection lost'));

    await expect(service.signUp(input)).rejects.toThrow('connection lost');
    await expect(service.signUp(input)).rejects.not.toBeInstanceOf(AppError);
  });
});
