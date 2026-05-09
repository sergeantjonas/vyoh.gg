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

function LpBadge({ delta }: { delta: number }) {
  return (
    <span
      className={cn(
        "text-xs tabular-nums",
        delta > 0
          ? "text-emerald-400"
          : delta < 0
            ? "text-red-400"
            : "text-muted-foreground"
      )}
    >
      {delta > 0 ? "+" : ""}
      {delta} LP
    </span>
  );
}

function formatDuration(sec: number): string {
  const mins = Math.floor(sec / 60);
  const secs = sec % 60;
  return `${mins}m ${secs.toString().padStart(2, "0")}s`;
}

export function MatchHero({
  summary,
  lpDelta,
}: { summary: MatchSummary; lpDelta?: number }) {
  const championName = useChampionName();
  const { originRectRef, setOriginRect } = useActiveMatch();
  const reduced = useReducedMotion();
  const heroRef = useRef<HTMLDivElement>(null);
  // Captured once on mount so StrictMode's double-invocation doesn't lose the
  // origin after the first run clears originRectRef.
  const savedOrigin = useRef<CardOrigin | null>(null);
  const playedAt = new Date(summary.playedAt);
  const displayName = championName(summary.champion);

  // Forward animation: morph from the list card rect to the hero's natural position.
  // We defer the origin consume and the getBoundingClientRect call to the RAF so:
  //  (a) AnimatePresence's parent layout effect has already popped the exiting page
  //      out of flow (otherwise the virtualizer's ~2480px container displaces dr.top)
  //  (b) React StrictMode mounts → cleans up → remounts with a fresh instance before
  //      the RAF fires, so the surviving instance consumes the origin — not an earlier
  //      one that gets thrown away.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional mount-only entrance animation
  useLayoutEffect(() => {
    if (!savedOrigin.current) {
      const o = originRectRef.current;
      if (!o || o.matchId !== summary.matchId || o.direction !== "forward") return;
      savedOrigin.current = o;
      // Do NOT call setOriginRect(null) here — delay until the RAF so StrictMode's
      // cleanup-and-remount cycle can still find the origin on the surviving instance.
    }
    const origin = savedOrigin.current;
    if (!origin || !heroRef.current) return;
    if (reduced) return;
    const el = heroRef.current;
    el.style.visibility = "hidden";
    let cancelled = false;
    const rafId = requestAnimationFrame(() => {
      if (cancelled) return;
      // Consume the origin now — we're the surviving instance.
      setOriginRect(null);
      el.style.visibility = "";
      const dr = el.getBoundingClientRect();
      const dx = origin.rect.left - dr.left;
      const dy = origin.rect.top - dr.top;
      const sx = origin.rect.width / dr.width;
      const sy = origin.rect.height / dr.height;
      el.animate(
        [
          {
            transform: `translate(${dx}px, ${dy}px) scaleX(${sx}) scaleY(${sy})`,
            transformOrigin: "0 0",
          },
          { transform: "none", transformOrigin: "0 0" },
        ],
        { duration: 550, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "none" }
      );
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      el.style.visibility = "";
    };
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
          {summary.remake ? (
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Remake
            </span>
          ) : (
            <span
              className={cn(
                "text-xs font-semibold uppercase tracking-wider",
                summary.win ? "text-emerald-400" : "text-red-400"
              )}
            >
              {summary.win ? "Win" : "Loss"}
            </span>
          )}
          {!summary.remake && lpDelta !== undefined && <LpBadge delta={lpDelta} />}
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
