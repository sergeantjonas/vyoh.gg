// Dispatcher + positioning host for the command-palette preview overlay.
//
// Positioning is a continuous `requestAnimationFrame` loop that reads the
// focused cmdk row's `getBoundingClientRect()` and writes `top`/`left`
// directly to the card's style. No middleware, no CSS Anchor Positioning,
// no debounced effects. Every frame: "where is the row right now → put
// the card there." This is the simplest possible mechanism that
// guarantees the card tracks the row regardless of when cmdk scrolls,
// when the list mounts/unmounts items, or how the user navigated to the
// selection.
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
  const [referenceEl, setReferenceEl] = useState<HTMLElement | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  // Re-query the focused cmdk row whenever the highlighted value changes.
  // cmdk normalises selection state to a single `aria-selected="true"` at
  // a time so this returns one element or null.
  useEffect(() => {
    if (!value || typeof document === "undefined") {
      setReferenceEl(null);
      return;
    }
    setReferenceEl(
      document.querySelector<HTMLElement>('[cmdk-item][aria-selected="true"]')
    );
  }, [value]);

  // Continuous-frame position loop. Reads the row's rect each frame and
  // writes `top`/`left` directly via ref-mutation — never goes through
  // React state, so no re-render churn. Skips the write when nothing
  // changed. Keeps the card `visibility: hidden` until the first
  // successful position so there's no flash at the document origin.
  useLayoutEffect(() => {
    if (!referenceEl) return;
    let rafId = 0;
    let lastTop = Number.NaN;
    let lastLeft = Number.NaN;
    const tick = () => {
      const card = cardRef.current;
      if (card) {
        const rect = referenceEl.getBoundingClientRect();
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
  }, [referenceEl]);

  const parsed = parsePaletteValue(value);
  let content: React.ReactNode = null;
  switch (parsed.type) {
    case "champion":
      content = <CommandPalettePreviewChampion alias={parsed.alias} />;
      break;
    // match, steam-game previews land in follow-up chunks (3c, 3d).
  }
  if (!content || !mounted || !referenceEl) return null;

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
