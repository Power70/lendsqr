import type { AdjutorClient } from '../../src/modules/karma/adjutor.client';
import { KarmaService } from '../../src/modules/karma/karma.service';

const identities = {
  bvn: '12345678901',
  email: 'ada@example.com',
  phone: '+2348012345678',
};

function buildService(lookupKarma: jest.Mock) {
  return {
    service: new KarmaService({ lookupKarma } as unknown as AdjutorClient),
    lookupKarma,
  };
}

describe('KarmaService.assertNotBlacklisted', () => {
  it('resolves when every identity is clear', async () => {
    const { service, lookupKarma } = buildService(jest.fn().mockResolvedValue('clear'));

    await expect(service.assertNotBlacklisted(identities)).resolves.toBeUndefined();
    expect(lookupKarma.mock.calls.map(([id]) => id)).toEqual([
      identities.bvn,
      identities.email,
      identities.phone,
    ]);
  });

  it('rejects 403 on a BVN hit without checking further identities', async () => {
    const { service, lookupKarma } = buildService(jest.fn().mockResolvedValue('found'));

    await expect(service.assertNotBlacklisted(identities)).rejects.toMatchObject({
      httpStatus: 403,
      code: 'USER_BLACKLISTED',
    });
    expect(lookupKarma).toHaveBeenCalledTimes(1);
  });

  it('rejects 403 on a hit for a later identity', async () => {
    const { service } = buildService(
      jest.fn().mockResolvedValueOnce('clear').mockResolvedValueOnce('found'),
    );

    await expect(service.assertNotBlacklisted(identities)).rejects.toMatchObject({
      code: 'USER_BLACKLISTED',
    });
  });

  it('fails closed with 503 when a lookup cannot be completed', async () => {
    const { service } = buildService(
      jest
        .fn()
        .mockResolvedValueOnce('clear')
        .mockRejectedValueOnce(new Error('adjutor down'))
        .mockResolvedValueOnce('clear'),
    );

    await expect(service.assertNotBlacklisted(identities)).rejects.toMatchObject({
      httpStatus: 503,
      code: 'KARMA_CHECK_UNAVAILABLE',
    });
  });

  it('still rejects 403 when an earlier lookup failed but a later identity is a hit', async () => {
    const { service } = buildService(
      jest
        .fn()
        .mockRejectedValueOnce(new Error('adjutor down'))
        .mockResolvedValueOnce('found'),
    );

    await expect(service.assertNotBlacklisted(identities)).rejects.toMatchObject({
      code: 'USER_BLACKLISTED',
    });
  });
});
