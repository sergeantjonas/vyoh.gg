import { cn } from "@/lib/utils";
import { queueColor } from "@/lol/_shared/queue-color";
import {
  ChampionCardChrome,
  championCardBaseClassName,
  championCardStyle,
} from "@/lol/champions/champion-card";
import { useChampionName } from "@/lol/champions/use-champions";
import type { CardOrigin } from "@/lol/matches/active-match-context";
import { useActiveMatch } from "@/lol/matches/active-match-context";
import type { MatchSummary } from "@vyoh/shared";
import { useReducedMotion } from "motion/react";
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
  // Captured once on mount so StrictMode's double-invocation doesn't lose the
  // origin after the first run clears originRectRef.
  const savedOrigin = useRef<CardOrigin | null>(null);
  const playedAt = new Date(summary.playedAt);
  const displayName = championName(summary.champion);

  // Forward animation: set initial CSS transform to P_list before first paint,
  // then CSS-transition to the natural P_detail position.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional mount-only entrance animation
  useLayoutEffect(() => {
    if (!savedOrigin.current) {
      const o = originRectRef.current;
      if (!o || o.matchId !== summary.matchId || o.direction !== "forward") return;
      savedOrigin.current = o;
      setOriginRect(null);
    }
    const origin = savedOrigin.current;
    if (!origin || !heroRef.current) return;
    if (reduced) return;
    const el = heroRef.current;
    const dr = el.getBoundingClientRect();
    const dx = origin.rect.left - dr.left;
    const dy = origin.rect.top - dr.top;
    const sx = origin.rect.width / dr.width;
    const sy = origin.rect.height / dr.height;
    const anim = el.animate(
      [
        {
          transform: `translate(${dx}px, ${dy}px) scaleX(${sx}) scaleY(${sy})`,
          transformOrigin: "0 0",
        },
        { transform: "none", transformOrigin: "0 0" },
      ],
      { duration: 550, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "none" }
    );
    return () => anim.cancel();
  }, []);

  return (
    <div
      ref={heroRef}
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
    </div>
  );
}
