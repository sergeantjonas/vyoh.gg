// Dispatcher for the command-palette anchor-positioned preview overlay.
// Reads the focused cmdk row's value, parses the sentinel prefix, and
// renders the matching per-entity preview component. Returns null when the
// highlighted row isn't a preview-able entity (pages, tabs, recents,
// accounts) so the preview surface stays out of the way.
//
// Renders through a body-level portal: Radix `DialogContent` applies a
// `translate(-50%, -50%)` for centering, which establishes a containing
// block for `position: fixed` descendants AND combines with the
// `overflow-hidden` on `DialogContent` to clip anything that tries to
// escape the dialog rect. Portalling to `document.body` lets `position:
// fixed` resolve against the viewport so the card can pin itself to the
// focused row outside the dialog's clipping box. The anchor-name rule on
// `[cmdk-item][aria-selected="true"]` still resolves because the initial
// containing block (the viewport) is an acceptable anchor scope.
//
// Per-entity files are imported eagerly for now — they're small and reuse
// hooks already mounted by the dialog. Bundle analysis at Chunk 7 will
// decide whether to lazy-load via React.lazy.

import { CommandPalettePreviewChampion } from "@/components/command-palette-preview-champion";
import { parsePaletteValue } from "@/components/command-palette-preview-value";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  value: string;
};

export function CommandPalettePreview({ value }: Props) {
  // Defer portal mount until after first client render so SSR/initial
  // hydration doesn't try to read `document`. The dialog itself is already
  // client-only, but keep the preview portal-safe in case it's later used
  // from a non-dialog context.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const parsed = parsePaletteValue(value);
  let content: React.ReactNode = null;
  switch (parsed.type) {
    case "champion":
      content = <CommandPalettePreviewChampion alias={parsed.alias} />;
      break;
    // match, steam-game previews land in follow-up chunks (3c, 3d).
  }
  if (!content || !mounted) return null;
  return createPortal(content, document.body);
}
