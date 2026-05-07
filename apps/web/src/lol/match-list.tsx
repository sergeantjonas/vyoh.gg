import { usePerfFlag } from "@/lib/use-perf-flag";
import { useActiveMatch } from "@/lol/active-match-context";
import { MatchCardSkeleton } from "@/lol/match-list-skeleton";
import { MatchRow } from "@/lol/match-row";
import { useChampionName } from "@/lol/use-champions";
import { MATCHES_PAGE_SIZE } from "@/lol/use-matches";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import type { MatchSummary } from "@vyoh/shared";
import { m } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

const ESTIMATED_ROW_HEIGHT = 124;
const NEAR_END_THRESHOLD = 5;
const STAGGER_PER_ITEM = 0.06;
const ENTER_DURATION = 0.2;
const INITIAL_VISIBLE = 20;
const REVEAL_INCREMENT = 10;

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
  const prevMatchesLengthRef = useRef<number | null>(null);
  const [scrollMargin, setScrollMargin] = useState(0);
  const { readListScroll, bumpMorphEpoch } = useActiveMatch();
  const [restoredScrollY] = useState(() => readListScroll());
  const [visibleCount, setVisibleCount] = useState(() => {
    if (restoredScrollY > 0) {
      const neededRows =
        Math.ceil((restoredScrollY + window.innerHeight) / ESTIMATED_ROW_HEIGHT) + 4;
      return Math.max(neededRows, INITIAL_VISIBLE);
    }
    return INITIAL_VISIBLE;
  });
  const seenCountRef = useRef(restoredScrollY > 0 ? visibleCount : 0);
  const didInitialScrollRef = useRef(false);
  if (!didInitialScrollRef.current && restoredScrollY > 0) {
    didInitialScrollRef.current = true;
    window.scrollTo(0, restoredScrollY);
  }

  useLayoutEffect(() => {
    if (parentRef.current) {
      setScrollMargin(parentRef.current.offsetTop);
    }
    if (restoredScrollY <= 0) return;
    const target = restoredScrollY;
    window.scrollTo(0, target);
    let cancelled = false;
    const pinUntil = performance.now() + 600;
    const pin = () => {
      if (cancelled || performance.now() > pinUntil) return;
      if (Math.abs(window.scrollY - target) > 1) window.scrollTo(0, target);
      requestAnimationFrame(pin);
    };
    requestAnimationFrame(pin);
    const epochId = window.setTimeout(() => bumpMorphEpoch(), 32);
    return () => {
      cancelled = true;
      window.clearTimeout(epochId);
    };
  }, [restoredScrollY, bumpMorphEpoch]);

  // Bump visibleCount when fresh data arrives via fetchNextPage so phantoms
  // don't suddenly disappear when their indices fall back outside the count.
  useEffect(() => {
    if (
      prevMatchesLengthRef.current !== null &&
      matches.length > prevMatchesLengthRef.current
    ) {
      setVisibleCount((v) => Math.max(v, matches.length));
    }
    prevMatchesLengthRef.current = matches.length;
  }, [matches.length]);

  const reveal = Math.min(visibleCount, matches.length);
  const phantomCount = isFetchingNextPage && hasNextPage ? MATCHES_PAGE_SIZE : 0;
  const totalCount = reveal + phantomCount;

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
    if (lastIndex < reveal - NEAR_END_THRESHOLD) return;
    if (visibleCount < matches.length) {
      setVisibleCount((v) => v + REVEAL_INCREMENT);
    } else if (hasNextPage && !isFetchingNextPage && fetchNextPage) {
      fetchNextPage();
    }
  }, [
    lastIndex,
    reveal,
    visibleCount,
    matches.length,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  ]);

  const seenCount = seenCountRef.current;
  useEffect(() => {
    seenCountRef.current = reveal;
  }, [reveal]);

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
        const isNew = virtualRow.index >= seenCount;
        const staggerDelay = isNew
          ? (virtualRow.index - seenCount) * STAGGER_PER_ITEM
          : 0;
        const rowStyle = {
          position: "absolute" as const,
          top: 0,
          left: 0,
          right: 0,
          transform: `translateY(${virtualRow.start - scrollMargin}px)`,
          paddingBottom: 12,
        };
        return (
          <m.div
            key={virtualRow.index}
            data-index={virtualRow.index}
            ref={virtualizer.measureElement}
            initial={{ opacity: isNew ? 0 : 1 }}
            animate={{ opacity: 1 }}
            transition={{
              duration: isNew ? ENTER_DURATION : 0,
              delay: staggerDelay,
              ease: "easeOut",
            }}
            style={rowStyle}
          >
            {match ? (
              <MatchRow
                match={match}
                accountSlug={accountSlug}
                championDisplayName={championName(match.champion)}
                onCardHover={onCardHover}
              />
            ) : (
              <MatchCardSkeleton />
            )}
          </m.div>
        );
      })}
    </div>
  );
}
