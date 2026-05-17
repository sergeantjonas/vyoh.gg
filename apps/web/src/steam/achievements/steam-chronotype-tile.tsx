import { SampleSizeBadge } from "@/lol/trends/_shared/sample-size-badge";
import { useSteamChronotype } from "@/steam/use-steam-chronotype";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type { SteamChronotypeHour } from "@vyoh/shared";

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

// Single-ramp density encoding: no win-rate axis on Steam unlocks.
function barClass(count: number, maxCount: number): string {
  if (count === 0) return "bg-muted/30";
  const density = count / maxCount;
  if (density < 0.25) return "bg-sky-500/30";
  if (density < 0.5) return "bg-sky-500/55";
  if (density < 0.75) return "bg-sky-500/75";
  return "bg-sky-500/90";
}

function HourBar({
  bucket,
  maxCount,
}: {
  bucket: SteamChronotypeHour;
  maxCount: number;
}) {
  const heightPct = (bucket.count / maxCount) * 100;
  const hourLabel = String(bucket.hour).padStart(2, "0");
  const label = `${hourLabel}:00 · ${bucket.count} ${bucket.count === 1 ? "unlock" : "unlocks"}`;
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>
        <div className="flex flex-1 flex-col items-stretch justify-end">
          <div
            className={`${barClass(bucket.count, maxCount)} rounded-sm`}
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

export function SteamChronotypeTile() {
  const query = useSteamChronotype();
  if (query.isPending) return <Empty verdict="Loading unlock distribution…" />;
  if (!query.data) return <Empty verdict="No unlock data available." />;

  const { hours, totalCount, timeZone } = query.data;
  const maxCount = Math.max(...hours.map((h) => h.count), 1);
  const tzLabel = timeZone.split("/").pop() ?? timeZone;

  return (
    <Shell>
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-xs uppercase tracking-wide text-muted-foreground">
          Chronotype
        </h3>
        <SampleSizeBadge count={totalCount} />
      </div>
      <p className="text-base font-semibold leading-snug text-foreground/90">
        When I unlock achievements.
      </p>
      <div className="mt-1 flex min-h-20 flex-1 items-stretch gap-0.5">
        {hours.map((bucket) => (
          <HourBar key={bucket.hour} bucket={bucket} maxCount={maxCount} />
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
        Hours in {tzLabel} · last {totalCount} unlocks
      </p>
    </Shell>
  );
}
