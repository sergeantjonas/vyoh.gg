import { CountUp } from "@/components/count-up";
import { cn } from "@/lib/utils";
import { queueColor } from "@/lol/_shared/queue/queue-color";
import { CardTilt } from "@/lol/_shared/ui/card-tilt";
import {
  ChampionCardChrome,
  championCardClassName,
  championCardStyle,
} from "@/lol/champions/champion-card";
import { useChampionName } from "@/lol/champions/use-champions";
import type { CardOrigin } from "@/lol/matches/active-match-context";
import { useActiveMatch } from "@/lol/matches/active-match-context";
import { MatchListRowPopover } from "@/lol/matches/match-list-row-popover";
import { Link } from "@tanstack/react-router";
import { formatDuration } from "@vyoh/shared";
import type { MatchSummary } from "@vyoh/shared";
import { m, useReducedMotion } from "motion/react";
import { useLayoutEffect, useRef } from "react";

const ARAM_ARENA_QUEUES = new Set(["ARAM", "ARAM Clash", "Arena"]);

function formatTimeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.round(days / 7);
  return `${weeks}w ago`;
}

export function MatchRow({
  match,
  accountSlug,
  championDisplayName,
  onCardHover,
  isNew,
  lpDelta,
}: {
  match: MatchSummary;
  accountSlug: string;
  championDisplayName: string;
  onCardHover?: (champion: string) => void;
  isNew?: boolean;
  lpDelta?: number;
}) {
  const { setActiveMatch, saveListScroll, originRectRef, setOriginRect } =
    useActiveMatch();
  const championName = useChampionName();
  const reduced = useReducedMotion();
  const cardRef = useRef<HTMLDivElement>(null);
  // Captured once on mount so StrictMode's double-invocation doesn't lose the
  // origin after the first run clears originRectRef.
  const savedOrigin = useRef<CardOrigin | null>(null);

  // Return animation: when this row is the destination of a back-navigation,
  // snap to the hero card's last known rect and CSS-transition back to natural position.
  // Same delayed-consume pattern as match-hero: don't call setOriginRect(null) in the
  // layout effect body so StrictMode's surviving remount instance can still find the origin.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional mount-only entrance animation
  useLayoutEffect(() => {
    if (!savedOrigin.current) {
      const o = originRectRef.current;
      if (o?.matchId !== match.matchId || o.direction !== "backward") return;
      savedOrigin.current = o;
    }
    const origin = savedOrigin.current;
    if (!origin || !cardRef.current) return;
    if (reduced) return;
    const el = cardRef.current;
    el.style.visibility = "hidden";
    let cancelled = false;
    const rafId = requestAnimationFrame(() => {
      if (cancelled) return;
      setOriginRect(null);
      el.style.visibility = "";
      const listRect = el.getBoundingClientRect();
      const dx = origin.rect.left - listRect.left;
      const dy = origin.rect.top - listRect.top;
      const sx = origin.rect.width / listRect.width;
      const sy = origin.rect.height / listRect.height;
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

  const showVsLabel =
    match.laneOpponent !== null && !ARAM_ARENA_QUEUES.has(match.queueType);

  return (
    <MatchListRowPopover matchId={match.matchId} userChampion={match.champion}>
      <CardTilt>
        <div className="relative">
          <Link
            to="/lol/$accountSlug/champions/$championKey"
            params={{ accountSlug, championKey: match.champion.toLowerCase() }}
            aria-label={`${championDisplayName} dossier`}
            className="absolute inset-y-0 left-0 z-10 w-28 rounded-l-md"
          />
          <Link
            to="/lol/$accountSlug/matches/$matchId"
            params={{ accountSlug, matchId: match.matchId }}
            onMouseEnter={() => onCardHover?.(match.champion)}
            onPointerDown={() => {
              saveListScroll();
              const rect = cardRef.current?.getBoundingClientRect() ?? null;
              if (rect)
                setOriginRect({ matchId: match.matchId, rect, direction: "forward" });
              setActiveMatch(match.matchId);
            }}
            className="block"
          >
            <div
              ref={cardRef}
              style={championCardStyle(match.champion)}
              className={championCardClassName}
            >
              {isNew && !reduced && (
                <m.div
                  className="pointer-events-none absolute inset-0 rounded-md"
                  animate={{
                    boxShadow: match.win
                      ? [
                          "0 0 0 2px rgba(52,211,153,0)",
                          "0 0 0 2px rgba(52,211,153,0.45), 0 0 18px 3px rgba(52,211,153,0.14)",
                          "0 0 0 2px rgba(52,211,153,0)",
                        ]
                      : [
                          "0 0 0 2px rgba(248,113,113,0)",
                          "0 0 0 2px rgba(248,113,113,0.45), 0 0 18px 3px rgba(248,113,113,0.14)",
                          "0 0 0 2px rgba(248,113,113,0)",
                        ],
                  }}
                  transition={{ duration: 1.6, ease: "easeInOut" }}
                />
              )}
              <ChampionCardChrome champion={match.champion} win={match.win} />
              <div className="relative ml-auto flex flex-col items-end gap-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-medium">{championDisplayName}</span>
                  {match.remake ? (
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Remake
                    </span>
                  ) : (
                    <span
                      className={cn(
                        "text-xs font-semibold uppercase tracking-wider",
                        match.win ? "text-emerald-400" : "text-red-400"
                      )}
                    >
                      {match.win ? "Win" : "Loss"}
                    </span>
                  )}
                  {!match.remake && lpDelta !== undefined && (
                    <span
                      className={cn(
                        "text-xs tabular-nums",
                        lpDelta > 0
                          ? "text-emerald-400"
                          : lpDelta < 0
                            ? "text-red-400"
                            : "text-muted-foreground"
                      )}
                    >
                      {lpDelta > 0 ? "+" : ""}
                      {lpDelta} LP
                    </span>
                  )}
                </div>
                <div className="font-mono text-sm tabular-nums">
                  <CountUp to={match.kills} className="text-emerald-400" />
                  <span className="text-muted-foreground"> / </span>
                  <CountUp to={match.deaths} className="text-red-400" />
                  <span className="text-muted-foreground"> / </span>
                  <CountUp to={match.assists} className="text-amber-400" />
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span
                    aria-hidden="true"
                    className="size-2 shrink-0 rounded-sm"
                    style={{ background: queueColor(match.queueType) }}
                  />
                  <span>
                    {match.queueType} · {formatDuration(match.durationSec)} ·{" "}
                    {formatTimeAgo(match.playedAt)}
                  </span>
                </div>
                {showVsLabel && match.laneOpponent && (
                  <div className="text-xs text-muted-foreground/60">
                    vs {championName(match.laneOpponent.championName)}{" "}
                    <span className="text-muted-foreground/40">
                      ({match.laneOpponent.gameName}#{match.laneOpponent.tagLine})
                    </span>
                  </div>
                )}
              </div>
            </div>
          </Link>
        </div>
      </CardTilt>
    </MatchListRowPopover>
  );
}
