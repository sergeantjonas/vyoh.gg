// Dispatcher + positioning host for the command-palette preview overlay.
//
// Positioning uses Floating UI's `useFloating` (transitively in our bundle
// via Radix Popper, now imported directly) with `autoUpdate` for scroll +
// resize tracking and `flip` for collision-aware edge handling. CSS Anchor
// Positioning was the original plan (see polyfill loader at
// `apps/web/src/lib/anchor-positioning.ts`) but cross-browser resolution
// quirks during 2026-05-28 testing — including native Firefox computing
// wrong positions for our specific CSS shape — pushed us to JS positioning
// for ship-reliability. The polyfill loader is kept as a future-migration
// hook for when the CSS spec consolidates across engines.
//
// Reference element discovery: cmdk sets `aria-selected="true"` on the
// highlighted item. We query for it on each `value` change and feed the
// element to `useFloating` via the `elements.reference` slot, which
// Floating UI uses to re-anchor the floating card.
//
// Renders through a body-level portal: Radix `DialogContent`'s
// `transform: translate(-50%, -50%)` establishes a containing block for
// `position: fixed` descendants AND combines with `overflow-hidden` to
// clip anything that escapes the dialog rect. Portalling to
// `document.body` keeps the card visible outside the dialog.

import { CommandPalettePreviewChampion } from "@/components/command-palette-preview-champion";
import { parsePaletteValue } from "@/components/command-palette-preview-value";
import { autoUpdate, flip, offset, useFloating } from "@floating-ui/react-dom";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  value: string;
};

export function CommandPalettePreview({ value }: Props) {
  const [mounted, setMounted] = useState(false);
  const [referenceEl, setReferenceEl] = useState<Element | null>(null);

  useEffect(() => setMounted(true), []);

  // Re-query the selected cmdk-item whenever the highlighted value changes.
  // cmdk normalises selection state to a single `aria-selected="true"` at a
  // time, so this returns one element or null.
  useEffect(() => {
    if (!value || typeof document === "undefined") {
      setReferenceEl(null);
      return;
    }
    setReferenceEl(document.querySelector('[cmdk-item][aria-selected="true"]'));
  }, [value]);

  const { refs, floatingStyles } = useFloating({
    placement: "right-start",
    middleware: [offset(12), flip()],
    whileElementsMounted: autoUpdate,
    elements: { reference: referenceEl },
  });

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
    <div ref={refs.setFloating} style={floatingStyles} className="z-50 hidden md:block">
      {content}
    </div>,
    document.body
  );
}
