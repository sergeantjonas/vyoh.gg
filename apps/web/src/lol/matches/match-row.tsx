import { CountUp } from "@/components/count-up";
import { cn } from "@/lib/utils";
import { CardTilt } from "@/lol/_shared/card-tilt";
import { queueColor } from "@/lol/_shared/queue-color";
import {
  ChampionCardChrome,
  championCardClassName,
  championCardStyle,
} from "@/lol/champions/champion-card";
import { useActiveMatch } from "@/lol/matches/active-match-context";
import { Link } from "@tanstack/react-router";
import type { MatchSummary } from "@vyoh/shared";
import { m, useAnimation, useReducedMotion } from "motion/react";
import { useLayoutEffect, useRef } from "react";

function formatDuration(sec: number): string {
  const mins = Math.floor(sec / 60);
  const secs = sec % 60;
  return `${mins}m ${secs.toString().padStart(2, "0")}s`;
}

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
}: {
  match: MatchSummary;
  accountSlug: string;
  championDisplayName: string;
  onCardHover?: (champion: string) => void;
  isNew?: boolean;
}) {
  const { setActiveMatch, saveListScroll, originRectRef, setOriginRect } =
    useActiveMatch();
  const reduced = useReducedMotion();
  const cardRef = useRef<HTMLDivElement>(null);
  const controls = useAnimation();

  // Return animation: when this row is the destination of a back-navigation,
  // snap to the hero card's last known rect and spring back to natural position.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional mount-only entrance animation
  useLayoutEffect(() => {
    const origin = originRectRef.current;
    if (origin?.matchId !== match.matchId || !cardRef.current) return;
    setOriginRect(null);
    if (reduced) return;
    const listRect = cardRef.current.getBoundingClientRect();
    const dx = origin.rect.left - listRect.left;
    const dy = origin.rect.top - listRect.top;
    const sx = origin.rect.width / listRect.width;
    const sy = origin.rect.height / listRect.height;
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
    <CardTilt>
      <Link
        to="/lol/$accountSlug/matches/$matchId"
        params={{ accountSlug, matchId: match.matchId }}
        onMouseEnter={() => onCardHover?.(match.champion)}
        onPointerDown={() => {
          saveListScroll();
          const rect = cardRef.current?.getBoundingClientRect() ?? null;
          if (rect) setOriginRect({ matchId: match.matchId, rect });
          setActiveMatch(match.matchId);
        }}
        className="block"
      >
        <m.div
          ref={cardRef}
          animate={controls}
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
              <span
                className={cn(
                  "text-xs font-semibold uppercase tracking-wider",
                  match.win ? "text-emerald-400" : "text-red-400"
                )}
              >
                {match.win ? "Win" : "Loss"}
              </span>
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
          </div>
        </m.div>
      </Link>
    </CardTilt>
  );
}
