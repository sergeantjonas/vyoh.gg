import { usePerfFlag } from "@/lib/use-perf-flag";
import { MatchRow, MatchSkeletonRow } from "@/lol/match-row";
import { useChampionName } from "@/lol/use-champions";
import { MATCHES_PAGE_SIZE } from "@/lol/use-matches";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import type { MatchSummary } from "@vyoh/shared";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

const ESTIMATED_ROW_HEIGHT = 124;
const NEAR_END_THRESHOLD = 5;

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
        const staggerDelay = (virtualRow.index % MATCHES_PAGE_SIZE) * 0.06;
        if (!match) {
          return (
            <MatchSkeletonRow
              key={`skeleton-${virtualRow.index}`}
              ref={virtualizer.measureElement}
              index={virtualRow.index}
              delay={staggerDelay}
              style={rowStyle}
            />
          );
        }
        return (
          <MatchRow
            key={match.matchId}
            ref={virtualizer.measureElement}
            match={match}
            accountSlug={accountSlug}
            championDisplayName={championName(match.champion)}
            index={virtualRow.index}
            delay={staggerDelay}
            style={rowStyle}
            onCardHover={onCardHover}
          />
        );
      })}
    </div>
  );
}
