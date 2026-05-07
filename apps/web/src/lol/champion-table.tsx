import { cn } from "@/lib/utils";
import { CardTilt } from "@/lol/card-tilt";
import {
  ChampionCardChrome,
  championCardClassName,
  championCardStyle,
} from "@/lol/champion-card";
import { type Variants, m } from "motion/react";
import type { ChampionStats } from "./champion-stats";
import { useChampionName } from "./use-champions";

const container: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 380, damping: 28 },
  },
};

function formatPlaytime(sec: number): string {
  const hours = sec / 3600;
  if (hours < 1) return `${Math.round(sec / 60)}m`;
  return `${hours.toFixed(1)}h`;
}

export function ChampionTable({
  stats,
  onCardHover,
}: {
  stats: ChampionStats[];
  onCardHover?: (champion: string) => void;
}) {
  const championName = useChampionName();
  return (
    <m.ul
      initial="hidden"
      animate="show"
      variants={container}
      className="flex flex-col gap-3"
    >
      {stats.map((s) => (
        <m.li key={s.champion} variants={item}>
          <CardTilt>
            <div
              onMouseEnter={() => onCardHover?.(s.champion)}
              style={championCardStyle(s.champion)}
              className={championCardClassName}
            >
              <ChampionCardChrome champion={s.champion} />
              <div className="relative ml-auto flex flex-col items-end gap-1">
                <div className="font-medium">{championName(s.champion)}</div>
                <div className="font-mono text-sm tabular-nums">
                  <span
                    className={cn(s.winRate >= 0.5 ? "text-emerald-400" : "text-red-400")}
                  >
                    {Math.round(s.winRate * 100)}%
                  </span>
                  <span className="text-muted-foreground"> WR · </span>
                  <span className="text-amber-400">{s.avgKda.toFixed(2)}</span>
                  <span className="text-muted-foreground"> KDA</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {s.games} {s.games === 1 ? "game" : "games"} ·{" "}
                  {formatPlaytime(s.totalDurationSec)}
                </div>
              </div>
            </div>
          </CardTilt>
        </m.li>
      ))}
    </m.ul>
  );
}
