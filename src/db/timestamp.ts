/**
 * UTC ISO string from a millisecond timestamp, matching how this schema
 * stores every timestamp — plain `text`, not `timestamptz` (see
 * `schema.ts`'s own header comment on why). Shared by `ScanLeaseStore.ts`
 * and `PostgresRateLimitStore.ts`, which each defined this identically
 * before it was pulled out — two copies of a two-line function are still
 * two places the exact formatting has to be kept in sync by hand.
 */
export function stamp(at: number): string {
  return new Date(at).toISOString();
}
