import { championIconUrl } from "@/lib/champion-icon";
import { cn } from "@/lib/utils";
import type { ChampionStats } from "./champion-stats";

function formatPlaytime(sec: number): string {
  const hours = sec / 3600;
  if (hours < 1) return `${Math.round(sec / 60)}m`;
  return `${hours.toFixed(1)}h`;
}

export function ChampionTable({ stats }: { stats: ChampionStats[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {stats.map((s) => (
        <li key={s.champion} className="flex items-center gap-4 rounded-md border p-3">
          <img
            src={championIconUrl(s.champion)}
            alt={s.champion}
            loading="lazy"
            className="size-12 rounded-md"
          />
          <div className="flex-1">
            <div className="font-medium">{s.champion}</div>
            <div className="text-sm text-muted-foreground">
              {s.games} {s.games === 1 ? "game" : "games"} ·{" "}
              {formatPlaytime(s.totalDurationSec)}
            </div>
          </div>
          <div className="text-right">
            <div
              className={cn(
                "font-mono text-sm",
                s.winRate >= 0.5 ? "text-emerald-500" : "text-red-500"
              )}
            >
              {Math.round(s.winRate * 100)}% WR
            </div>
            <div className="font-mono text-sm text-muted-foreground">
              {s.avgKda.toFixed(2)} KDA
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
