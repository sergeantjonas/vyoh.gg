import {
  type SyncJobHealth,
  type SyncJobStatus,
  relativeTimeAgo,
  syncJobHealth,
} from "@vyoh/shared";
import type { ReactNode } from "react";
import { Badge, STATUS_ROW_CLASS, StatusCard } from "./status-primitives";

const HEALTH_LABEL: Record<SyncJobHealth, string> = {
  running: "running",
  ok: "ok",
  error: "failed",
  pending: "pending",
};

const HEALTH_TONE = {
  running: "active",
  ok: "ok",
  error: "bad",
  pending: "muted",
} as const satisfies Record<SyncJobHealth, "ok" | "active" | "muted" | "bad">;

export function SyncJobsCard({
  title,
  description,
  jobs,
  renderAction,
}: {
  title: string;
  description: string;
  jobs: SyncJobStatus[];
  /**
   * Trailing control for a row, when the job has one. A render prop rather
   * than a flag: only some jobs are manually triggerable, and the control has
   * to own its own mutation state and owner gating.
   */
  renderAction?: (job: SyncJobStatus) => ReactNode;
}) {
  const failing = jobs.filter((job) => syncJobHealth(job) === "error").length;

  return (
    <StatusCard
      title={title}
      badges={failing > 0 && <Badge tone="bad">{failing} failing</Badge>}
      description={description}
    >
      {jobs.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No scheduled jobs reported — the api is running without its schedulers.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {jobs.map((job) => (
            <SyncJobRow key={job.name} job={job} action={renderAction?.(job)} />
          ))}
        </ul>
      )}
    </StatusCard>
  );
}

function SyncJobRow({ job, action }: { job: SyncJobStatus; action?: ReactNode }) {
  const health = syncJobHealth(job);
  const { lastRun } = job;

  return (
    <li className={STATUS_ROW_CLASS}>
      <span className="flex items-center gap-2">
        <span className="font-medium text-foreground">{job.label}</span>
        <span className="font-mono text-[10px] text-muted-foreground">
          {job.cron ?? "on demand"}
        </span>
      </span>
      <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
        {lastRun ? (
          <>
            {health === "error" ? (
              // Rendered in full rather than truncated behind a hover hint. A
              // poller error is routinely longer than a row, and hiding it
              // costs every keyboard and screen-reader visitor the only detail
              // the row carries. A broken job is rare enough to be worth the
              // extra line it takes.
              <span className="text-destructive">
                error: {lastRun.error ?? "unknown"}
              </span>
            ) : (
              <span>last ok</span>
            )}
            <span className="whitespace-nowrap">
              {relativeTimeAgo(lastRun.finishedAt)} · {lastRun.durationMs} ms
            </span>
          </>
        ) : (
          // Distinct from a zero-work run: the job either has not fired since
          // the last restart, or has never fired at all.
          <span>no run since boot</span>
        )}
        <Badge tone={HEALTH_TONE[health]}>{HEALTH_LABEL[health]}</Badge>
        {action}
      </span>
    </li>
  );
}
