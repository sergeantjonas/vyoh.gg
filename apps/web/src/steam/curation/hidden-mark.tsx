import { cn } from "@/lib/utils";
import { EyeOff } from "lucide-react";

// Says "visitors cannot see this" on an owner-visible surface.
//
// The owner sees hidden games everywhere by design, which leaves them unable to
// tell whether what they are looking at is public. On the wishlist row and the
// library hovercard the hide toggle answers that in place — amber and pressed —
// but surfaces with no room for a control said nothing at all, so the owner had
// to guess. This is the read-only half of that toggle.
//
// Presentational, like `PreOrderedMark` next door: callers gate on
// `useGameCuration(appid)` rather than the mark reaching for the viewer itself,
// so a surface can use the same state for its own label and tooltip copy.
export function HiddenMark({ className }: { className?: string | undefined }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-black/70 px-1.5 py-0.5 font-semibold text-[0.5rem] text-amber-300/95 uppercase tracking-[0.12em]",
        className
      )}
    >
      {/* Decorative: the word carries it, and callers put the full sentence in
          the accessible name so a screen reader hears it once, not twice. */}
      <EyeOff aria-hidden="true" focusable="false" className="size-2 shrink-0" />
      Hidden
    </span>
  );
}

// Inline variant for text-first chips with no art to sit over, where a black
// pill inside a frosted chip would read as a second component.
export function HiddenNote() {
  return (
    <span className="ml-1.5 inline-flex items-center gap-1 font-medium text-[0.65rem] text-amber-300/90 uppercase tracking-[0.1em]">
      <EyeOff aria-hidden="true" focusable="false" className="size-2.5 shrink-0" />
      Hidden
    </span>
  );
}

/** The sentence that goes in an accessible name or a tooltip, said once. */
export const HIDDEN_FROM_VISITORS = "hidden from visitors";
