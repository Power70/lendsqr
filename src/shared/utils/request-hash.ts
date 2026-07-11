import { createHash } from 'node:crypto';

// Key order must not change the hash — clients serialise JSON differently
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value !== null && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = canonicalize((value as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }
  return value;
}

export function hashRequestBody(body: unknown): string {
  const canonical = JSON.stringify(canonicalize(body)) ?? 'null';
  return createHash('sha256').update(canonical).digest('hex');
}
