import type { AxiosInstance } from 'axios';
import {
  AdjutorClient,
  AdjutorClientError,
  AdjutorUnavailableError,
} from '../../src/modules/karma/adjutor.client';

function buildClient() {
  const get = jest.fn();
  const sleep = jest.fn().mockResolvedValue(undefined);
  const client = new AdjutorClient({ get } as unknown as AxiosInstance, sleep);
  return { client, get, sleep };
}

const IDENTITY = '12345678901';

describe('AdjutorClient.lookupKarma', () => {
  it('returns found when a karma record exists', async () => {
    const { client, get } = buildClient();
    get.mockResolvedValue({ status: 200, data: { data: { karma_identity: IDENTITY } } });

    await expect(client.lookupKarma(IDENTITY)).resolves.toBe('found');
  });

  it('returns clear when the record payload is empty', async () => {
    const { client, get } = buildClient();
    get.mockResolvedValue({ status: 200, data: { data: null } });

    await expect(client.lookupKarma(IDENTITY)).resolves.toBe('clear');
  });

  it('returns clear on a 200 with an empty body', async () => {
    const { client, get } = buildClient();
    get.mockResolvedValue({ status: 200, data: {} });

    await expect(client.lookupKarma(IDENTITY)).resolves.toBe('clear');
  });

  it('returns clear on 404', async () => {
    const { client, get } = buildClient();
    get.mockResolvedValue({ status: 404, data: { message: 'Identity not found' } });

    await expect(client.lookupKarma(IDENTITY)).resolves.toBe('clear');
  });

  it('url-encodes the identity', async () => {
    const { client, get } = buildClient();
    get.mockResolvedValue({ status: 404, data: {} });

    await client.lookupKarma('ada+test@example.com');

    expect(get).toHaveBeenCalledWith('/verification/karma/ada%2Btest%40example.com');
  });

  it('retries a 5xx response and succeeds', async () => {
    const { client, get, sleep } = buildClient();
    get
      .mockResolvedValueOnce({ status: 502, data: {} })
      .mockResolvedValueOnce({ status: 404, data: {} });

    await expect(client.lookupKarma(IDENTITY)).resolves.toBe('clear');
    expect(sleep).toHaveBeenCalledWith(300);
  });

  it('retries network failures with exponential backoff, then fails', async () => {
    const { client, get, sleep } = buildClient();
    get.mockRejectedValue(new Error('timeout'));

    await expect(client.lookupKarma(IDENTITY)).rejects.toBeInstanceOf(AdjutorUnavailableError);
    expect(get).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls).toEqual([[300], [600]]);
  });

  it('gives up after exhausting retries on persistent 5xx', async () => {
    const { client, get } = buildClient();
    get.mockResolvedValue({ status: 503, data: {} });

    await expect(client.lookupKarma(IDENTITY)).rejects.toBeInstanceOf(AdjutorUnavailableError);
    expect(get).toHaveBeenCalledTimes(3);
  });

  it('does not retry a 4xx rejection', async () => {
    const { client, get } = buildClient();
    get.mockResolvedValue({ status: 401, data: {} });

    await expect(client.lookupKarma(IDENTITY)).rejects.toBeInstanceOf(AdjutorClientError);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('rejects an unrecognised 200 response shape', async () => {
    const { client, get } = buildClient();
    get.mockResolvedValue({ status: 200, data: 'not-json-object' });

    await expect(client.lookupKarma(IDENTITY)).rejects.toBeInstanceOf(AdjutorClientError);
  });
});
