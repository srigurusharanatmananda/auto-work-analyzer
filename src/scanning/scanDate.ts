/**
 * The one definition of "which day is it" for scanning.
 *
 * Local, not UTC, and that is the whole reason this is shared rather than
 * inlined twice. The scheduler fires at a local wall-clock time and the user
 * picks a date from a local calendar, so a UTC-derived date disagrees with both
 * for several hours a day — and the two places that need to compare dates would
 * disagree with each other, which is worse than either being wrong alone.
 */

/** `YYYY-MM-DD` in the machine's local zone. */
export function localDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
