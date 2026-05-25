import { cn } from "@/lib/utils";

// Small inline pill for a single playtime fact — "Total · 13h" / "Recent · 2h".
// Rendered in the game-detail header facts strip alongside the rating /
// deck-compat / platform chips, so the page's "who is this game and what
// have I done with it" summary reads as one cohesive row instead of a
// header column floating next to a near-empty playtime card.
//
// Two tones: `active` for real values (default chip tone, foreground/85),
// `muted` for "Never launched" / "—" placeholders (lower-contrast so the
// eye skips them rather than treating them as facts).
export function PlaytimePill({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "active" | "muted";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium tabular-nums",
        tone === "active"
          ? "border-foreground/15 bg-foreground/5 text-foreground/85"
          : "border-foreground/10 bg-transparent text-muted-foreground/70"
      )}
    >
      <span className="opacity-70">{label}</span>
      <span>{value}</span>
    </span>
  );
}
