import { Button } from "@/components/ui/button";
import { useMe } from "@/identity/use-me";
import { toastError, toastInfo, toastSuccess } from "@/lib/toast";
import { cn } from "@/lib/utils";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type {
  AppWindowSnapshot,
  LolAccount,
  MethodLimiterSnapshot,
  SyncTick,
  SyncTickAccountResult,
} from "@vyoh/shared";
import { Pause, Play, RefreshCw } from "lucide-react";

const TOOLTIP_CONTENT_CLASS =
  "pointer-events-none z-50 rounded-md border bg-popover/85 px-2 py-1 text-xs text-popover-foreground shadow-xl backdrop-blur-md data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95";
import {
  useSetSyncEnabled,
  useStatus,
  useStatusStream,
  useSyncAccount,
  useSyncNow,
} from "./use-status";

export function StatusPage() {
  useStatusStream();
  const { data, isPending, error } = useStatus();

  if (isPending) {
    return <p className="text-sm text-muted-foreground">Loading status…</p>;
  }
  if (error || !data) {
    return (
      <p className="text-sm text-destructive">
        Failed to load status: {error?.message ?? "unknown"}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Status</h1>
        <p className="text-sm text-muted-foreground">
          Live view of the match-sync cron and the Riot rate-limiter chain. Updates every
          2 s via SSE.
        </p>
      </header>

      <SyncCard
        tick={data.sync.lastTick}
        enabled={data.sync.enabled}
        running={data.sync.running}
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Rate limiter — app windows
        </h2>
        <div className="grid gap-2 md:grid-cols-2">
          {data.rateLimiter.app.map((w) => (
            <AppWindowRow key={`${w.regional}-${w.role}`} window={w} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Rate limiter — method families
        </h2>
        {data.rateLimiter.method.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No method limiters initialised yet — limiters are created lazily on the first
            request per (regional, family) pair.
          </p>
        ) : (
          <div className="overflow-hidden rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Regional</th>
                  <th className="px-3 py-2 text-left">Family</th>
                  <th className="px-3 py-2 text-right">Reservoir</th>
                  <th className="px-3 py-2 text-right">Queued</th>
                  <th className="px-3 py-2 text-right">Executing</th>
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
      </section>

      {data.sync.history.length > 1 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Recent ticks
          </h2>
          <ul className="flex flex-col gap-1 text-sm">
            {data.sync.history.slice(1).map((tick) => (
              <li
                key={tick.startedAt}
                className="flex items-center justify-between rounded-md border bg-muted/20 px-3 py-1.5 text-xs text-muted-foreground"
              >
                <span>{new Date(tick.startedAt).toLocaleTimeString()}</span>
                <span>{tick.durationMs} ms</span>
                <span>
                  {sumBackfilled(tick)} new match{sumBackfilled(tick) === 1 ? "" : "es"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
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
      void toastError(`Account "${slug}" not in identity config`);
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
    <section className="flex flex-col gap-3 rounded-md border p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Match sync
          </h2>
          <div className="flex items-center gap-2 text-xs">
            {!enabled && <Badge tone="muted">paused</Badge>}
            {running && <Badge tone="active">running</Badge>}
            {enabled && !running && tick && <Badge tone="ok">idle</Badge>}
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onSyncNow}
            disabled={syncNow.isPending || running || !enabled}
          >
            <RefreshCw className={cn(syncNow.isPending && "animate-spin")} />
            Sync now
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onToggleEnabled}
            disabled={setEnabled.isPending}
          >
            {enabled ? <Pause /> : <Play />}
            {enabled ? "Pause" : "Resume"}
          </Button>
        </div>
      </div>

      {tick === null ? (
        <p className="text-sm text-muted-foreground">
          No tick has completed yet — the cron runs every 5 minutes (and once on boot).
        </p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <Metric
              label="Started"
              value={new Date(tick.startedAt).toLocaleTimeString()}
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
              />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function AccountRow({
  account,
  onSync,
  syncing,
  resolvable,
}: {
  account: SyncTickAccountResult;
  onSync: () => void;
  syncing: boolean;
  resolvable: boolean;
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
        <TooltipPrimitive.Root>
          <TooltipPrimitive.Trigger asChild>
            <span className="inline-flex">
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={onSync}
                disabled={syncing || !resolvable}
                aria-label={`Sync ${account.label}`}
              >
                <RefreshCw className={cn(syncing && "animate-spin")} />
              </Button>
            </span>
          </TooltipPrimitive.Trigger>
          <TooltipPrimitive.Portal>
            <TooltipPrimitive.Content
              side="top"
              sideOffset={4}
              className={TOOLTIP_CONTENT_CLASS}
            >
              {resolvable
                ? "Sync this account now"
                : "Account no longer in identity config"}
            </TooltipPrimitive.Content>
          </TooltipPrimitive.Portal>
        </TooltipPrimitive.Root>
      </span>
    </li>
  );
}

function AppWindowRow({ window }: { window: AppWindowSnapshot }) {
  const pct =
    window.reservoir === null
      ? 100
      : Math.max(0, Math.min(100, (window.reservoir / window.capacity) * 100));
  const tone = pct < 20 ? "bg-destructive" : pct < 50 ? "bg-amber-500" : "bg-emerald-500";

  return (
    <div className="flex flex-col gap-1.5 rounded-md border p-3">
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
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full transition-all duration-500 ease-out", tone)}
          style={{ width: `${pct}%` }}
        />
      </div>
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
      <td className="px-3 py-1.5">{method.regional}</td>
      <td className="px-3 py-1.5 font-mono text-xs">{method.family}</td>
      <td className="px-3 py-1.5 text-right font-mono">
        {method.reservoir ?? "—"} / {method.capacity}
      </td>
      <td className="px-3 py-1.5 text-right font-mono">{method.counts.QUEUED}</td>
      <td className="px-3 py-1.5 text-right font-mono">{method.counts.EXECUTING}</td>
    </tr>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="font-mono">{value}</span>
    </div>
  );
}

function Badge({
  tone,
  children,
}: { tone: "ok" | "active" | "muted"; children: React.ReactNode }) {
  const styles =
    tone === "ok"
      ? "bg-emerald-500/15 text-emerald-500"
      : tone === "active"
        ? "bg-sky-500/15 text-sky-500 animate-pulse"
        : "bg-muted text-muted-foreground";
  return (
    <span className={cn("rounded-full px-2 py-0.5 font-medium", styles)}>{children}</span>
  );
}

function sumBackfilled(tick: SyncTick): number {
  return tick.accounts.reduce((acc, a) => {
    const head = "backfilled" in a.head ? a.head.backfilled : 0;
    const hist = "backfilled" in a.historical ? a.historical.backfilled : 0;
    return acc + head + hist;
  }, 0);
}
