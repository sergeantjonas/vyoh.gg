import { mainScrollRef } from "@/lib/scroll-container";
import { useMediaQuery } from "@/lib/use-media-query";
import { LibraryTile } from "@/steam/library/library-tile";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { SteamOwnedGame } from "@vyoh/shared";
import { useLayoutEffect, useRef, useState } from "react";

// Tile rows are a 2:3 portrait capsule + ~50px name/lifetime line; the
// height depends on lane width (= container width / lanes). Measured
// post-mount via `measureElement` — the estimate just needs to be close
// enough to keep the initial scroll-height reservation in the right
// ballpark across breakpoints. Empirically ~320px holds for 3-5 lanes at
// realistic viewport widths.
const ESTIMATED_ROW_HEIGHT = 320;

// Lane count tracks the existing CSS grid breakpoints:
//   default     → 2
//   sm (640px)  → 3
//   md (768px)  → 4
//   lg (1024px) → 5
// Kept aligned with the static grid classes on the route's row-layout
// branch so the visual rhythm matches when switching layouts.
function useLaneCount(): number {
  const isLg = useMediaQuery("(min-width: 1024px)");
  const isMd = useMediaQuery("(min-width: 768px)");
  const isSm = useMediaQuery("(min-width: 640px)");
  if (isLg) return 5;
  if (isMd) return 4;
  if (isSm) return 3;
  return 2;
}

export function LibraryGridVirtual({ games }: { games: SteamOwnedGame[] }) {
  const parentRef = useRef<HTMLUListElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);
  const lanes = useLaneCount();

  // See LibraryListVirtual for the rationale on scrollMargin — same
  // pattern, same reason.
  useLayoutEffect(() => {
    const container = mainScrollRef.current;
    if (parentRef.current && container) {
      const parentRect = parentRef.current.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      setScrollMargin(parentRect.top - containerRect.top + container.scrollTop);
    }
  }, []);

  // `lanes` is included in the virtualizer key so changing breakpoints
  // forces a fresh virtualizer instance — cleaner than trying to mutate
  // lane count on the live one, and re-measurement on the new lanes is
  // cheap (only the rendered window re-mounts).
  const virtualizer = useVirtualizer({
    count: games.length,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    scrollMargin,
    overscan: 4,
    lanes,
    getScrollElement: () => mainScrollRef.current,
  });

  const items = virtualizer.getVirtualItems();
  const lanePct = 100 / lanes;

  return (
    <ul
      ref={parentRef}
      className="relative"
      style={{ height: virtualizer.getTotalSize() }}
    >
      {items.map((virtualItem) => {
        const game = games[virtualItem.index];
        if (!game) return null;
        // Each lane is a fractional column. Tiles get symmetric 8px padding
        // on all four sides — adjacent tiles add to a 16px visible gap
        // (matching the original `gap-4` static grid), and the outer edges
        // get an 8px inset rather than touching the container edge.
        return (
          <LibraryTile
            key={game.appid}
            game={game}
            liRef={virtualizer.measureElement}
            dataIndex={virtualItem.index}
            style={{
              position: "absolute",
              top: 0,
              left: `${virtualItem.lane * lanePct}%`,
              width: `${lanePct}%`,
              transform: `translateY(${virtualItem.start - scrollMargin}px)`,
              padding: 8,
            }}
          />
        );
      })}
    </ul>
  );
}
