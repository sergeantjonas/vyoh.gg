import { Injectable, Logger } from "@nestjs/common";
import type { SyncJobRun, SyncJobStatus, SyncJobTriggerResult } from "@vyoh/shared";
import { SYNC_JOBS, type SyncJobName } from "./sync-jobs.catalog";

// `GET /status` is public, and these messages come from upstream clients that
// build URLs by hand — Steam's among them, which carries its Web API key as a
// query parameter. An error quoting the failing URL would publish that key to
// every visitor the moment the call started failing. Redacting on the way in
// means a leak needs a new secret-carrying parameter name, not just a new
// upstream client.
const SECRET_QUERY_PARAM = /([?&][^=&\s"']*(?:key|token|secret)=)[^&\s"']+/gi;

function redactSecrets(message: string): string {
  return message.replace(SECRET_QUERY_PARAM, "$1***");
}

function messageFor(err: unknown): string {
  return redactSecrets(err instanceof Error ? err.message : String(err));
}

interface JobState {
  running: boolean;
  lastRun: SyncJobRun | null;
}

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
      this.jobs.set(name, { running: false, lastRun: null });
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
    const job = this.state(name);
    if (job.running) {
      this.logger.warn(`${name}: previous run still in flight — skipping`);
      return false;
    }

    job.running = true;
    const startedAt = new Date();
    try {
      await work();
      job.lastRun = this.finish(startedAt, "ok");
    } catch (err) {
      this.logger.error(`${name} failed`, err instanceof Error ? err.stack : err);
      job.lastRun = { ...this.finish(startedAt, "error"), error: messageFor(err) };
    } finally {
      job.running = false;
    }
    return true;
  }

  /**
   * Starts a job without waiting for it, for a manual trigger behind an HTTP
   * request. A patch sync walks the wiki and takes minutes, so the response
   * reports only whether the run began; the outcome reaches the caller on the
   * next status snapshot, the same way a cron run's does.
   *
   * `run()` flips `running` before its first await, so the status returned here
   * already reflects the run this call started.
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
