import { type HourDayStat, useHabitsStats } from "@/lol/profile/use-habits-stats";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type { CSSProperties } from "react";

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];
const HOURS = Array.from({ length: 24 }, (_, h) => h);
const DAYS = DAY_LABELS.map((label, i) => ({ label, i }));
const GRID_COLS = "1.75rem repeat(24, 1fr)";
const EMPTY_STAT: HourDayStat = { hour: 0, day: 0, games: 0, wins: 0 };

const TOOLTIP_CONTENT_CLASS =
  "pointer-events-none z-50 rounded-md border bg-popover/85 px-2 py-1 text-xs text-popover-foreground shadow-xl backdrop-blur-md data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95";

// rgb() strings for each win-rate band — used with alpha so CSS opacity animation
// and background transparency stay independent.
const WR_COLORS = [
  { threshold: 0.65, rgb: "52,211,153" }, // emerald-400
  { threshold: 0.55, rgb: "4,120,87" }, // emerald-700
  { threshold: 0.45, rgb: "113,113,122" }, // zinc-500
  { threshold: 0.35, rgb: "190,18,60" }, // rose-700
  { threshold: 0, rgb: "251,113,133" }, // rose-400
] as const;

// Alpha scales with game count: faint at 1 game, fully opaque at 4+.
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

function HeatmapCell({ stat, delay }: { stat: HourDayStat; delay: number }) {
  const label = cellLabel(stat);
  const cell = (
    <div
      className={`aspect-square rounded-sm heatmap-cell ${stat.games === 0 ? "bg-muted/20" : ""}`}
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

// Legend swatches mirror the WR_COLORS bands at full alpha.
const LEGEND_SWATCHES = WR_COLORS.map(({ rgb }) => `rgba(${rgb},1)`).reverse();

interface Props {
  champion?: string;
}

export function ProfileTimeHeatmap({ champion }: Props) {
  const stats = useHabitsStats(champion);
  if (!stats) return null;

  const { hourDay } = stats;
  const hasAnyData = hourDay.some((s) => s.games > 0);
  if (!hasAnyData) return null;

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-xs uppercase tracking-wide text-muted-foreground">
        When you play
      </h3>
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
                <HeatmapCell key={`cell-${i}-${h}`} stat={stat} delay={(i + h) * 8} />
              );
            })}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground/60">
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
    </section>
  );
}
