import { randomBytes } from 'node:crypto';

// No ambiguous characters (I, L, O, U) — references get read over the phone
const ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ0123456789';
const SUFFIX_LENGTH = 8;

export function generateReference(now = new Date()): string {
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = Array.from(randomBytes(SUFFIX_LENGTH), (byte) => ALPHABET[byte % ALPHABET.length]).join(
    '',
  );
  return `TXN-${date}-${suffix}`;
}
