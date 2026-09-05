import { CuratedGamesSection } from "@/admin/curated-games-section";
import { TrackedAccountsSection } from "@/admin/tracked-accounts-section";
import { OwnerAction } from "@/auth/owner-action";
import { useIsOwner } from "@/auth/use-viewer";
import { Button } from "@/components/ui/button";
import { useMe } from "@/identity/use-me";
import { toastError, toastInfo, toastSuccess } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";
import {
  type AppWindowSnapshot,
  type LolAccount,
  type MethodLimiterSnapshot,
  OWNER_TIME_ZONE,
  type SyncJobStatus,
  type SyncTick,
  type SyncTickAccountResult,
} from "@vyoh/shared";

const TICK_TIME_FMT = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  timeZone: OWNER_TIME_ZONE,
});
import { Lock, Pause, Play, RefreshCw } from "lucide-react";
import {
  Badge,
  Metric,
  STATUS_ROW_CLASS,
  STATUS_TABLE_HEAD_CLASS,
  StatusCard,
} from "./status-primitives";
import { StatusSkeleton } from "./status-skeleton";
import { SyncJobsCard } from "./sync-jobs-card";
import {
  type StatusStreamState,
  useSetSyncEnabled,
  useStatus,
  useStatusStream,
  useSyncAccount,
  useSyncNow,
  useSyncPatches,
} from "./use-status";

export function StatusPage() {
  const stream = useStatusStream();
  const { data, isPending, error, refetch, isFetching } = useStatus();

  if (isPending) {
    return <StatusSkeleton />;
  }
  if (error || !data) {
    return (
      <StatusUnavailable
        reason={error?.message}
        retrying={isFetching}
        onRetry={() => void refetch()}
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Status</h1>
          <StreamPill state={stream} />
        </div>
        <p className="text-sm text-muted-foreground">
          Live view of the match-sync cron, the Steam pollers, and the Riot rate-limiter
          chain. Streams every 2 s; falls back to a 5 s poll when the stream drops.
        </p>
      </header>

      <SyncCard
        tick={data.sync.lastTick}
        enabled={data.sync.enabled}
        running={data.sync.running}
      />

      <SyncJobsCard
        title="LoL data sync"
        description="Patch notes and static data, on their own six-hourly crons — separate from the match sync above."
        jobs={data.jobs.filter((job) => job.stream === "lol")}
        renderAction={(job) =>
          job.name === "lol-patch-notes" ? <PatchSyncAction job={job} /> : null
        }
      />

      <SyncJobsCard
        title="Steam sync"
        description="Cron-driven pollers, each reconciling on its own schedule and on boot, plus the owner's on-demand per-game refresh."
        jobs={data.jobs.filter((job) => job.stream === "steam")}
      />

      <TrackedAccountsSection />

      <CuratedGamesSection />

      <StatusCard
        title="Rate limiter — app windows"
        description="Riot's per-key ceilings, a fast and a slow window per regional, shared by every method behind them."
      >
        <div className="grid gap-1.5 md:grid-cols-2">
          {data.rateLimiter.app.map((w) => (
            <AppWindowRow key={`${w.regional}-${w.role}`} window={w} />
          ))}
        </div>
      </StatusCard>

      <StatusCard
        title="Rate limiter — method families"
        description="Per-endpoint Riot limits, one limiter per regional and method family, created lazily on first use."
      >
        {data.rateLimiter.method.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No method limiters initialised yet — limiters are created lazily on the first
            request per (regional, family) pair.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className={STATUS_TABLE_HEAD_CLASS}>
                <tr>
                  <th className="py-2 pr-3 text-left font-medium">Regional</th>
                  <th className="px-2 py-2 text-left font-medium">Family</th>
                  <th className="px-2 py-2 text-right font-medium">Reservoir</th>
                  <th className="px-2 py-2 text-right font-medium">Queued</th>
                  <th className="py-2 pl-2 text-right font-medium">Executing</th>
                </tr>
              </thead>
              <tbody>
                {data.rateLimiter.method.map((m) => (
                  <MethodRow key={`${m.regional}-${m.family}`} method={m} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </StatusCard>

      {data.sync.history.length > 1 && <TickHistory ticks={data.sync.history.slice(1)} />}
    </div>
  );
}

const STREAM_PILL: Record<StatusStreamState, { label: string; dot: string } | null> = {
  connecting: null,
  live: { label: "Live", dot: "bg-emerald-500 animate-pulse" },
  polling: { label: "Polling", dot: "bg-amber-500" },
};

// The pill only says what the EventSource has actually reported, and stays
// silent until it has reported anything.
function StreamPill({ state }: { state: StatusStreamState }) {
  const pill = STREAM_PILL[state];
  if (!pill) return null;
  return (
    <span
      aria-live="polite"
      className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-medium text-[10px] uppercase tracking-[0.18em] text-muted-foreground"
    >
      <span aria-hidden="true" className={cn("size-1.5 rounded-full", pill.dot)} />
      {pill.label}
    </span>
  );
}

function TickHistory({ ticks }: { ticks: SyncTick[] }) {
  const durations = ticks.map((tick) => tick.durationMs);
  const slowest = Math.max(...durations, 1);
  // A flat history has no spike to show; tinting every row in full would read
  // as a style rather than a signal.
  const banded = Math.min(...durations) !== slowest;
  return (
    <StatusCard
      title="Recent ticks"
      description="Match-sync ticks before the current one, newest first. The band behind a row is its duration against the slowest tick shown."
    >
      <ul className="flex flex-col gap-1.5">
        {ticks.map((tick) => (
          <li
            key={tick.startedAt}
            className={cn(
              STATUS_ROW_CLASS,
              "relative isolate grid grid-cols-3 gap-0 overflow-hidden text-muted-foreground"
            )}
          >
            {banded && (
              <span
                aria-hidden="true"
                data-testid="tick-duration-band"
                className="absolute inset-y-0 left-0 -z-10 bg-foreground/[0.06]"
                style={{ width: `${(tick.durationMs / slowest) * 100}%` }}
              />
            )}
            <span className="font-medium text-foreground">
              {TICK_TIME_FMT.format(new Date(tick.startedAt))}
            </span>
            <span className="text-center font-mono">{tick.durationMs} ms</span>
            <span className="text-right">
              {sumBackfilled(tick)} new match{sumBackfilled(tick) === 1 ? "" : "es"}
            </span>
          </li>
        ))}
      </ul>
    </StatusCard>
  );
}

function StatusUnavailable({
  reason,
  retrying,
  onRetry,
}: {
  reason: string | undefined;
  retrying: boolean;
  onRetry: () => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-3 py-24">
      <p className="text-sm text-destructive">Status is unavailable right now.</p>
      <p className="font-mono text-xs text-muted-foreground">
        {reason ?? "unknown error"}
      </p>
      {/* A retry re-enters React Query's three-attempt backoff, so the button
          stays down for the several seconds it takes to answer either way. */}
      <Button variant="outline" size="sm" onClick={onRetry} disabled={retrying}>
        <RefreshCw className={cn(retrying && "animate-spin")} />
        Try again
      </Button>
    </div>
  );
}

function SyncCard({
  tick,
  enabled,
  running,
}: {
  tick: SyncTick | null;
  enabled: boolean;
  running: boolean;
}) {
  const { data: me } = useMe();
  const isOwner = useIsOwner();
  const syncNow = useSyncNow();
  const setEnabled = useSetSyncEnabled();
  const syncAccount = useSyncAccount();

  const onSyncNow = () => {
    syncNow.mutate(undefined, {
      onSuccess: (result) => {
        if (result.triggered) {
          void toastInfo("Sync triggered");
        } else {
          void toastError(`Sync skipped: ${result.reason ?? "unknown"}`);
        }
      },
      onError: (err) => void toastError(`Sync failed: ${err.message}`),
    });
  };

  const onToggleEnabled = () => {
    const next = !enabled;
    setEnabled.mutate(next, {
      onSuccess: () => void toastInfo(next ? "Sync resumed" : "Sync paused"),
      onError: (err) => void toastError(`Toggle failed: ${err.message}`),
    });
  };

  const onSyncAccount = (slug: string) => {
    const account = me?.lol.find((a) => a.slug === slug);
    if (!account) {
      void toastError(`Account "${slug}" is no longer on the roster`);
      return;
    }
    syncAccount.mutate(account, {
      onSuccess: (result) => {
        const word = result.backfilled === 1 ? "match" : "matches";
        void toastSuccess(`+${result.backfilled} new ${word} (${result.idCount} ids)`);
      },
      onError: (err) => void toastError(`Sync failed: ${err.message}`),
    });
  };

  return (
    <StatusCard
      title="Match sync"
      badges={
        <>
          {!enabled && <Badge tone="muted">paused</Badge>}
          {running && <Badge tone="active">running</Badge>}
          {enabled && !running && tick && <Badge tone="ok">idle</Badge>}
        </>
      }
      action={
        <div className="flex flex-col items-end gap-1.5">
          <div className="flex gap-2">
            <OwnerAction isOwner={isOwner} label="Trigger a sync tick now">
              <Button
                variant="outline"
                size="sm"
                onClick={onSyncNow}
                disabled={!isOwner || syncNow.isPending || running || !enabled}
              >
                {isOwner ? (
                  <RefreshCw className={cn(syncNow.isPending && "animate-spin")} />
                ) : (
                  <Lock />
                )}
                Sync now
              </Button>
            </OwnerAction>
            <OwnerAction
              isOwner={isOwner}
              label={enabled ? "Pause the sync cron" : "Resume the sync cron"}
            >
              <Button
                variant="outline"
                size="sm"
                onClick={onToggleEnabled}
                disabled={!isOwner || setEnabled.isPending}
              >
                {!isOwner ? <Lock /> : enabled ? <Pause /> : <Play />}
                {enabled ? "Pause" : "Resume"}
              </Button>
            </OwnerAction>
          </div>
          {/* The only route to `/login` anywhere in the app. It sits here
              rather than in the nav because this is the one page whose
              controls are locked — a visitor who has just been shown a row of
              padlocks is the only visitor the question "how do I unlock these"
              occurs to. */}
          {!isOwner && (
            <Link
              to="/login"
              search={{ error: undefined, next: "/status" }}
              className="text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
            >
              Owner-only — sign in
            </Link>
          )}
        </div>
      }
    >
      {tick === null ? (
        <p className="text-sm text-muted-foreground">
          No tick has completed yet — the cron runs every 5 minutes (and once on boot).
        </p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <Metric
              label="Started"
              value={TICK_TIME_FMT.format(new Date(tick.startedAt))}
            />
            <Metric label="Duration" value={`${tick.durationMs} ms`} />
            <Metric label="New matches" value={String(sumBackfilled(tick))} />
          </div>
          <ul className="flex flex-col gap-1.5">
            {tick.accounts.map((acc) => (
              <AccountRow
                key={acc.slug || acc.label}
                account={acc}
                onSync={() => onSyncAccount(acc.slug)}
                syncing={
                  syncAccount.isPending && syncAccount.variables?.slug === acc.slug
                }
                resolvable={Boolean(me?.lol.some((a: LolAccount) => a.slug === acc.slug))}
                isOwner={isOwner}
              />
            ))}
          </ul>
        </>
      )}
    </StatusCard>
  );
}

function AccountRow({
  account,
  onSync,
  syncing,
  resolvable,
  isOwner,
}: {
  account: SyncTickAccountResult;
  onSync: () => void;
  syncing: boolean;
  resolvable: boolean;
  isOwner: boolean;
}) {
  const head =
    "error" in account.head
      ? `error: ${account.head.error}`
      : `+${account.head.backfilled} of ${account.head.idCount}`;
  const historical =
    "error" in account.historical
      ? `error: ${account.historical.error}`
      : account.historical.skipped
        ? account.historical.done
          ? "done"
          : "waiting"
        : `+${account.historical.backfilled} of ${account.historical.idCount}${account.historical.done ? " (done)" : ""}`;

  const headError = "error" in account.head;
  const histError = "error" in account.historical;

  return (
    <li className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-1.5 text-xs">
      <span className="font-medium text-foreground">{account.label}</span>
      <span className="flex items-center gap-3 text-muted-foreground">
        <span className={cn(headError && "text-destructive")}>head {head}</span>
        <span className={cn(histError && "text-destructive")}>hist {historical}</span>
        <OwnerAction
          isOwner={isOwner}
          side="top"
          label={resolvable ? "Sync this account now" : "Account no longer on the roster"}
        >
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onSync}
            disabled={!isOwner || syncing || !resolvable}
            aria-label={`Sync ${account.label}`}
          >
            {isOwner ? <RefreshCw className={cn(syncing && "animate-spin")} /> : <Lock />}
          </Button>
        </OwnerAction>
      </span>
    </li>
  );
}

// Granular against "Sync now" on the match-sync card: this forces only the
// patch-note fetch, for the window between a patch going live and the next
// six-hourly tick noticing it.
function PatchSyncAction({ job }: { job: SyncJobStatus }) {
  const isOwner = useIsOwner();
  const syncPatches = useSyncPatches();

  const onFetch = () => {
    syncPatches.mutate(undefined, {
      onSuccess: (result) => {
        if (result.triggered) {
          void toastInfo("Patch fetch triggered");
        } else {
          void toastError(`Patch fetch skipped: ${result.reason ?? "unknown"}`);
        }
      },
      onError: (err) => void toastError(`Patch fetch failed: ${err.message}`),
    });
  };

  return (
    <OwnerAction isOwner={isOwner} side="top" label="Fetch patch notes now">
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={onFetch}
        disabled={!isOwner || syncPatches.isPending || job.running}
        aria-label="Fetch patch notes"
      >
        {isOwner ? (
          <RefreshCw
            className={cn((syncPatches.isPending || job.running) && "animate-spin")}
          />
        ) : (
          <Lock />
        )}
      </Button>
    </OwnerAction>
  );
}

// Remaining reservoir as a share of capacity; a null reservoir means the
// limiter has not been asked yet, which is a full window, not an empty one.
function ReservoirBar({
  reservoir,
  capacity,
  className,
}: {
  reservoir: number | null;
  capacity: number;
  className?: string;
}) {
  const pct =
    reservoir === null ? 100 : Math.max(0, Math.min(100, (reservoir / capacity) * 100));
  const tone = pct < 20 ? "bg-destructive" : pct < 50 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className={cn("h-1.5 overflow-hidden rounded-full bg-muted", className)}>
      <div
        className={cn("h-full transition-all duration-500 ease-out", tone)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function AppWindowRow({ window }: { window: AppWindowSnapshot }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-md bg-muted/30 px-3 py-2">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">
          {window.regional}
          <span className="text-muted-foreground">
            {" "}
            · {window.role} ({window.windowSec}s)
          </span>
        </span>
        <span className="font-mono text-muted-foreground">
          {window.reservoir ?? "—"} / {window.capacity}
        </span>
      </div>
      <ReservoirBar reservoir={window.reservoir} capacity={window.capacity} />
      <div className="flex gap-3 font-mono text-[10px] text-muted-foreground">
        <span>Q {window.counts.QUEUED}</span>
        <span>exec {window.counts.EXECUTING}</span>
        <span>run {window.counts.RUNNING}</span>
      </div>
    </div>
  );
}

function MethodRow({ method }: { method: MethodLimiterSnapshot }) {
  return (
    <tr className="border-t">
      <td className="py-2 pr-3">{method.regional}</td>
      <td className="px-2 py-2 font-mono text-xs">{method.family}</td>
      <td className="px-2 py-2">
        <div className="flex flex-col items-end gap-1">
          <span className="font-mono">
            {method.reservoir ?? "—"} / {method.capacity}
          </span>
          <ReservoirBar
            reservoir={method.reservoir}
            capacity={method.capacity}
            className="w-24"
          />
        </div>
      </td>
      <td className="px-2 py-2 text-right font-mono">{method.counts.QUEUED}</td>
      <td className="py-2 pl-2 text-right font-mono">{method.counts.EXECUTING}</td>
    </tr>
  );
}

function sumBackfilled(tick: SyncTick): number {
  return tick.accounts.reduce((acc, a) => {
    const head = "backfilled" in a.head ? a.head.backfilled : 0;
    const hist = "backfilled" in a.historical ? a.historical.backfilled : 0;
    return acc + head + hist;
  }, 0);
}
