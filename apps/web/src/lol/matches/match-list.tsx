import { mainScrollRef } from "@/lib/scroll-container";
import { usePerfFlag } from "@/lib/use-perf-flag";
import { useChampionName } from "@/lol/champions/use-champions";
import { useActiveMatch } from "@/lol/matches/active-match-context";
import { MatchCardSkeleton } from "@/lol/matches/match-list-skeleton";
import { MatchRow } from "@/lol/matches/match-row";
import { MATCHES_PAGE_SIZE } from "@/lol/matches/use-matches";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { MatchSummary } from "@vyoh/shared";
import { m } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

const ESTIMATED_ROW_HEIGHT = 124;
const NEAR_END_THRESHOLD = 5;
const STAGGER_PER_ITEM = 0.06;
const ENTER_DURATION = 0.2;
const INITIAL_VISIBLE = 20;
const REVEAL_INCREMENT = 20;
// While the back-nav scroll-restore + hero→row morph play out, swap
// non-active rows to skeletons at a low opacity so the strip reads as
// "loading" around the one card that came back. Mirrors the
// match-detail skeleton hold. ~32ms epoch bump + ~600ms spring settle,
// with a small buffer.
const SETTLE_HOLD_MS = 800;
const SETTLE_REVEAL_MS = 0.35;
const SETTLE_HOLD_OPACITY = 0.6;

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
  const { readListScroll, bumpMorphEpoch, activeMatch } = useActiveMatch();
  const [restoredScrollY] = useState(() => readListScroll());
  // When we land here from a match-detail back-nav, restoredScrollY > 0
  // and we want the surrounding rows to stay invisible until the morph is
  // back in place. With no scroll to restore (Trends → Matches, fresh
  // visit, etc.) start settled so rows render normally.
  const [settled, setSettled] = useState(() => restoredScrollY <= 0);
  useEffect(() => {
    if (settled) return;
    const id = window.setTimeout(() => setSettled(true), SETTLE_HOLD_MS);
    return () => window.clearTimeout(id);
  }, [settled]);
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
    mainScrollRef.current?.scrollTo(0, restoredScrollY);
  }

  useLayoutEffect(() => {
    const container = mainScrollRef.current;
    if (parentRef.current && container) {
      const parentRect = parentRef.current.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      setScrollMargin(parentRect.top - containerRect.top + container.scrollTop);
    }
    if (restoredScrollY <= 0 || !container) return;
    const target = restoredScrollY;
    container.scrollTo(0, target);
    let cancelled = false;
    const pinUntil = performance.now() + 600;
    const pin = () => {
      if (cancelled || performance.now() > pinUntil) return;
      if (Math.abs(container.scrollTop - target) > 1) container.scrollTo(0, target);
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

  const virtualizer = useVirtualizer({
    count: totalCount,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    scrollMargin,
    overscan: 4,
    getScrollElement: () => mainScrollRef.current,
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
        const isActiveRow = match !== undefined && activeMatch === match.matchId;
        // Non-active rows during settle stay at opacity-0 so the morphing
        // card travels through an empty strip; once the timer flips, they
        // fade in together.
        const heldDuringSettle = !settled && match !== undefined && !isActiveRow;
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
            initial={{
              opacity: isNew ? 0 : heldDuringSettle ? SETTLE_HOLD_OPACITY : 1,
            }}
            animate={{ opacity: heldDuringSettle ? SETTLE_HOLD_OPACITY : 1 }}
            transition={{
              duration: heldDuringSettle ? 0 : isNew ? ENTER_DURATION : SETTLE_REVEAL_MS,
              delay: heldDuringSettle ? 0 : isNew ? staggerDelay : 0,
              ease: "easeOut",
            }}
            style={rowStyle}
          >
            {match && !heldDuringSettle ? (
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
