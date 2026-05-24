import { mainScrollRef } from "@/lib/scroll-container";
import { LibraryRow } from "@/steam/library/library-row";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { SteamOwnedGame } from "@vyoh/shared";
import { useLayoutEffect, useRef, useState } from "react";

// Row footprint baseline. The real height is measured per-row via
// `virtualizer.measureElement`; the estimate just needs to land close
// enough that the initial scroll-height reservation isn't wildly off.
// Current row shell is hero+meta on a single line at ~80px including the
// 8px gap-2 below.
const ESTIMATED_ROW_HEIGHT = 84;

export function LibraryListVirtual({ games }: { games: SteamOwnedGame[] }) {
  const parentRef = useRef<HTMLUListElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);

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
      setScrollMargin(parentRect.top - containerRect.top + container.scrollTop);
    }
  }, []);

  const virtualizer = useVirtualizer({
    count: games.length,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
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
      {items.map((virtualRow) => {
        const game = games[virtualRow.index];
        if (!game) return null;
        return (
          <LibraryRow
            key={game.appid}
            game={game}
            liRef={virtualizer.measureElement}
            dataIndex={virtualRow.index}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              transform: `translateY(${virtualRow.start - scrollMargin}px)`,
              paddingBottom: 8,
            }}
          />
        );
      })}
    </ul>
  );
}
