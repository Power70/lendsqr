import axios, { type AxiosInstance, type AxiosResponse } from 'axios';
import { z } from 'zod';
import { env } from '../../config/env';
import type { KarmaLookup } from './karma.types';

const MAX_ATTEMPTS = 3;
const BASE_RETRY_DELAY_MS = 300;

// A karma record exists when `data` is populated. A clean identity comes back
// as 404, or as 200 with `data` absent/null (observed live behaviour).
const karmaLookupSchema = z.object({ data: z.unknown().optional() });

// Transient upstream failure — retried, then surfaced for fail-closed handling
export class AdjutorUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AdjutorUnavailableError';
  }
}

// Broken integration (bad key, contract drift) — retrying cannot help
export class AdjutorClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AdjutorClientError';
  }
}

const defaultHttp = (): AxiosInstance =>
  axios.create({
    baseURL: env.ADJUTOR_BASE_URL,
    timeout: env.ADJUTOR_TIMEOUT_MS,
    headers: { Authorization: `Bearer ${env.ADJUTOR_API_KEY}` },
    // Statuses are branched on explicitly; only network failures should throw
    validateStatus: () => true,
  });

const defaultSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export class AdjutorClient {
  constructor(
    private readonly http: AxiosInstance = defaultHttp(),
    private readonly sleep: (ms: number) => Promise<void> = defaultSleep,
  ) {}

  async lookupKarma(identity: string): Promise<KarmaLookup> {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      if (attempt > 1) {
        await this.sleep(BASE_RETRY_DELAY_MS * 2 ** (attempt - 2));
      }

      let response: AxiosResponse<unknown>;
      try {
        response = await this.http.get(`/verification/karma/${encodeURIComponent(identity)}`);
      } catch {
        continue;
      }

      if (response.status === 404) {
        return 'clear';
      }
      if (response.status >= 500) {
        continue;
      }
      if (response.status !== 200) {
        throw new AdjutorClientError(`karma lookup rejected with status ${response.status}`);
      }

      const body = karmaLookupSchema.safeParse(response.data);
      if (!body.success) {
        throw new AdjutorClientError('karma lookup returned an unrecognised response shape');
      }
      return body.data.data ? 'found' : 'clear';
    }

    throw new AdjutorUnavailableError(`karma lookup failed after ${MAX_ATTEMPTS} attempts`);
  }
}
