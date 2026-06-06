import { SectionTitle } from "@/components/ui/section-title";
import { SHADOW_BODY, SHADOW_LABEL } from "@/home/recap/chapter-shadows";
import { useHomeChronotype } from "@/home/use-home-chronotype";
import { useHomeDaySplit } from "@/home/use-home-day-split";
import { useHomeSessionLengths } from "@/home/use-home-session-lengths";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type {
  HomeChronotypeHour,
  HomeDaySplitHour,
  HomeSessionLengthsBucket,
} from "@vyoh/shared";
import { formatHoursMinutes, formatPercent } from "@vyoh/shared";

// Tooltip class shared with the bento tiles' bar charts. Re-declared here so
// the conclusion's sub-strips don't import from soon-to-retire tile modules.
const TOOLTIP_CONTENT_CLASS =
  "pointer-events-none z-50 w-max max-w-48 rounded-md border bg-popover/85 p-3 text-popover-foreground shadow-xl backdrop-blur-md data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95";

function StripHeader({
  label,
  legend,
}: {
  label: string;
  legend?: React.ReactNode;
}) {
  // The legend slot is always rendered (even when empty) so every strip
  // header occupies the same vertical space. Without this, a strip
  // without a legend has a shorter header and its `flex-1` bar area
  // absorbs the extra height, making its bars visibly taller than the
  // strips that do carry a legend — visible misalignment across the
  // three columns.
  return (
    <div className="flex h-4 items-center justify-between gap-2">
      <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
      <div className="flex items-center gap-3 text-[10px] uppercase tracking-wide text-muted-foreground/70">
        {legend}
      </div>
    </div>
  );
}

function StreamLegend() {
  return (
    <>
      <span className="flex items-center gap-1.5">
        <span className="inline-block size-2 rounded-sm bg-sky-500/80" />
        LoL
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block size-2 rounded-sm bg-amber-500/80" />
        Steam
      </span>
    </>
  );
}

function StripCaption({ children }: { children: React.ReactNode }) {
  return (
    <p className="border-t border-border/40 pt-2.5 text-[11px] text-muted-foreground">
      {children}
    </p>
  );
}

function StripFallback({
  label,
  message,
  legend,
}: {
  label: string;
  message: string;
  legend?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <StripHeader label={label} legend={legend} />
      <p className="text-sm leading-snug text-muted-foreground/70">{message}</p>
    </div>
  );
}

function HoursStrip() {
  const query = useHomeChronotype();
  if (query.isPending) {
    return <StripFallback label="When" message="Loading hours…" />;
  }
  if (!query.data) {
    return <StripFallback label="When" message="No hour distribution yet." />;
  }
  const { hours, totalLolCount, totalSteamCount, timeZone } = query.data;
  const total = totalLolCount + totalSteamCount;
  if (total === 0) {
    return <StripFallback label="When" message="Not enough activity yet." />;
  }
  const maxCount = Math.max(...hours.map((h) => h.total), 1);
  const tzLabel = timeZone.split("/").pop() ?? timeZone;
  return (
    <div className="flex flex-col gap-3">
      <StripHeader label="When" />
      <div className="flex h-20 items-stretch gap-0.5">
        {hours.map((bucket) => (
          <HoursBar key={bucket.hour} bucket={bucket} maxCount={maxCount} />
        ))}
      </div>
      <HourAxis />
      <StripCaption>
        Events per hour · {tzLabel} · {totalLolCount} matches + {totalSteamCount} unlocks
      </StripCaption>
    </div>
  );
}

function HoursBar({
  bucket,
  maxCount,
}: {
  bucket: HomeChronotypeHour;
  maxCount: number;
}) {
  const heightPct = (bucket.total / maxCount) * 100;
  const hourLabel = String(bucket.hour).padStart(2, "0");
  const tooltip = `${hourLabel}:00 · ${bucket.lol} matches + ${bucket.steam} unlocks`;
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>
        <div className="flex flex-1 flex-col items-stretch justify-end">
          <div
            className="rounded-sm bg-foreground/55"
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
          {tooltip}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

function HourAxis() {
  return (
    <div className="flex justify-between text-[10px] tabular-nums text-muted-foreground/60">
      <span>00</span>
      <span>06</span>
      <span>12</span>
      <span>18</span>
      <span>23</span>
    </div>
  );
}

function StreamSplitStrip() {
  const query = useHomeDaySplit();
  if (query.isPending) {
    return (
      <StripFallback
        label="Where"
        message="Loading stream split…"
        legend={<StreamLegend />}
      />
    );
  }
  if (!query.data) {
    return (
      <StripFallback
        label="Where"
        message="No stream split yet."
        legend={<StreamLegend />}
      />
    );
  }
  const { hours, totalLolMinutes, totalSteamMinutes, timeZone } = query.data;
  const grand = totalLolMinutes + totalSteamMinutes;
  if (grand === 0) {
    return (
      <StripFallback
        label="Where"
        message="Not enough closed sessions yet."
        legend={<StreamLegend />}
      />
    );
  }
  const maxMinutes = Math.max(...hours.map((h) => h.lolMinutes + h.steamMinutes), 1);
  const tzLabel = timeZone.split("/").pop() ?? timeZone;
  const lolShare = formatPercent(totalLolMinutes / grand);
  const steamShare = formatPercent(totalSteamMinutes / grand);
  return (
    <div className="flex flex-col gap-3">
      <StripHeader label="Where" legend={<StreamLegend />} />
      <div className="flex h-20 items-stretch gap-0.5">
        {hours.map((bucket) => (
          <StreamSplitBar key={bucket.hour} bucket={bucket} maxMinutes={maxMinutes} />
        ))}
      </div>
      <HourAxis />
      <StripCaption>
        Hours by stream · {tzLabel} · {lolShare} LoL / {steamShare} Steam
      </StripCaption>
    </div>
  );
}

function StreamSplitBar({
  bucket,
  maxMinutes,
}: {
  bucket: HomeDaySplitHour;
  maxMinutes: number;
}) {
  const total = bucket.lolMinutes + bucket.steamMinutes;
  const heightPct = (total / maxMinutes) * 100;
  const lolPct = total > 0 ? (bucket.lolMinutes / total) * 100 : 0;
  const steamPct = total > 0 ? (bucket.steamMinutes / total) * 100 : 0;
  const hourLabel = String(bucket.hour).padStart(2, "0");
  const lines: string[] = [];
  if (bucket.lolMinutes > 0) lines.push(`LoL ${formatHoursMinutes(bucket.lolMinutes)}`);
  if (bucket.steamMinutes > 0) {
    lines.push(`Steam ${formatHoursMinutes(bucket.steamMinutes)}`);
  }
  const tooltip =
    lines.length === 0
      ? `${hourLabel}:00 · no play`
      : `${hourLabel}:00 · ${lines.join(" + ")}`;
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>
        <div className="flex flex-1 flex-col items-stretch justify-end">
          {total === 0 ? (
            <div className="rounded-sm bg-muted/30" style={{ height: "2%" }} />
          ) : (
            <div
              className="flex flex-col overflow-hidden rounded-sm"
              style={{ height: `${Math.max(2, heightPct)}%` }}
            >
              {bucket.steamMinutes > 0 && (
                <div className="bg-amber-500/80" style={{ height: `${steamPct}%` }} />
              )}
              {bucket.lolMinutes > 0 && (
                <div className="bg-sky-500/80" style={{ height: `${lolPct}%` }} />
              )}
            </div>
          )}
        </div>
      </TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side="top"
          sideOffset={4}
          className={TOOLTIP_CONTENT_CLASS}
        >
          {tooltip}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

function plural(n: number, singular: string): string {
  return `${n} ${singular}${n === 1 ? "" : "s"}`;
}

function SessionsStrip() {
  const query = useHomeSessionLengths();
  if (query.isPending) {
    return (
      <StripFallback
        label="How long"
        message="Loading session shapes…"
        legend={<StreamLegend />}
      />
    );
  }
  if (!query.data) {
    return (
      <StripFallback
        label="How long"
        message="No session data yet."
        legend={<StreamLegend />}
      />
    );
  }
  const { buckets, lolSessionCount, steamSessionCount } = query.data;
  const grand = lolSessionCount + steamSessionCount;
  if (grand === 0) {
    return (
      <StripFallback
        label="How long"
        message="Not enough closed sessions yet."
        legend={<StreamLegend />}
      />
    );
  }
  const maxCount = Math.max(...buckets.map((b) => b.lolCount + b.steamCount), 1);
  const shortCount = buckets
    .filter((b) => b.label === "<30m" || b.label === "30m–1h")
    .reduce((sum, b) => sum + b.lolCount + b.steamCount, 0);
  const shortShare = formatPercent(shortCount / grand);
  return (
    <div className="flex flex-col gap-3">
      <StripHeader label="How long" legend={<StreamLegend />} />
      <div className="flex h-20 items-stretch gap-2">
        {buckets.map((bucket) => (
          <SessionBar key={bucket.label} bucket={bucket} maxCount={maxCount} />
        ))}
      </div>
      <SessionAxis buckets={buckets} />
      <StripCaption>
        {shortShare} under 1h · {plural(lolSessionCount, "LoL session")} +{" "}
        {plural(steamSessionCount, "Steam session")}
      </StripCaption>
    </div>
  );
}

function SessionAxis({ buckets }: { buckets: HomeSessionLengthsBucket[] }) {
  // Mirrors `HourAxis` structurally so the sessions strip ends up with the
  // same row count as `WHEN` / `WHERE` (header / bars / axis / caption).
  // Without this, per-bucket labels lived inside `SessionBar` as inline
  // spans, so this strip had one fewer row — the `flex-1` bar area then
  // absorbed the missing row's height, making its bars visibly taller
  // than the other two columns.
  return (
    <div className="flex items-stretch gap-2 text-[10px] tabular-nums text-muted-foreground/60">
      {buckets.map((bucket) => (
        <span key={bucket.label} className="flex-1 text-center">
          {bucket.label}
        </span>
      ))}
    </div>
  );
}

function SessionBar({
  bucket,
  maxCount,
}: {
  bucket: HomeSessionLengthsBucket;
  maxCount: number;
}) {
  const total = bucket.lolCount + bucket.steamCount;
  const heightPct = (total / maxCount) * 100;
  const lolPct = total > 0 ? (bucket.lolCount / total) * 100 : 0;
  const steamPct = total > 0 ? (bucket.steamCount / total) * 100 : 0;
  const lines: string[] = [];
  if (bucket.lolCount > 0) lines.push(`LoL ${plural(bucket.lolCount, "session")}`);
  if (bucket.steamCount > 0) {
    lines.push(`Steam ${plural(bucket.steamCount, "session")}`);
  }
  const tooltip =
    lines.length === 0
      ? `${bucket.label} · no sessions`
      : `${bucket.label} · ${lines.join(" + ")}`;
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>
        <div className="flex flex-1 flex-col justify-end">
          {total === 0 ? (
            <div className="rounded-sm bg-muted/30" style={{ height: "2%" }} />
          ) : (
            <div
              className="flex flex-col overflow-hidden rounded-sm"
              style={{ height: `${Math.max(4, heightPct)}%` }}
            >
              {bucket.steamCount > 0 && (
                <div className="bg-amber-500/80" style={{ height: `${steamPct}%` }} />
              )}
              {bucket.lolCount > 0 && (
                <div className="bg-sky-500/80" style={{ height: `${lolPct}%` }} />
              )}
            </div>
          )}
        </div>
      </TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side="top"
          sideOffset={4}
          className={TOOLTIP_CONTENT_CLASS}
        >
          {tooltip}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

/**
 * Conclusion rhythm band — three orthogonal lenses on activity shape.
 * Absorbs the three bento tiles `TileChronotype`, `TileDaySplit`, and
 * `TileSessionLengths` into one editorial beat. Bare-typography register
 * matches the other multi-beat chapters (Ahri, Steam subjects); the band
 * lives directly against the conclusion palette backdrop without card
 * chrome.
 */
export function ConclusionRhythmBand() {
  return (
    <section className="flex flex-col gap-5">
      <header className="flex flex-col items-center gap-1 text-center">
        <SectionTitle style={{ textShadow: SHADOW_LABEL }}>Rhythm</SectionTitle>
        <p className="text-sm text-foreground/65" style={{ textShadow: SHADOW_BODY }}>
          When events land, where the hours go, how long a sitting lasts.
        </p>
      </header>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <HoursStrip />
        <StreamSplitStrip />
        <SessionsStrip />
      </div>
    </section>
  );
}
