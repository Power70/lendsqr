import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { env } from '../../src/config/env';
import { createAuthenticate } from '../../src/middleware/authenticate';
import { errorHandler } from '../../src/middleware/error-handler';
import { TokenService } from '../../src/modules/auth/token.service';

const tokenService = new TokenService();

const activeUser = { id: 'user-1', status: 'active' as const };

function buildApp(findById: jest.Mock) {
  const app = express();
  const usersRepository = { findById };
  app.get(
    '/protected',
    createAuthenticate(usersRepository as never, tokenService),
    (req, res) => {
      res.json({ status: 'success', data: { user_id: req.user?.id } });
    },
  );
  app.use(errorHandler);
  return app;
}

describe('authenticate middleware', () => {
  it('accepts a valid token and attaches req.user', async () => {
    const app = buildApp(jest.fn().mockResolvedValue(activeUser));
    const token = tokenService.sign('user-1');

    const res = await request(app).get('/protected').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.user_id).toBe('user-1');
  });

  it('rejects a request with no Authorization header', async () => {
    const app = buildApp(jest.fn());

    const res = await request(app).get('/protected');

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('MISSING_TOKEN');
  });

  it('rejects a non-Bearer Authorization scheme', async () => {
    const app = buildApp(jest.fn());

    const res = await request(app).get('/protected').set('Authorization', 'Basic dXNlcjpwdw==');

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('MISSING_TOKEN');
  });

  it('rejects a tampered token', async () => {
    const app = buildApp(jest.fn());
    const token = tokenService.sign('user-1');

    const res = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${token.slice(0, -2)}xx`);

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_TOKEN');
  });

  it('rejects an expired token', async () => {
    const app = buildApp(jest.fn().mockResolvedValue(activeUser));
    const expired = jwt.sign({}, env.JWT_SECRET, { subject: 'user-1', expiresIn: '-1s' });

    const res = await request(app).get('/protected').set('Authorization', `Bearer ${expired}`);

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_TOKEN');
  });

  it('rejects a token signed with a different secret', async () => {
    const app = buildApp(jest.fn());
    const forged = jwt.sign({}, 'a'.repeat(32), { subject: 'user-1', expiresIn: '1h' });

    const res = await request(app).get('/protected').set('Authorization', `Bearer ${forged}`);

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_TOKEN');
  });

  it('rejects a valid token whose user no longer exists', async () => {
    const app = buildApp(jest.fn().mockResolvedValue(undefined));
    const token = tokenService.sign('deleted-user');

    const res = await request(app).get('/protected').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_TOKEN');
  });

  it('rejects a valid token for a suspended user', async () => {
    const app = buildApp(jest.fn().mockResolvedValue({ id: 'user-1', status: 'suspended' }));
    const token = tokenService.sign('user-1');

    const res = await request(app).get('/protected').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ACCOUNT_SUSPENDED');
  });
});
