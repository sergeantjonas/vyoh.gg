import { VirtualizerStats } from "@/components/virtualizer-stats";
import { mainScrollRef } from "@/lib/scroll-container";
import { useActiveGame } from "@/steam/library/active-game-context";
import { LibraryRow } from "@/steam/library/library-row";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { SteamOwnedGame } from "@vyoh/shared";
import type { CSSProperties } from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

// Row footprint constants. Rows are a fixed-size shell (h-36 / @xl:h-40 =
// 144 / 160) inside an `<li>` with 8px padding-bottom, so the LI's
// offsetHeight is 152 below the shell's `@xl` container width and 168 from
// it up. We pick the right constant from the list's own width and feed it to
// the virtualizer as a static estimate, deliberately NOT wiring
// `measureElement` — when rows are uniform, dynamic measurement causes
// totalSize to drift after every new row enters the window, the virtualizer rebases scrollTop to keep
// visible items anchored, and on a scroll-restored back-nav the saved
// scrollTop ends up pointing at a different row than the user clicked
// (because forward-visit measurements grew totalSize, but back-visit
// starts at estimate again). Static estimate keeps the y-position of
// every row deterministic across mounts, so save+restore round-trips
// to the same visual position.
const ROW_HEIGHT_NARROW = 152;
const ROW_HEIGHT_WIDE = 168;
// The shell's `@xl` breakpoint. Rows span the list edge to edge, so the
// list's width is the width each row's container query sees. Kept in rem
// because the container query's rem follows the root font size: a reader who
// has raised their browser's default moves the CSS step, and this must move
// with it.
const ROW_WIDE_MIN_REM = 36;

// Non-active rows fade down to this opacity during the back-nav settle
// so the hero/logo morph reads cleanly against an emptier strip. The
// active row stays at opacity 1 the whole time. The page
// (routes/steam/library.tsx) owns the `settled` timer; we only apply
// the visual.
const SETTLE_HOLD_OPACITY = 0.6;

// Initial-mount cascade — only the first N visible rows get the
// data-mount-stagger opt-in. Beyond 8 the cascade would feel laggy
// (8 × 80ms = 640ms, the calm-ceiling per the arc note's tunables).
const MOUNT_STAGGER_LIMIT = 8;

export function LibraryListVirtual({
  games,
  settled,
  restoredScrollY,
}: {
  games: SteamOwnedGame[];
  settled: boolean;
  // Saved scroll position from a prior visit; >0 means we landed here via
  // back-nav and the parent's pin loop owns the scroll restore. Used to
  // gate the cold-arrival scrollToIndex below — we only auto-scroll to
  // the active row when there's no saved position to restore to.
  restoredScrollY: number;
}) {
  const { activeGame } = useActiveGame();
  const parentRef = useRef<HTMLUListElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);
  // First-paint cascade gate. True for the first render commit only;
  // flipped to false after mount so rows entering via scroll do NOT
  // replay the entry animation. Read at render time, not via state, so
  // we never re-render purely to clear it.
  const isInitialMountRef = useRef(true);
  useEffect(() => {
    isInitialMountRef.current = false;
  }, []);
  // The viewport stands in until the list has been measured. On this site's
  // layouts it picks the tier the measurement will, so measuring usually
  // changes nothing, and it has to be right on its own: the parent's back-nav
  // restore reads the first commit's list height, before a measured tier
  // could land in a second one.
  const [wide, setWide] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 40rem)").matches
  );
  // Measured before paint, not in an effect, so no frame is ever laid out on
  // the wrong tier.
  useLayoutEffect(() => {
    const list = parentRef.current;
    if (!list) return;
    const remPx =
      Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const update = (width: number) => setWide(width >= ROW_WIDE_MIN_REM * remPx);
    update(list.getBoundingClientRect().width);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) update(entry.contentRect.width);
    });
    observer.observe(list);
    return () => observer.disconnect();
  }, []);
  const rowHeight = wide ? ROW_HEIGHT_WIDE : ROW_HEIGHT_NARROW;

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

  // The virtualizer reads `estimateSize` only when it rebuilds its
  // measurements, and a changed estimate is not one of the things that
  // triggers a rebuild. Without this, a resize or a phone rotation across the
  // breakpoint leaves every row on the old stride, gapped or overlapping.
  const measuredRowHeightRef = useRef(rowHeight);
  useLayoutEffect(() => {
    if (measuredRowHeightRef.current === rowHeight) return;
    measuredRowHeightRef.current = rowHeight;
    virtualizer.measure();
  }, [virtualizer, rowHeight]);

  // Cold-arrival scroll-to-row: on a direct deep-link to
  // /steam/library/$appid (no preceding row click) the panel route writes
  // activeGame from the URL, so by first paint here it's already set.
  // Scroll the matching row into view exactly once. The back-nav restore
  // path (restoredScrollY > 0) owns its own pin loop in the parent and
  // these two conditions are mutually exclusive. Mirrors match-list.tsx.
  const initialActiveGameRef = useRef(activeGame);
  const coldArrivalScrolledRef = useRef(false);
  useEffect(() => {
    if (coldArrivalScrolledRef.current) return;
    if (initialActiveGameRef.current === null) return;
    if (restoredScrollY > 0) return;
    if (scrollMargin === 0) return;
    const target = initialActiveGameRef.current;
    const idx = games.findIndex((g) => g.appid === target);
    if (idx < 0) return;
    coldArrivalScrolledRef.current = true;
    virtualizer.scrollToIndex(idx, { align: "center" });
  }, [games, virtualizer, restoredScrollY, scrollMargin]);

  const items = virtualizer.getVirtualItems();

  return (
    <ul
      ref={parentRef}
      className="steam-library relative"
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
        // Cascade gate: only stamp data-mount-stagger + --i on rows
        // that are part of the FIRST-paint window. We also skip when
        // the list is in settle-hold (back-nav morph): the morph is
        // the show, an entry cascade alongside it would compete.
        const isInitialMountWindow =
          isInitialMountRef.current && settled && virtualRow.index < MOUNT_STAGGER_LIMIT;
        return (
          <LibraryRow
            key={game.appid}
            game={game}
            dataIndex={virtualRow.index}
            mountStagger={isInitialMountWindow}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              transform: `translateY(${virtualRow.start - scrollMargin}px)`,
              paddingBottom: 8,
              opacity: heldDuringSettle ? SETTLE_HOLD_OPACITY : 1,
              transition: "opacity 350ms ease-out",
              ...(isInitialMountWindow
                ? ({ ["--i" as string]: virtualRow.index } as CSSProperties)
                : {}),
            }}
          />
        );
      })}
    </ul>
  );
}
