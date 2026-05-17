import { useHomeChronotype } from "@/home/use-home-chronotype";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type { HomeChronotypeHour } from "@vyoh/shared";
import { useState } from "react";

const TOOLTIP_CONTENT_CLASS =
  "pointer-events-none z-50 w-max max-w-48 rounded-md border bg-popover/85 p-3 text-popover-foreground shadow-xl backdrop-blur-md data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95";

type Stream = "both" | "lol" | "steam";

const STREAM_OPTIONS: { value: Stream; label: string }[] = [
  { value: "both", label: "Both" },
  { value: "lol", label: "LoL" },
  { value: "steam", label: "Steam" },
];

function pickCount(bucket: HomeChronotypeHour, stream: Stream): number {
  if (stream === "lol") return bucket.lol;
  if (stream === "steam") return bucket.steam;
  return bucket.total;
}

function streamBarClass(stream: Stream, count: number, maxCount: number): string {
  if (count === 0) return "bg-muted/30";
  const density = count / maxCount;
  if (stream === "steam") {
    if (density < 0.25) return "bg-amber-500/30";
    if (density < 0.5) return "bg-amber-500/55";
    if (density < 0.75) return "bg-amber-500/75";
    return "bg-amber-500/90";
  }
  if (density < 0.25) return "bg-sky-500/30";
  if (density < 0.5) return "bg-sky-500/55";
  if (density < 0.75) return "bg-sky-500/75";
  return "bg-sky-500/90";
}

function eventNoun(stream: Stream, count: number): string {
  const plural = count === 1 ? "" : "s";
  if (stream === "lol") return `match${plural === "" ? "" : "es"}`;
  if (stream === "steam") return `unlock${plural}`;
  return `event${plural}`;
}

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

function StreamToggle({
  value,
  onChange,
}: {
  value: Stream;
  onChange: (next: Stream) => void;
}) {
  return (
    <div className="flex gap-0.5 rounded-md border border-border/50 bg-muted/30 p-0.5">
      {STREAM_OPTIONS.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
            className={`cursor-pointer rounded px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide transition-colors ${
              active
                ? "bg-foreground/10 text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function HourBar({
  bucket,
  stream,
  maxCount,
}: {
  bucket: HomeChronotypeHour;
  stream: Stream;
  maxCount: number;
}) {
  const count = pickCount(bucket, stream);
  const heightPct = (count / maxCount) * 100;
  const hourLabel = String(bucket.hour).padStart(2, "0");
  const label =
    stream === "both"
      ? `${hourLabel}:00 · ${bucket.lol} matches + ${bucket.steam} unlocks`
      : `${hourLabel}:00 · ${count} ${eventNoun(stream, count)}`;
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>
        <div className="flex flex-1 flex-col items-stretch justify-end">
          <div
            className={`${streamBarClass(stream, count, maxCount)} rounded-sm`}
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

function footerSample(
  stream: Stream,
  totalLolCount: number,
  totalSteamCount: number
): string {
  if (stream === "lol") return `${totalLolCount} matches`;
  if (stream === "steam") return `${totalSteamCount} unlocks`;
  return `${totalLolCount} matches + ${totalSteamCount} unlocks`;
}

export function TileChronotype() {
  const query = useHomeChronotype();
  const [stream, setStream] = useState<Stream>("both");

  if (query.isPending) return <Empty verdict="Loading play distribution…" />;
  if (!query.data) return <Empty verdict="No play distribution available." />;

  const { hours, totalLolCount, totalSteamCount, timeZone } = query.data;
  const maxCount = Math.max(...hours.map((h) => pickCount(h, stream)), 1);
  const tzLabel = timeZone.split("/").pop() ?? timeZone;
  const headline =
    stream === "lol"
      ? "When I play."
      : stream === "steam"
        ? "When I unlock achievements."
        : "When I play and unlock achievements.";

  return (
    <Shell>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs uppercase tracking-wide text-muted-foreground">
          Chronotype
        </h3>
        <StreamToggle value={stream} onChange={setStream} />
      </div>
      <p className="text-base font-semibold leading-snug text-foreground/90">
        {headline}
      </p>
      <div className="mt-1 flex min-h-20 flex-1 items-stretch gap-0.5">
        {hours.map((bucket) => (
          <HourBar
            key={bucket.hour}
            bucket={bucket}
            stream={stream}
            maxCount={maxCount}
          />
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
        Hours in {tzLabel} · {footerSample(stream, totalLolCount, totalSteamCount)}
      </p>
    </Shell>
  );
}
