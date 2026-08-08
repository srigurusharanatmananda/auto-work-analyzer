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

import { randomUUID } from "node:crypto";
import { hostname } from "node:os";
import { ScanRegistry } from "./ScanRegistry.js";
import { ScanLeaseStore } from "./ScanLeaseStore.js";
import { localDate } from "./scanDate.js";

export interface ScanSchedulerDeps {
  registry: ScanRegistry;
  runScan: (userId: string, date: string) => Promise<void>;
  /** Injected so the date logic is testable without touching real time. */
  now?: () => Date;
  userIds: () => string[] | Promise<string[]>;
  /**
   * Stops two processes scanning the same day. Defaults to the real store;
   * injected by tests, which need to simulate losing the claim.
   */
  leases?: ScanLeaseStore;
  /**
   * This process's identity in the lease table. Defaults to host + a uuid.
   *
   * A uuid rather than the pid: pids are reused, and a restarted process
   * inheriting the pid of the one that just died would be able to steal — or
   * worse, complete — a lease that is not its own.
   */
  owner?: string;
}

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;

/** A machine idle for months must not wake up and scan a year of history. */
const CATCH_UP_LIMIT_DAYS = 7;

function minutesInto(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function parseScanTime(scanTime: string): number {
  const [hours, minutes] = scanTime.split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

export class ScanScheduler {
  private timer?: ReturnType<typeof setInterval>;
  private readonly leases: ScanLeaseStore;
  private readonly owner: string;

  constructor(private deps: ScanSchedulerDeps) {
    this.leases = deps.leases ?? new ScanLeaseStore();
    this.owner = deps.owner ?? `${hostname()}:${randomUUID()}`;
  }

  /**
   * Runs any scan that is due. Idempotent — safe to call repeatedly, and safe
   * to run in two processes at once.
   *
   * The second guarantee is the load-bearing one and it is not free: `start`
   * only guards against a double tick *within* a process, so two instances —
   * or a deploy where the old one has not exited — used to mean the same day
   * scanned twice and every ClickUp task created twice. Each date is therefore
   * claimed before it is scanned. See `ScanLeaseStore`.
   */
  async tick(): Promise<void> {
    const now = (this.deps.now ?? (() => new Date()))();

    for (const userId of await this.deps.userIds()) {
      const settings = await this.deps.registry.getSettings(userId);
      if (!settings.enabled) continue;

      for (const date of this.datesDue(settings.lastCompletedDate, now, settings.scanTime)) {
        try {
          const outcome = await this.leases.withLease(userId, date, this.owner, () =>
            this.deps.runScan(userId, date)
          );
          // `lastCompletedDate` is recorded by runScan on success, deliberately
          // not here: marking it done regardless would skip a failed day forever.
          if (!outcome.acquired) {
            // Another process has this day. Not a warning — this is the
            // mechanism working, and on a two-instance deployment it is the
            // majority outcome.
            console.log(`Daily scan for ${userId} on ${date} is already running elsewhere`);
          }
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

  /**
   * One tick at a time.
   *
   * A scan can outlast the interval — a week of catch-up over several repos
   * takes longer than five minutes — and without this the timer stacks ticks on
   * top of each other. The lease means the overlapping tick cannot duplicate
   * anything, but it would still queue up connections and work for a day that
   * is already being handled, so it is skipped outright.
   */
  private inFlight?: Promise<void>;

  private tickOnce(): Promise<void> {
    // The promise IS the flag — its presence means a tick is running, and
    // returning it lets the caller join rather than start a second one.
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    if (this.inFlight) return this.inFlight;
    this.inFlight = this.tick().finally(() => {
      this.inFlight = undefined;
    });
    return this.inFlight;
  }

  start(intervalMs: number = DEFAULT_INTERVAL_MS): void {
    if (this.timer) return;
    void this.tickOnce();
    this.timer = setInterval(() => void this.tickOnce(), intervalMs);
    // Do not hold the process open for the sake of a timer.
    this.timer.unref?.();
  }

  /**
   * Stops future ticks and waits for the one in flight.
   *
   * Awaiting matters. `start` fires its first tick without awaiting it, so a
   * `stop` that only cleared the interval left a scan running against a
   * database the caller was about to close — and in tests, writing into the
   * next test's state. Callers that ignore the returned promise behave exactly
   * as before.
   */
  async stop(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    await this.inFlight?.catch((): void => {});
  }
}
