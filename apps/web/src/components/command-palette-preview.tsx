// Chunk 2 of docs/working-notes/cross-cutting/anchor-positioned-overlays.md:
// a smoke-test preview that anchors itself to the focused command-palette row
// via CSS Anchor Positioning. The focused row carries `anchor-name:
// --palette-focused-row` (applied in index.css against cmdk's `data-selected`),
// and this card pins itself to that anchor via the `.palette-preview` rule —
// no `getBoundingClientRect` polling, no scroll listeners.
//
// Real entity-aware previews (champion / match / Steam game) land in Chunk 3.
// Until then this surface just renders the cmdk value twice so we can verify
// the anchor wiring before adding content.

type Props = {
  value: string;
};

export function CommandPalettePreview({ value }: Props) {
  if (!value) return null;
  return (
    <aside
      data-testid="command-palette-preview"
      aria-hidden
      className="palette-preview pointer-events-none z-50 hidden w-56 flex-col gap-1 rounded-md border bg-popover/85 px-3 py-2 text-xs text-popover-foreground shadow-xl backdrop-blur-md md:flex"
    >
      <span className="font-medium text-foreground">{value}</span>
      <span className="text-muted-foreground">{value}</span>
    </aside>
  );
}
