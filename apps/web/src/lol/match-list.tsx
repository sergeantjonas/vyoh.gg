import { CountUp } from "@/components/count-up";
import { usePerfFlag } from "@/lib/use-perf-flag";
import { cn } from "@/lib/utils";
import { CardTilt } from "@/lol/card-tilt";
import {
  ChampionCardChrome,
  championCardClassName,
  championCardStyle,
} from "@/lol/champion-card";
import { MatchCardSkeleton } from "@/lol/match-list-skeleton";
import { useChampionName } from "@/lol/use-champions";
import { MATCHES_PAGE_SIZE } from "@/lol/use-matches";
import { Link } from "@tanstack/react-router";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import type { MatchSummary } from "@vyoh/shared";
import { m } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

const ESTIMATED_ROW_HEIGHT = 124;
const NEAR_END_THRESHOLD = 5;

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

export function MatchList({
  matches,
  accountSlug,
  onCardHover,
  hasNextPage,
  fetchNextPage,
  isFetchingNextPage,
}: {
  matches: MatchSummary[];
  accountSlug: string;
  onCardHover?: (champion: string) => void;
  hasNextPage?: boolean;
  fetchNextPage?: () => void;
  isFetchingNextPage?: boolean;
}) {
  const championName = useChampionName();
  const showPerf = usePerfFlag();
  const parentRef = useRef<HTMLDivElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);

  useLayoutEffect(() => {
    if (parentRef.current) {
      setScrollMargin(parentRef.current.offsetTop);
    }
  }, []);

  const phantomCount = isFetchingNextPage && hasNextPage ? MATCHES_PAGE_SIZE : 0;
  const totalCount = matches.length + phantomCount;

  const virtualizer = useWindowVirtualizer({
    count: totalCount,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    scrollMargin,
    overscan: 4,
  });

  const items = virtualizer.getVirtualItems();
  const lastIndex = items.at(-1)?.index;

  useEffect(() => {
    if (lastIndex === undefined) return;
    if (
      lastIndex >= matches.length - NEAR_END_THRESHOLD &&
      hasNextPage &&
      !isFetchingNextPage &&
      fetchNextPage
    ) {
      fetchNextPage();
    }
  }, [lastIndex, matches.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <div
      ref={parentRef}
      className="relative"
      style={{ height: virtualizer.getTotalSize() }}
    >
      {showPerf && (
        <div className="fixed bottom-4 left-44 z-50 rounded-lg border border-border bg-background/85 px-3 py-2 font-mono text-xs shadow-lg backdrop-blur">
          <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            virtualizer
          </div>
          <ul className="space-y-0.5">
            <li className="flex justify-between gap-3">
              <span className="text-muted-foreground">rendered</span>
              <span className="text-emerald-400">{items.length}</span>
            </li>
            <li className="flex justify-between gap-3">
              <span className="text-muted-foreground">total</span>
              <span>{matches.length}</span>
            </li>
            <li className="flex justify-between gap-3">
              <span className="text-muted-foreground">saved</span>
              <span className="text-amber-400">
                {matches.length === 0
                  ? "—"
                  : `${Math.round(((matches.length - items.length) / matches.length) * 100)}%`}
              </span>
            </li>
          </ul>
        </div>
      )}
      {items.map((virtualRow) => {
        const match = matches[virtualRow.index];
        const rowStyle = {
          position: "absolute" as const,
          top: 0,
          left: 0,
          right: 0,
          transform: `translateY(${virtualRow.start - scrollMargin}px)`,
          paddingBottom: 12,
        };
        const staggerDelay = (virtualRow.index % MATCHES_PAGE_SIZE) * 0.03;
        if (!match) {
          return (
            <m.div
              key={`skeleton-${virtualRow.index}`}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2, delay: staggerDelay, ease: "easeOut" }}
              style={rowStyle}
            >
              <MatchCardSkeleton />
            </m.div>
          );
        }
        return (
          <m.div
            key={match.matchId}
            data-index={virtualRow.index}
            ref={virtualizer.measureElement}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2, delay: staggerDelay, ease: "easeOut" }}
            style={rowStyle}
          >
            <CardTilt>
              <Link
                to="/lol/$accountSlug/matches/$matchId"
                params={{ accountSlug, matchId: match.matchId }}
                onMouseEnter={() => onCardHover?.(match.champion)}
                style={championCardStyle(match.champion)}
                className={championCardClassName}
              >
                <ChampionCardChrome champion={match.champion} win={match.win} />
                <div className="relative ml-auto flex flex-col items-end gap-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-medium">{championName(match.champion)}</span>
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
                  <div className="text-xs text-muted-foreground">
                    {match.queueType} · {formatDuration(match.durationSec)} ·{" "}
                    {formatTimeAgo(match.playedAt)}
                  </div>
                </div>
              </Link>
            </CardTilt>
          </m.div>
        );
      })}
    </div>
  );
}
