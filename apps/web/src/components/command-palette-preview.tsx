// Dispatcher + positioning host for the command-palette preview overlay.
//
// Positioning is direct rect-based. Earlier attempts (CSS Anchor
// Positioning across three iterations, then Floating UI's `useFloating`
// with `offset()` + `flip()` middleware) all produced misaligned positions
// across Firefox + Safari with no consistent explanation from the
// abstractions. Direct positioning gives us full control: query the
// focused cmdk row, read its `getBoundingClientRect()`, set the card's
// `top` and `left` to (row.top, row.right + 12). One source of truth.
//
// Re-position on:
// - Highlighted value change (selection moved to a different row)
// - Scroll on any ancestor (cmdk-list, page) via capture-phase listener
// - Window resize
//
// Renders through a body-level portal: Radix `DialogContent`'s
// `transform: translate(-50%, -50%)` establishes a containing block for
// `position: fixed` descendants AND combines with `overflow-hidden` to
// clip anything that escapes the dialog rect. Portalling to
// `document.body` keeps the card visible outside the dialog.

import { CommandPalettePreviewChampion } from "@/components/command-palette-preview-champion";
import { parsePaletteValue } from "@/components/command-palette-preview-value";
import { useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  value: string;
};

type Position = { top: number; left: number };

export function CommandPalettePreview({ value }: Props) {
  const [mounted, setMounted] = useState(false);
  const [referenceEl, setReferenceEl] = useState<HTMLElement | null>(null);
  const [position, setPosition] = useState<Position | null>(null);

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

  // Compute and track the position. `useLayoutEffect` so the initial
  // position is set before paint (avoids a flash at 0,0). Capture-phase
  // scroll listener catches scrolls on the cmdk-list ancestor; resize on
  // the window covers viewport resize.
  useLayoutEffect(() => {
    if (!referenceEl) {
      setPosition(null);
      return;
    }
    const update = () => {
      const rect = referenceEl.getBoundingClientRect();
      setPosition({ top: rect.top, left: rect.right + 12 });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [referenceEl]);

  const parsed = parsePaletteValue(value);
  let content: React.ReactNode = null;
  switch (parsed.type) {
    case "champion":
      content = <CommandPalettePreviewChampion alias={parsed.alias} />;
      break;
    // match, steam-game previews land in follow-up chunks (3c, 3d).
  }
  if (!content || !mounted || !referenceEl || !position) return null;

  return createPortal(
    <div
      style={{ position: "fixed", top: position.top, left: position.left }}
      className="z-50 hidden md:block"
    >
      {content}
    </div>,
    document.body
  );
}
