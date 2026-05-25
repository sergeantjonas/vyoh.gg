import { VirtualizerStats } from "@/components/virtualizer-stats";
import { mainScrollRef } from "@/lib/scroll-container";
import { useMediaQuery } from "@/lib/use-media-query";
import { useActiveGame } from "@/steam/library/active-game-context";
import { LibraryRow } from "@/steam/library/library-row";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { SteamOwnedGame } from "@vyoh/shared";
import { useLayoutEffect, useRef, useState } from "react";

// Row footprint constants. Rows are a fixed-size shell (h-36 / sm:h-40 =
// 144 / 160) inside an `<li>` with 8px padding-bottom, so the LI's
// offsetHeight is 152 below `sm` and 168 from `sm` up. We pick the right
// constant via media-query and feed it to the virtualizer as a static
// estimate, deliberately NOT wiring `measureElement` — when rows are
// uniform, dynamic measurement causes totalSize to drift after every
// new row enters the window, the virtualizer rebases scrollTop to keep
// visible items anchored, and on a scroll-restored back-nav the saved
// scrollTop ends up pointing at a different row than the user clicked
// (because forward-visit measurements grew totalSize, but back-visit
// starts at estimate again). Static estimate keeps the y-position of
// every row deterministic across mounts, so save+restore round-trips
// to the same visual position.
const ROW_HEIGHT_BELOW_SM = 152;
const ROW_HEIGHT_SM_UP = 168;

// Non-active rows fade down to this opacity during the back-nav settle
// so the hero/logo morph reads cleanly against an emptier strip. The
// active row stays at opacity 1 the whole time. The page
// (routes/steam/library.tsx) owns the `settled` timer; we only apply
// the visual.
const SETTLE_HOLD_OPACITY = 0.6;

export function LibraryListVirtual({
  games,
  settled,
}: {
  games: SteamOwnedGame[];
  settled: boolean;
}) {
  const { activeGame } = useActiveGame();
  const parentRef = useRef<HTMLUListElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);
  // Match the row-shell's `sm:h-40` breakpoint. The two constants above
  // give us the LI's offsetHeight at each tier, so the virtualizer's
  // y-positions match the rows' actual layout without ever measuring.
  const isSmUp = useMediaQuery("(min-width: 640px)");
  const rowHeight = isSmUp ? ROW_HEIGHT_SM_UP : ROW_HEIGHT_BELOW_SM;

  // The virtualizer treats `mainScrollRef` as the scroll element, so it
  // needs to know how far the list's top sits below the scroll container's
  // top edge — otherwise virtual y coordinates start at 0 (= the
  // container's top), but the list visually starts after the section
  // header + page-title + controls. Without this, items overlap the
  // controls bar at the top of the page.
  useLayoutEffect(() => {
    const container = mainScrollRef.current;
    if (parentRef.current && container) {
      const parentRect = parentRef.current.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const nextMargin = parentRect.top - containerRect.top + container.scrollTop;
      setScrollMargin(nextMargin);
    }
  }, []);

  const virtualizer = useVirtualizer({
    count: games.length,
    estimateSize: () => rowHeight,
    scrollMargin,
    overscan: 4,
    getScrollElement: () => mainScrollRef.current,
  });

  const items = virtualizer.getVirtualItems();

  return (
    <ul
      ref={parentRef}
      className="relative"
      style={{ height: virtualizer.getTotalSize() }}
    >
      <VirtualizerStats rendered={items.length} total={games.length} />
      {items.map((virtualRow) => {
        const game = games[virtualRow.index];
        if (!game) return null;
        const isActiveRow = activeGame === game.appid;
        // Hold non-active rows at low opacity while the back-nav morph
        // plays. The active row stays full opacity so it reads as the
        // morph's destination. Once `settled` flips, every row fades to 1
        // via the CSS transition.
        const heldDuringSettle = !settled && !isActiveRow;
        return (
          <LibraryRow
            key={game.appid}
            game={game}
            dataIndex={virtualRow.index}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              transform: `translateY(${virtualRow.start - scrollMargin}px)`,
              paddingBottom: 8,
              opacity: heldDuringSettle ? SETTLE_HOLD_OPACITY : 1,
              transition: "opacity 350ms ease-out",
            }}
          />
        );
      })}
    </ul>
  );
}
