import { AppError } from '../../shared/errors/app-error';
import { logger } from '../../shared/logger/logger';
import { AdjutorClient } from './adjutor.client';
import type { KarmaIdentities, KarmaIdentityKind } from './karma.types';

export class KarmaService {
  constructor(private readonly adjutorClient: AdjutorClient) {}

  // Fail-closed: a confirmed hit rejects immediately; if any lookup cannot be
  // completed the caller gets a retriable error rather than a blind onboarding.
  // A failed lookup does not stop the remaining identities from being checked —
  // a hit on a later identity must still reject.
  async assertNotBlacklisted(identities: KarmaIdentities): Promise<void> {
    let lookupFailed = false;

    for (const [kind, value] of Object.entries(identities) as [KarmaIdentityKind, string][]) {
      try {
        const outcome = await this.adjutorClient.lookupKarma(value);
        if (outcome === 'found') {
          // Identity kind only — blacklist values are never logged
          logger.warn({ identity_kind: kind }, 'karma blacklist hit, onboarding rejected');
          throw AppError.forbidden(
            'USER_BLACKLISTED',
            'Onboarding cannot be completed for this profile',
          );
        }
      } catch (err) {
        if (err instanceof AppError) {
          throw err;
        }
        logger.warn({ identity_kind: kind, err }, 'karma lookup failed');
        lookupFailed = true;
      }
    }

    if (lookupFailed) {
      throw AppError.serviceUnavailable(
        'KARMA_CHECK_UNAVAILABLE',
        'Eligibility could not be verified. Please try again shortly.',
      );
    }
  }
}

export const karmaService = new KarmaService(new AdjutorClient());
