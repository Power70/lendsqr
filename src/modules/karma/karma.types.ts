export type KarmaIdentityKind = 'bvn' | 'email' | 'phone';

export type KarmaLookup = 'found' | 'clear';

export interface KarmaIdentities {
  bvn: string;
  email: string;
  phone: string;
}
