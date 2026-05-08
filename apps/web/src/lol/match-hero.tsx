import { cn } from "@/lib/utils";
import {
  ChampionCardChrome,
  championCardBaseClassName,
  championCardStyle,
} from "@/lol/champion-card";
import { useChampionName } from "@/lol/use-champions";
import type { MatchSummary } from "@vyoh/shared";
import { m } from "motion/react";

function formatDuration(sec: number): string {
  const mins = Math.floor(sec / 60);
  const secs = sec % 60;
  return `${mins}m ${secs.toString().padStart(2, "0")}s`;
}

export function MatchHero({ summary }: { summary: MatchSummary }) {
  const championName = useChampionName();
  const playedAt = new Date(summary.playedAt);
  const displayName = championName(summary.champion);
  return (
    <m.div
      layoutId={`match-card-${summary.matchId}`}
      transition={{ layout: { type: "spring", stiffness: 170, damping: 30 } }}
      style={championCardStyle(summary.champion)}
      className={cn(
        championCardBaseClassName,
        // Match the lifted-row treatment so the morph endpoint visually
        // floats above the surrounding detail content.
        "z-30 shadow-2xl shadow-black/50"
      )}
    >
      <ChampionCardChrome champion={summary.champion} win={summary.win} />
      <div className="relative ml-auto flex flex-col items-end gap-1">
        <div className="flex items-baseline gap-2">
          <span className="font-medium">{displayName}</span>
          <span
            className={cn(
              "text-xs font-semibold uppercase tracking-wider",
              summary.win ? "text-emerald-400" : "text-red-400"
            )}
          >
            {summary.win ? "Win" : "Loss"}
          </span>
        </div>
        <div className="font-mono text-sm tabular-nums">
          <span className="text-emerald-400">{summary.kills}</span>
          <span className="text-muted-foreground"> / </span>
          <span className="text-red-400">{summary.deaths}</span>
          <span className="text-muted-foreground"> / </span>
          <span className="text-amber-400">{summary.assists}</span>
        </div>
        <div className="text-xs text-muted-foreground">
          {summary.queueType} · {formatDuration(summary.durationSec)} ·{" "}
          {playedAt.toLocaleString(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </div>
      </div>
    </m.div>
  );
}
