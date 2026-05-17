import type { ChampionPatchChangeKind } from "@vyoh/shared";

// Per-line indicator for patch-change rows. Width is fixed via `w-2` so
// every line aligns regardless of which glyph it carries. Used by both the
// PN2 profile heads-up and the PN3 patch-notes tab — keep visuals identical
// across both so the meaning stays stable as users move between surfaces.
export function ChangeKindGlyph({ kind }: { kind: ChampionPatchChangeKind | null }) {
  const cls = "inline-block w-2 shrink-0 text-center tabular-nums";
  switch (kind) {
    case "buff":
      return <span className={`${cls} text-emerald-400`}>↑</span>;
    case "nerf":
      return <span className={`${cls} text-rose-400`}>↓</span>;
    case "new_effect":
      return <span className={`${cls} text-sky-400`}>+</span>;
    case "removed":
      return <span className={`${cls} text-muted-foreground`}>×</span>;
    // `adjustment` + unclassified prose (mostly bug-fix lines) share the
    // same neutral marker — both communicate "something changed, but the
    // parser couldn't read a direction." Keeps every row visually aligned.
    default:
      return <span className={`${cls} text-muted-foreground/60`}>·</span>;
  }
}
