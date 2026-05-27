// Dispatcher for the command-palette anchor-positioned preview overlay.
// Reads the focused cmdk row's value, parses the sentinel prefix, and
// renders the matching per-entity preview component. Returns null when the
// highlighted row isn't a preview-able entity (pages, tabs, recents,
// accounts) so the preview surface stays out of the way.
//
// Per-entity files are imported eagerly for now — they're small and reuse
// hooks already mounted by the dialog. Bundle analysis at Chunk 7 will
// decide whether to lazy-load via React.lazy.

import { CommandPalettePreviewChampion } from "@/components/command-palette-preview-champion";
import { parsePaletteValue } from "@/components/command-palette-preview-value";

type Props = {
  value: string;
};

export function CommandPalettePreview({ value }: Props) {
  const parsed = parsePaletteValue(value);
  switch (parsed.type) {
    case "champion":
      return <CommandPalettePreviewChampion alias={parsed.alias} />;
    // match, steam-game previews land in follow-up chunks (3c, 3d).
    default:
      return null;
  }
}
