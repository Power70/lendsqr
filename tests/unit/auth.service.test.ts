import bcrypt from 'bcrypt';
import { AuthService } from '../../src/modules/auth/auth.service';

const PASSWORD = 'correct-horse-9';

describe('AuthService.login', () => {
  let passwordHash: string;

  const user = () => ({
    id: 'user-1',
    email: 'ada@example.com',
    phone: '+2348012345678',
    bvn: '12345678901',
    password_hash: passwordHash,
    first_name: 'Ada',
    last_name: 'Obi',
    status: 'active' as const,
  });

  beforeAll(async () => {
    // Low cost keeps the fixture fast; the service only ever compares
    passwordHash = await bcrypt.hash(PASSWORD, 4);
  });

  function buildService(found: ReturnType<typeof user> | undefined) {
    const usersRepository = { findByEmail: jest.fn().mockResolvedValue(found) };
    const tokenService = { sign: jest.fn().mockReturnValue('signed.jwt.token') };
    const service = new AuthService(usersRepository as never, tokenService as never);
    return { service, tokenService };
  }

  it('returns a token and public user for valid credentials', async () => {
    const { service, tokenService } = buildService(user());

    const result = await service.login('ada@example.com', PASSWORD);

    expect(result.token).toBe('signed.jwt.token');
    expect(tokenService.sign).toHaveBeenCalledWith('user-1');
    expect(result.user).not.toHaveProperty('password_hash');
  });

  it('rejects an unknown email with the generic credentials error', async () => {
    const { service } = buildService(undefined);

    await expect(service.login('ghost@example.com', PASSWORD)).rejects.toMatchObject({
      httpStatus: 401,
      code: 'INVALID_CREDENTIALS',
    });
  });

  it('rejects a wrong password with the SAME error as unknown email', async () => {
    const { service } = buildService(user());

    await expect(service.login('ada@example.com', 'wrong-password')).rejects.toMatchObject({
      httpStatus: 401,
      code: 'INVALID_CREDENTIALS',
    });
  });

  it('rejects a suspended account even with correct credentials', async () => {
    const { service } = buildService({ ...user(), status: 'suspended' as never });

    await expect(service.login('ada@example.com', PASSWORD)).rejects.toMatchObject({
      httpStatus: 403,
      code: 'ACCOUNT_SUSPENDED',
    });
  });
});
