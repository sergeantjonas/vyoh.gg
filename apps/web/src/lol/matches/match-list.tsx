import { VirtualizerStats } from "@/components/virtualizer-stats";
import { mainScrollRef } from "@/lib/scroll-container";
import { useChampionName } from "@/lol/champions/use-champions";
import { useActiveMatch } from "@/lol/matches/active-match-context";
import { MatchCardSkeleton } from "@/lol/matches/match-list-skeleton";
import { MatchRow } from "@/lol/matches/match-row";
import { computeLpDeltaMap } from "@/lol/matches/use-lp-delta";
import { MATCHES_PAGE_SIZE } from "@/lol/matches/use-matches";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { MatchSummary } from "@vyoh/shared";
import { m } from "motion/react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

const SSE_FLASH_TTL_MS = 2500;

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
  onCardHover?: ((champion: string) => void) | undefined;
  hasNextPage?: boolean | undefined;
  fetchNextPage?: (() => void) | undefined;
  isFetchingNextPage?: boolean | undefined;
}) {
  const championName = useChampionName();
  const parentRef = useRef<HTMLDivElement>(null);
  const prevMatchesLengthRef = useRef<number | null>(null);
  const prevMatchIdsRef = useRef<Set<string>>(new Set());
  const [flashMatchIds, setFlashMatchIds] = useState<Set<string>>(new Set());
  const [scrollMargin, setScrollMargin] = useState(0);
  const { readListScroll, activeMatch } = useActiveMatch();
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
  // Guard pattern: marks complete ONLY after the pin loop has actually run
  // (any RAF tick fired, or the 600 ms window naturally expired). Critically,
  // we do NOT mark complete inside the effect body just because we set up the
  // loop — in React StrictMode (dev), the mount-cleanup-remount cycle can run
  // before the first RAF fires, which means the loop's `cancelled` flag is
  // tripped before any work happens. If we'd marked complete in the body
  // (the old `didPinRef.current = true` pattern), the StrictMode remount
  // would see the guard set and skip restarting the loop — leaving scroll
  // wherever it landed in the body's initial scrollTo call (often clamped
  // to 0 when the virtualizer's total-size container shrinks momentarily
  // during the setScrollMargin-triggered re-render).
  const pinCompletedRef = useRef(false);
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
    // Guard against React 19 `reappearLayoutEffects` re-firing this hook on
    // Activity/Suspense reveal (the replay would re-assert the saved
    // scrollTop *after* useScrollResetOnNav reset it on forward nav).
    if (pinCompletedRef.current) return;
    if (restoredScrollY <= 0 || !container) return;
    const target = restoredScrollY;
    container.scrollTo(0, target);
    let cancelled = false;
    let pinTicks = 0;
    const pinUntil = performance.now() + 600;
    const pin = () => {
      if (cancelled) return;
      if (performance.now() > pinUntil) {
        // Natural expiration → pin loop succeeded (or gave up after 600ms).
        // Mark complete so re-fires from Activity/Suspense don't re-assert
        // the saved scroll on top of a newer user scroll.
        pinCompletedRef.current = true;
        return;
      }
      pinTicks++;
      if (Math.abs(container.scrollTop - target) > 1) container.scrollTo(0, target);
      requestAnimationFrame(pin);
    };
    requestAnimationFrame(pin);
    return () => {
      cancelled = true;
      // If the loop got at least one RAF tick before being cancelled, count
      // that as "ran" and mark complete. This handles the case where the user
      // navigates away mid-pin (real cleanup). StrictMode's pre-RAF cleanup
      // leaves pinTicks at 0, which intentionally does NOT mark complete —
      // remount restarts the loop.
      if (pinTicks > 0) {
        pinCompletedRef.current = true;
      }
    };
  }, [restoredScrollY]);

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

  // Detect SSE-inserted matches: new matchIds that appear at the head of the
  // array (prepended by the server) rather than the tail (load-more appends).
  useEffect(() => {
    const newIds = new Set<string>();
    if (prevMatchIdsRef.current.size > 0) {
      for (const m of matches) {
        if (!prevMatchIdsRef.current.has(m.matchId)) {
          newIds.add(m.matchId);
        } else {
          break;
        }
      }
    }
    for (const m of matches) prevMatchIdsRef.current.add(m.matchId);
    if (newIds.size === 0) return;
    setFlashMatchIds(newIds);
    const tid = window.setTimeout(() => setFlashMatchIds(new Set()), SSE_FLASH_TTL_MS);
    return () => window.clearTimeout(tid);
  }, [matches]);

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

  const lpDeltaMap = useMemo(() => computeLpDeltaMap(matches), [matches]);

  return (
    <div
      ref={parentRef}
      className="relative"
      style={{ height: virtualizer.getTotalSize() }}
    >
      <VirtualizerStats rendered={items.length} total={matches.length} />
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
        const isFlashNew = match !== undefined && flashMatchIds.has(match.matchId);
        // y animation lives on a dedicated inner wrapper — Motion's y transform
        // would override the virtualizer's own style.transform on the outer div.
        const innerY = isFlashNew
          ? { initial: -16, spring: true }
          : isNew
            ? { initial: 10, spring: false }
            : null;
        return (
          <m.div
            key={match?.matchId ?? `phantom-${virtualRow.index}`}
            data-index={virtualRow.index}
            ref={virtualizer.measureElement}
            initial={{
              opacity: isFlashNew
                ? 0
                : isNew
                  ? 0
                  : heldDuringSettle
                    ? SETTLE_HOLD_OPACITY
                    : 1,
            }}
            animate={{ opacity: heldDuringSettle ? SETTLE_HOLD_OPACITY : 1 }}
            transition={{
              duration: heldDuringSettle
                ? 0
                : isNew || isFlashNew
                  ? ENTER_DURATION
                  : SETTLE_REVEAL_MS,
              delay: heldDuringSettle ? 0 : isNew || isFlashNew ? staggerDelay : 0,
              ease: "easeOut",
            }}
            style={rowStyle}
          >
            {match && !heldDuringSettle ? (
              <m.div
                initial={innerY ? { y: innerY.initial } : false}
                {...(innerY ? { animate: { y: 0 } } : {})}
                transition={
                  innerY?.spring
                    ? { type: "spring", stiffness: 340, damping: 28 }
                    : { duration: ENTER_DURATION, delay: staggerDelay, ease: "easeOut" }
                }
              >
                <MatchRow
                  match={match}
                  accountSlug={accountSlug}
                  championDisplayName={championName(match.champion)}
                  onCardHover={onCardHover}
                  isNew={isFlashNew}
                  lpDelta={lpDeltaMap.get(match.matchId)}
                />
              </m.div>
            ) : (
              <MatchCardSkeleton />
            )}
          </m.div>
        );
      })}
    </div>
  );
}
