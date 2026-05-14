import { useChronotype } from "@/lol/profile/use-chronotype";
import { SampleSizeBadge } from "@/lol/trends/_shared/sample-size-badge";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type { ChronotypeHour, LolAccount } from "@vyoh/shared";

const TOOLTIP_CONTENT_CLASS =
  "pointer-events-none z-50 w-max max-w-48 rounded-md border bg-popover/85 p-3 text-popover-foreground shadow-xl backdrop-blur-md data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col gap-3 rounded-lg border bg-card/50 px-4 py-4">
      {children}
    </div>
  );
}

function Empty({ verdict }: { verdict: string }) {
  return (
    <Shell>
      <h3 className="text-xs uppercase tracking-wide text-muted-foreground">
        Chronotype
      </h3>
      <p className="text-base font-semibold leading-snug text-muted-foreground/70">
        {verdict}
      </p>
    </Shell>
  );
}

// Color stops chosen so 50% (coin-flip) reads as a neutral muted tone, and
// only meaningful deviations tint emerald/rose. Empty hours are flat muted.
function barClass(games: number, wins: number): string {
  if (games === 0) return "bg-muted/30";
  const wr = wins / games;
  if (wr < 0.4) return "bg-rose-500/70";
  if (wr < 0.475) return "bg-rose-500/40";
  if (wr < 0.525) return "bg-muted-foreground/35";
  if (wr < 0.6) return "bg-emerald-500/40";
  return "bg-emerald-500/70";
}

function HourBar({ bucket, maxGames }: { bucket: ChronotypeHour; maxGames: number }) {
  const heightPct = (bucket.games / maxGames) * 100;
  const hourLabel = String(bucket.hour).padStart(2, "0");
  const wr = bucket.games ? Math.round((bucket.wins / bucket.games) * 100) : 0;
  const label = `${hourLabel}:00 · ${bucket.games} ${bucket.games === 1 ? "game" : "games"} · ${wr}% win`;
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>
        <div className="flex flex-1 flex-col items-stretch justify-end">
          <div
            className={`${barClass(bucket.games, bucket.wins)} rounded-sm`}
            style={{ height: `${Math.max(2, heightPct)}%` }}
          />
        </div>
      </TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side="top"
          sideOffset={4}
          className={TOOLTIP_CONTENT_CLASS}
        >
          {label}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

export function TileChronotype({ account }: { account: LolAccount | undefined }) {
  const query = useChronotype(account);
  if (!account) return <Empty verdict="No account connected yet." />;
  if (query.isPending) return <Empty verdict="Loading play distribution…" />;
  if (!query.data) return <Empty verdict="No play distribution available." />;

  const { hours, totalGames, timezone } = query.data;
  const maxGames = Math.max(...hours.map((h) => h.games), 1);
  const tzLabel = timezone.split("/").pop() ?? timezone;

  return (
    <Shell>
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-xs uppercase tracking-wide text-muted-foreground">
          Chronotype
        </h3>
        <SampleSizeBadge count={totalGames} />
      </div>
      <p className="text-base font-semibold leading-snug text-foreground/90">
        When I play, tinted by win rate.
      </p>
      <div className="mt-1 flex min-h-20 flex-1 items-stretch gap-0.5">
        {hours.map((bucket) => (
          <HourBar key={bucket.hour} bucket={bucket} maxGames={maxGames} />
        ))}
      </div>
      <div className="flex justify-between text-[10px] tabular-nums text-muted-foreground/60">
        <span>00</span>
        <span>06</span>
        <span>12</span>
        <span>18</span>
        <span>23</span>
      </div>
      <p className="mt-auto border-t border-border/40 pt-2.5 text-xs text-muted-foreground">
        Hours in {tzLabel} · last {totalGames} games
      </p>
    </Shell>
  );
}
