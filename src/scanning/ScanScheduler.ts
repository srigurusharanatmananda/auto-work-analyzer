/**
 * Fires the daily scan at a configured local time, and catches up one missed day
 * on startup.
 *
 * A plain interval timer rather than a cron dependency: the granularity is a day,
 * and `tick` is idempotent, so re-checking every few minutes costs nothing and
 * needs no schedule parsing.
 *
 * Catch-up matters because this scheduler only fires while the server is running.
 * A laptop closed at 17:00 is the normal case, not an edge case.
 */

import { ScanRegistry } from "./ScanRegistry.js";

export interface ScanSchedulerDeps {
  registry: ScanRegistry;
  runScan: (userId: string, date: string) => Promise<void>;
  /** Injected so the date logic is testable without touching real time. */
  now?: () => Date;
  userIds: () => string[];
}

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;

/** A machine idle for months must not wake up and scan a year of history. */
const CATCH_UP_LIMIT_DAYS = 7;

function localDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function minutesInto(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function parseScanTime(scanTime: string): number {
  const [hours, minutes] = scanTime.split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

export class ScanScheduler {
  private timer?: ReturnType<typeof setInterval>;

  constructor(private deps: ScanSchedulerDeps) {}

  /** Runs any scan that is due. Idempotent — safe to call repeatedly. */
  async tick(): Promise<void> {
    const now = (this.deps.now ?? (() => new Date()))();

    for (const userId of this.deps.userIds()) {
      const settings = this.deps.registry.getSettings(userId);
      if (!settings.enabled) continue;

      for (const date of this.datesDue(settings.lastCompletedDate, now, settings.scanTime)) {
        try {
          await this.deps.runScan(userId, date);
          // `lastCompletedDate` is recorded by runScan on success, deliberately
          // not here: marking it done regardless would skip a failed day forever.
        } catch (error) {
          // One user's failure must not prevent another user's scan, and one
          // failed date must not prevent the later ones.
          console.error(
            `Daily scan failed for ${userId} on ${date}:`,
            error instanceof Error ? error.message : error
          );
        }
      }
    }
  }

  /**
   * The dates that still need scanning, oldest first.
   *
   * Two rules, and the distinction between them is the whole point:
   *
   * - **Today** is only due once the configured time has passed. Scanning at
   *   09:00 for a day still in progress would file half a day's work and then
   *   mark the day complete.
   * - **Any earlier missed day is due immediately**, whatever the time. The
   *   time-of-day gate must not apply to it: someone who opens their laptop each
   *   morning and closes it before 18:00 would otherwise never catch up.
   *
   * Each missed date is scanned as its own date rather than folded into today,
   * because the scanner analyses one specific day — running "today" would leave
   * the missed day's commits unexamined. Bounded at CATCH_UP_LIMIT_DAYS so a
   * machine idle for months does not wake up and scan a year.
   */
  private datesDue(lastCompleted: string | undefined, now: Date, scanTime: string): string[] {
    const today = localDate(now);
    const todayIsDue = minutesInto(now) >= parseScanTime(scanTime);

    if (!lastCompleted) {
      // Never run before: only today, and only once its time has passed. Do not
      // invent a backlog on first use.
      return todayIsDue ? [today] : [];
    }

    const dates: string[] = [];
    const cursor = new Date(`${lastCompleted}T12:00:00`);
    for (let i = 0; i < CATCH_UP_LIMIT_DAYS; i++) {
      cursor.setDate(cursor.getDate() + 1);
      const date = localDate(cursor);
      if (date > today) break;
      if (date === today && !todayIsDue) break;
      dates.push(date);
    }
    return dates;
  }

  start(intervalMs: number = DEFAULT_INTERVAL_MS): void {
    if (this.timer) return;
    void this.tick();
    this.timer = setInterval(() => void this.tick(), intervalMs);
    // Do not hold the process open for the sake of a timer.
    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }
}
