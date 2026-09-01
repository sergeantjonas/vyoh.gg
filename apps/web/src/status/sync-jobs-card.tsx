import { SectionTitle } from "@/components/ui/section-title";
import {
  type SyncJobHealth,
  type SyncJobStatus,
  relativeTimeAgo,
  syncJobHealth,
} from "@vyoh/shared";
import { Badge } from "./status-primitives";

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
}: {
  title: string;
  description: string;
  jobs: SyncJobStatus[];
}) {
  const failing = jobs.filter((job) => syncJobHealth(job) === "error").length;

  return (
    <section className="flex flex-col gap-3 rounded-md border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <SectionTitle as="h2">{title}</SectionTitle>
          {failing > 0 && (
            <span className="text-xs">
              <Badge tone="bad">{failing} failing</Badge>
            </span>
          )}
        </div>
        <p className="max-w-sm text-right text-xs text-muted-foreground">{description}</p>
      </div>

      {jobs.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No scheduled jobs reported — the api is running without its schedulers.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {jobs.map((job) => (
            <SyncJobRow key={job.name} job={job} />
          ))}
        </ul>
      )}
    </section>
  );
}

function SyncJobRow({ job }: { job: SyncJobStatus }) {
  const health = syncJobHealth(job);
  const { lastRun } = job;

  return (
    <li className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-md bg-muted/30 px-3 py-1.5 text-xs">
      <span className="flex items-center gap-2">
        <span className="font-medium text-foreground">{job.label}</span>
        <span className="font-mono text-[10px] text-muted-foreground">{job.cron}</span>
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
      </span>
    </li>
  );
}
