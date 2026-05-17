// Baseline: personal — your hour-of-week WR; tooltip compares cell WR to your overall.
import { computeHabitsStats } from "@/lol/profile/use-habits-stats";
import type { HourDayStat } from "@/lol/profile/use-habits-stats";
import { ConclusionCard } from "@/lol/trends/_shared/conclusion-card";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { type MatchSummary, excludeRemakes } from "@vyoh/shared";
import type { CSSProperties } from "react";
import { useMemo } from "react";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_SHORT = ["M", "T", "W", "T", "F", "S", "S"];
const HOURS = Array.from({ length: 24 }, (_, h) => h);
const DAYS = DAY_SHORT.map((label, i) => ({ label, i }));
const GRID_COLS = "1.75rem repeat(24, 1fr)";
const EMPTY_STAT: HourDayStat = { hour: 0, day: 0, games: 0, wins: 0 };

const TOOLTIP_CONTENT_CLASS =
  "pointer-events-none z-50 rounded-md border bg-popover/85 px-2 py-1 text-xs text-popover-foreground shadow-xl backdrop-blur-md data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95";

const WR_COLORS = [
  { threshold: 0.65, rgb: "52,211,153" },
  { threshold: 0.55, rgb: "4,120,87" },
  { threshold: 0.45, rgb: "113,113,122" },
  { threshold: 0.35, rgb: "190,18,60" },
  { threshold: 0, rgb: "251,113,133" },
] as const;

function cellAlpha(games: number): number {
  return Math.min(0.35 + (games - 1) * 0.22, 1);
}

function cellBgStyle(games: number, wins: number): CSSProperties {
  if (games === 0) return {};
  const wr = wins / games;
  const match = WR_COLORS.find((c) => wr >= c.threshold);
  const rgb = match ? match.rgb : (WR_COLORS.at(-1)?.rgb ?? "113,113,122");
  return { backgroundColor: `rgba(${rgb},${cellAlpha(games)})` };
}

function cellLabel(stat: HourDayStat): string | null {
  if (stat.games === 0) return null;
  const wr = Math.round((stat.wins / stat.games) * 100);
  return `${stat.games} game${stat.games !== 1 ? "s" : ""} · ${wr}% WR`;
}

function HeatmapCell({
  stat,
  delay,
  highlight,
}: {
  stat: HourDayStat;
  delay: number;
  highlight: boolean;
}) {
  const label = cellLabel(stat);
  const cell = (
    <div
      className={`aspect-square rounded-sm heatmap-cell ${stat.games === 0 ? "bg-muted/20" : ""} ${highlight ? "ring-1 ring-offset-[1px] ring-foreground/40" : ""}`}
      style={{ animationDelay: `${delay}ms`, ...cellBgStyle(stat.games, stat.wins) }}
    />
  );
  if (!label) return cell;
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{cell}</TooltipPrimitive.Trigger>
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

const LEGEND_SWATCHES = WR_COLORS.map(({ rgb }) => `rgba(${rgb},1)`).reverse();

function HeatmapGrid({
  hourDay,
  bestKey,
}: {
  hourDay: HourDayStat[];
  bestKey: number | null;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="grid gap-0.5" style={{ gridTemplateColumns: GRID_COLS }}>
        <div />
        {HOURS.map((h) => (
          <div
            key={`hour-label-${h}`}
            className="text-center text-[9px] leading-none text-muted-foreground/60"
          >
            {h % 6 === 0 ? String(h) : ""}
          </div>
        ))}
      </div>
      {DAYS.map(({ label, i }) => (
        <div
          key={`day-${i}`}
          className="grid items-center gap-0.5"
          style={{ gridTemplateColumns: GRID_COLS }}
        >
          <div className="pr-1 text-right text-[9px] leading-none text-muted-foreground/60">
            {label}
          </div>
          {HOURS.map((h) => {
            const stat = hourDay[i * 24 + h] ?? EMPTY_STAT;
            return (
              <HeatmapCell
                key={`cell-${i}-${h}`}
                stat={stat}
                delay={(i + h) * 8}
                highlight={i * 24 + h === bestKey}
              />
            );
          })}
        </div>
      ))}
      <div className="flex items-center gap-3 pt-1 text-[10px] text-muted-foreground/60">
        <div className="flex gap-0.5">
          {LEGEND_SWATCHES.map((bg) => (
            <div
              key={bg}
              className="size-2.5 rounded-sm"
              style={{ backgroundColor: bg }}
            />
          ))}
        </div>
        <span>Low → High WR</span>
        <span className="ml-auto">Opacity = sample size</span>
      </div>
    </div>
  );
}

export function TrendTimeHeatmap({ current }: { current: MatchSummary[] }) {
  const playedCount = useMemo(() => excludeRemakes(current).length, [current]);
  const stats = useMemo(() => {
    if (current.length < 5) return null;
    return computeHabitsStats(current);
  }, [current]);

  const hasAnyData = stats ? stats.hourDay.some((s) => s.games > 0) : false;

  if (!stats || !hasAnyData) {
    return (
      <ConclusionCard
        title="When you play"
        sampleSize={playedCount}
        verdict="Not enough games yet to build a time heatmap."
        empty
      />
    );
  }

  const { hourDay } = stats;

  const populated = hourDay.filter((s) => s.games >= 3);
  const bestStat = [...populated].sort((a, b) => b.wins / b.games - a.wins / a.games)[0];
  const bestKey = bestStat ? bestStat.day * 24 + bestStat.hour : null;

  const sampleSize = hourDay.reduce((s, h) => s + h.games, 0);

  let verdict: string;
  let prescription: string | undefined;
  if (bestStat) {
    const wr = Math.round((bestStat.wins / bestStat.games) * 100);
    const dayName = DAY_LABELS[bestStat.day] ?? "Unknown";
    verdict = `Strongest slot: ${dayName} around ${bestStat.hour}:00 — ${wr}% WR over ${bestStat.games} games.`;
    if (bestStat.wins / bestStat.games > stats.overallWinRate + 0.1) {
      prescription = "Schedule ranked sessions there.";
    }
  } else {
    verdict = "Not enough data per slot yet.";
  }

  return (
    <ConclusionCard
      title="When you play"
      sampleSize={sampleSize}
      verdict={verdict}
      verdictMarkdown={verdict}
      prescription={prescription}
      prescriptionMarkdown={prescription}
      evidence={<HeatmapGrid hourDay={hourDay} bestKey={bestKey} />}
    />
  );
}
