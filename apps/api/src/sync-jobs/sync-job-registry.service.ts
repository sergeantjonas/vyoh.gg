import { Injectable, Logger } from "@nestjs/common";
import * as Sentry from "@sentry/nestjs";
import {
  type SyncJobRun,
  type SyncJobStatus,
  type SyncJobTriggerResult,
  redactSecrets,
} from "@vyoh/shared";
import { SteamRateLimiterTimeoutError } from "../steam/client/rate-limiter.service";
import { SteamClientError } from "../steam/client/steam-client.service";
import { SYNC_JOBS, type SyncJobName } from "./sync-jobs.catalog";

// `GET /status` is public, and these messages come from upstream clients that
// build URLs by hand — Steam's among them, which carries its Web API key as a
// query parameter. An error quoting the failing URL would publish that key to
// every visitor the moment the call started failing.
function messageFor(err: unknown): string {
  return redactSecrets(err instanceof Error ? err.message : String(err));
}

// An upstream that is briefly unwell rather than one refusing what we asked:
// a rate limit, a gateway error, a timeout. The next run usually succeeds, and
// nothing about the failure is ours to fix unless it keeps happening.
function isTransientUpstream(err: unknown): boolean {
  if (err instanceof SteamRateLimiterTimeoutError) return true;
  return err instanceof SteamClientError && (err.status === 429 || err.status >= 500);
}

// Measured in time, not in runs, because cadences span two minutes to a month:
// three strikes would bury a daily job's failure for three days. A streak's
// first failure waits unless the run itself outlasts the grace, and a job on a
// 15-minute or slower cadence reports on its second; the margin below 15
// absorbs cron start jitter.
const TRANSIENT_GRACE_MS = 10 * 60_000;

interface JobState {
  running: boolean;
  lastRun: SyncJobRun | null;
  /** When the current streak of consecutive failures began; null until a failure, and after a success. */
  failingSince: number | null;
}

// What `execute()` hands back: the work's own result, or the refusal when a
// run is already in flight. Mirrors the `triggered: false` shape of a trigger
// so both kinds of manual job read the same way to a caller.
export type SyncJobExecution<T> =
  | { ran: true; result: T }
  | { ran: false; reason: "already running" };

/**
 * Single source of truth for "is a scheduled job running, and how did it last
 * go" — the state the status board needs and that a poller's private `running`
 * boolean could never expose.
 *
 * It also owns the overlap guard every scheduled job would otherwise duplicate.
 * That is the point of routing ticks through `run()` rather than having a
 * poller report alongside its own flag: two copies of the same boolean drift,
 * and the copy the board reads is the one that would drift silently.
 */
@Injectable()
export class SyncJobRegistry {
  private readonly logger = new Logger(SyncJobRegistry.name);
  private readonly jobs = new Map<SyncJobName, JobState>();

  constructor() {
    // Seeded from the catalog, not on first run, so a job that has never fired
    // still appears on the board as "pending" rather than being absent.
    for (const name of Object.keys(SYNC_JOBS) as SyncJobName[]) {
      this.jobs.set(name, { running: false, lastRun: null, failingSince: null });
    }
  }

  /**
   * Runs a job's work, recording duration and outcome, and skips outright when
   * a run is already in flight.
   *
   * Failures are recorded and swallowed rather than rethrown: these are called
   * from `@Cron` handlers, where a rejection becomes an unhandled rejection and
   * tells nobody anything. Returns false when the run was skipped.
   */
  async run(name: SyncJobName, work: () => Promise<unknown>): Promise<boolean> {
    try {
      const outcome = await this.execute(name, work);
      if (!outcome.ran) {
        this.logger.warn(`${name}: previous run still in flight — skipping`);
        return false;
      }
    } catch (err) {
      this.logger.error(`${name} failed`, err instanceof Error ? err.stack : err);
      // Only here, not in `execute()`: that one rethrows, so a manual trigger's
      // failure reaches the controller and is reported by the exception filter.
      // This catch is the background path, where nothing else is watching — a
      // cron that has been failing for a week is the case this exists for,
      // since `/status` shows only the latest run.
      //
      // A transient upstream failure waits out the grace first: a two-minute
      // poller meets the odd Steam timeout every few days, and the tick after it
      // succeeds.
      // Not `state()`: it throws for an uncatalogued name, and this catch must
      // never reject.
      const failingSince = this.jobs.get(name)?.failingSince ?? null;
      const withinGrace =
        failingSince !== null && Date.now() - failingSince < TRANSIENT_GRACE_MS;
      if (!(isTransientUpstream(err) && withinGrace)) {
        Sentry.captureException(err, { tags: { syncJob: name } });
      }
    }
    return true;
  }

  /**
   * Runs a job's work and hands its result back, for a manual trigger whose
   * caller is waiting on the answer — a per-game refresh is a few Steam calls
   * and the point of asking is to read what changed. Recorded exactly like a
   * scheduled run, so the board shows the same duration and outcome; the
   * difference from `run()` is that a failure is rethrown, because here there
   * is a caller to tell.
   */
  async execute<T>(
    name: SyncJobName,
    work: () => Promise<T>
  ): Promise<SyncJobExecution<T>> {
    const job = this.state(name);
    if (job.running) return { ran: false, reason: "already running" };

    job.running = true;
    const startedAt = new Date();
    try {
      const result = await work();
      job.lastRun = this.finish(startedAt, "ok");
      job.failingSince = null;
      return { ran: true, result };
    } catch (err) {
      job.lastRun = { ...this.finish(startedAt, "error"), error: messageFor(err) };
      job.failingSince ??= startedAt.getTime();
      throw err;
    } finally {
      job.running = false;
    }
  }

  /**
   * Starts a job without waiting for it, for a manual trigger behind an HTTP
   * request. A patch sync walks the wiki and takes minutes, so the response
   * reports only whether the run began; the outcome reaches the caller on the
   * next status snapshot, the same way a cron run's does.
   *
   * `execute()` flips `running` before its first await, so the status returned
   * here already reflects the run this call started.
   */
  trigger(name: SyncJobName, work: () => Promise<unknown>): SyncJobTriggerResult {
    if (this.state(name).running) {
      return { triggered: false, reason: "already running", job: this.statusFor(name) };
    }
    void this.run(name, work);
    return { triggered: true, job: this.statusFor(name) };
  }

  getStatus(): SyncJobStatus[] {
    return (Object.keys(SYNC_JOBS) as SyncJobName[]).map((name) => this.statusFor(name));
  }

  private statusFor(name: SyncJobName): SyncJobStatus {
    const { stream, label, cron } = SYNC_JOBS[name];
    const { running, lastRun } = this.state(name);
    return { name, stream, label, cron, running, lastRun };
  }

  private state(name: SyncJobName): JobState {
    const job = this.jobs.get(name);
    // Unreachable through the typed surface — `SyncJobName` is the catalog's
    // key set and the constructor seeds all of them. Guarding anyway so a
    // future untyped caller fails loudly instead of recording into nothing.
    if (!job) throw new Error(`sync job "${name}" is not in the catalog`);
    return job;
  }

  private finish(startedAt: Date, outcome: SyncJobRun["outcome"]): SyncJobRun {
    const finishedAt = new Date();
    return {
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      outcome,
    };
  }
}
