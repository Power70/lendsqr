// MySQL duplicate-key violation — the last line of defense when two
// concurrent requests pass an application-level uniqueness pre-check.
export function isDuplicateEntry(err: unknown): boolean {
  return (
    typeof err === 'object' && err !== null && (err as { code?: string }).code === 'ER_DUP_ENTRY'
  );
}
