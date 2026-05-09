import { cn } from "@/lib/utils";
import { queueColor } from "@/lol/_shared/queue-color";
import {
  ChampionCardChrome,
  championCardBaseClassName,
  championCardStyle,
} from "@/lol/champions/champion-card";
import { useChampionName } from "@/lol/champions/use-champions";
import { useActiveMatch } from "@/lol/matches/active-match-context";
import type { MatchSummary } from "@vyoh/shared";
import { m, useAnimation, useReducedMotion } from "motion/react";
import { useLayoutEffect, useRef } from "react";

function formatDuration(sec: number): string {
  const mins = Math.floor(sec / 60);
  const secs = sec % 60;
  return `${mins}m ${secs.toString().padStart(2, "0")}s`;
}

export function MatchHero({ summary }: { summary: MatchSummary }) {
  const championName = useChampionName();
  const { originRectRef, setOriginRect } = useActiveMatch();
  const reduced = useReducedMotion();
  const heroRef = useRef<HTMLDivElement>(null);
  const controls = useAnimation();
  const playedAt = new Date(summary.playedAt);
  const displayName = championName(summary.champion);

  // Forward animation: snap to the list row's stored rect then spring to natural position.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional mount-only entrance animation
  useLayoutEffect(() => {
    const origin = originRectRef.current;
    if (origin?.matchId !== summary.matchId || !heroRef.current) return;
    setOriginRect(null);
    if (reduced) return;
    const detailRect = heroRef.current.getBoundingClientRect();
    const dx = origin.rect.left - detailRect.left;
    const dy = origin.rect.top - detailRect.top;
    const sx = origin.rect.width / detailRect.width;
    const sy = origin.rect.height / detailRect.height;
    controls.set({ x: dx, y: dy, scaleX: sx, scaleY: sy, originX: 0, originY: 0 });
    void controls.start({
      x: 0,
      y: 0,
      scaleX: 1,
      scaleY: 1,
      originX: 0,
      originY: 0,
      transition: { type: "spring", stiffness: 170, damping: 30 },
    });
  }, []);

  return (
    <m.div
      ref={heroRef}
      animate={controls}
      data-match-card={summary.matchId}
      style={championCardStyle(summary.champion)}
      className={cn(championCardBaseClassName, "z-30 shadow-2xl shadow-black/50")}
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
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span
            aria-hidden="true"
            className="size-2 shrink-0 rounded-sm"
            style={{ background: queueColor(summary.queueType) }}
          />
          <span>
            {summary.queueType} · {formatDuration(summary.durationSec)} ·{" "}
            {playedAt.toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </span>
        </div>
      </div>
    </m.div>
  );
}
