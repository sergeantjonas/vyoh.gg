// Dispatcher + positioning host for the command-palette preview overlay.
//
// Positioning is a continuous `requestAnimationFrame` loop that re-queries
// the focused cmdk row from the DOM each frame, reads its live
// `getBoundingClientRect()`, and writes `top`/`left` directly to the
// card's style. Re-querying every frame (rather than caching the row
// node in state) makes the loop self-healing across cmdk re-renders: if
// the list re-flows because an async section mounts (e.g. match-history
// placeholder appearing under the champions group), the next frame
// picks up the row at its new position.
//
// Earlier attempts that produced unpredictable results:
// - CSS Anchor Positioning (3 iterations: logical, physical, explicit
//   anchor name) — native + polyfill both misaligned.
// - Floating UI's `useFloating` with `offset` + `flip` middleware — card
//   appeared far above the row on certain selections; cause unclear from
//   the abstraction.
// - Single-pass rect read in `useLayoutEffect` — timing window between
//   our effect and cmdk's `scrollIntoView` left position off by however
//   much cmdk scrolled afterwards, direction-dependent.
// - rAF loop with the row node cached in React state keyed on `value` —
//   when cmdk re-rendered the list without the selected value changing
//   (async data loading the most common trigger), the cached node could
//   detach/replace and the loop kept reading a stale rect.
//
// Renders through a body-level portal: Radix `DialogContent`'s
// `transform: translate(-50%, -50%)` establishes a containing block for
// `position: fixed` descendants AND combines with `overflow-hidden` to
// clip anything that escapes the dialog rect. Portalling to
// `document.body` keeps the card visible outside the dialog.

import { CommandPalettePreviewChampion } from "@/components/command-palette-preview-champion";
import { parsePaletteValue } from "@/components/command-palette-preview-value";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  value: string;
};

export function CommandPalettePreview({ value }: Props) {
  const [mounted, setMounted] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  // Continuous-frame position loop. Each frame: re-query the focused row
  // from the DOM (cmdk normalises to a single `aria-selected="true"`), read
  // its live rect, write the card's `top`/`left` via ref-mutation. Skips
  // the write when nothing changed. Keeps the card `visibility: hidden`
  // until the first successful position so there's no flash at the
  // document origin.
  useLayoutEffect(() => {
    let rafId = 0;
    let lastTop = Number.NaN;
    let lastLeft = Number.NaN;
    const tick = () => {
      const card = cardRef.current;
      const row = document.querySelector<HTMLElement>(
        '[cmdk-item][aria-selected="true"]'
      );
      if (card && row) {
        const rect = row.getBoundingClientRect();
        const top = rect.top;
        const left = rect.right + 12;
        if (top !== lastTop || left !== lastLeft) {
          lastTop = top;
          lastLeft = left;
          card.style.top = `${top}px`;
          card.style.left = `${left}px`;
          card.style.visibility = "visible";
        }
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const parsed = parsePaletteValue(value);
  let content: React.ReactNode = null;
  switch (parsed.type) {
    case "champion":
      content = <CommandPalettePreviewChampion alias={parsed.alias} />;
      break;
    // match, steam-game previews land in follow-up chunks (3c, 3d).
  }
  if (!content || !mounted) return null;

  return createPortal(
    <div
      ref={cardRef}
      style={{ position: "fixed", top: 0, left: 0, visibility: "hidden" }}
      className="z-50 hidden md:block"
    >
      {content}
    </div>,
    document.body
  );
}
