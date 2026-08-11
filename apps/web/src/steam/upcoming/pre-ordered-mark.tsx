import { cn } from "@/lib/utils";

// Provenance mark for a title that is already bought. The Upcoming view mixes
// two provenances — wishlisted and pre-ordered — and without a mark the mixed
// list reads as one undifferentiated "want" pile, which inverts the meaning of
// the tiles the owner has actually committed money to.
//
// Deliberately a lockup rather than the accent system: the calendar cells and
// bands already carry accent and art, and a per-tile colour would compete with
// the capsule art it sits on (§ Art direction — art-forward days). This is
// chrome, so it reads as chrome.
export function PreOrderedMark({ className }: { className?: string | undefined }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-black/70 px-1.5 py-0.5 font-semibold text-[0.5rem] text-white/90 uppercase tracking-[0.12em]",
        className
      )}
    >
      {/* Decorative — the word carries the meaning, and a check glyph read by a
          screen reader on its own says nothing useful. */}
      <CheckGlyph />
      Pre-ordered
    </span>
  );
}

// Inline variant for the text-first TBA chips, which have no art to sit over and
// where a black pill inside a frosted chip would read as a second component.
export function PreOrderedNote() {
  return (
    <span className="ml-1.5 inline-flex items-center gap-1 font-medium text-[0.65rem] text-muted-foreground uppercase tracking-[0.1em]">
      <CheckGlyph />
      Pre-ordered
    </span>
  );
}

function CheckGlyph() {
  return (
    <svg
      viewBox="0 0 12 12"
      className="size-2 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M2 6.5 4.5 9 10 3" />
    </svg>
  );
}
