import { m, useReducedMotion } from "motion/react";
import { useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import type { QueueCount } from "./trend-stats";

const PALETTE = [
  "#38bdf8", // sky
  "#34d399", // emerald
  "#fbbf24", // amber
  "#a78bfa", // violet
  "#f472b6", // pink
  "#fb923c", // orange
];

export function TrendQueue({ counts }: { counts: QueueCount[] }) {
  const reduced = useReducedMotion();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const total = counts.reduce((s, c) => s + c.count, 0);
  const active = activeIndex !== null ? counts[activeIndex] : null;
  const activeCount = active?.count ?? total;
  const activeLabel = active?.queueType ?? (total === 1 ? "game" : "games");
  const activePct = active && total > 0 ? Math.round((active.count / total) * 100) : null;

  return (
    <m.section
      className="flex flex-col gap-2"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        type: "spring",
        stiffness: 380,
        damping: 30,
        delay: reduced ? 0 : 0.4,
      }}
    >
      <h3 className="text-sm font-medium text-muted-foreground">Queue distribution</h3>
      <div className="grid grid-cols-[1fr_auto] items-center gap-6">
        <div className="relative h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={counts}
                dataKey="count"
                nameKey="queueType"
                innerRadius="62%"
                outerRadius="92%"
                paddingAngle={2}
                stroke="var(--background)"
                strokeWidth={2}
                startAngle={90}
                endAngle={-270}
                animationDuration={1100}
                animationBegin={reduced ? 0 : 560}
                animationEasing="ease-out"
                isAnimationActive
                onMouseEnter={(_, i) => setActiveIndex(i)}
                onMouseLeave={() => setActiveIndex(null)}
              >
                {counts.map((entry, i) => {
                  const isDimmed = activeIndex !== null && activeIndex !== i;
                  return (
                    <Cell
                      key={entry.queueType}
                      fill={PALETTE[i % PALETTE.length]}
                      opacity={isDimmed ? 0.35 : 1}
                      style={{ transition: "opacity 150ms ease-out" }}
                    />
                  );
                })}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-[26%]">
            <div className="text-2xl font-semibold tabular-nums">{activeCount}</div>
            <div className="w-full truncate text-center text-xs uppercase tracking-wide text-foreground">
              {activePct !== null ? `${activePct}% · ${activeLabel}` : activeLabel}
            </div>
          </div>
        </div>
        <ul className="flex flex-col gap-2 text-sm">
          {counts.map((entry, i) => {
            const isDimmed = activeIndex !== null && activeIndex !== i;
            return (
              <li
                key={entry.queueType}
                className="flex cursor-default items-center gap-2 transition-opacity duration-150"
                style={{ opacity: isDimmed ? 0.4 : 1 }}
                onMouseEnter={() => setActiveIndex(i)}
                onMouseLeave={() => setActiveIndex(null)}
              >
                <span
                  className="size-2.5 rounded-sm"
                  style={{ background: PALETTE[i % PALETTE.length] }}
                />
                <span className="text-foreground">{entry.queueType}</span>
                <span className="ml-auto tabular-nums text-muted-foreground">
                  {entry.count}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </m.section>
  );
}
