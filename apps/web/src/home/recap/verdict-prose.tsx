import type { CSSProperties } from "react";

import type { VerdictClause } from "@vyoh/shared";

type Props = {
  clauses: VerdictClause[];
  className?: string;
  /**
   * Inline style applied to the wrapping `<p>`. The common reason to pass
   * this is `textShadow` — every chapter background is different so the
   * shadow tuning lives at the call site rather than baked into the primitive.
   */
  style?: CSSProperties;
};

/**
 * Renders the structured verdict paragraph from `verdictParagraph(recap)`
 * as a single flowing block of prose. Each `VerdictSegment.kind` gets its
 * own typographic treatment:
 *  - `text`      → plain copy
 *  - `number`    → tabular-nums + slightly heavier weight (the figure stands
 *                  out without breaking the sentence flow)
 *  - `emphasis`  → uppercase, accent-tinted, bold (verdict adjectives like
 *                  "Aggressive", "Surgical")
 *  - `subject`   → the chapter's champion name (the page's main subject)
 *  - `opponent`  → opposing-lane champion in the signature game receipt
 *
 * Both `subject` and `opponent` slide in from the page's typographic ground:
 * for now we render them with subtle italic + weight. R-2g will graft
 * per-kind micromotion (number count-up, character-staggered subject/opp
 * reveal). This primitive renders the static visual hierarchy that motion
 * can later sit on top of.
 *
 * Clauses join with a space — the JSX layer can split per-clause if a
 * chapter wants to cascade reveals at clause granularity later.
 */
export function VerdictProse({ clauses, className, style }: Props) {
  return (
    <p
      className={[
        "text-balance text-base leading-relaxed text-foreground/90 sm:text-lg",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={style}
    >
      {clauses.map((clause, ci) => (
        // Clauses are stable across renders for a given recap — the recap
        // deriver emits them in a deterministic order, and the kind+value
        // tuple in the lead segment uniquely identifies a clause within a
        // paragraph (verdict / volume / receipt / context are all distinct).
        <span key={`${ci}-${clause[0]?.kind}-${clause[0]?.value}`} className="inline">
          {ci > 0 ? " " : null}
          {clause.map((seg, si) => {
            const segKey = `${si}-${seg.kind}-${seg.value}`;
            switch (seg.kind) {
              case "text":
                return (
                  <span key={segKey} className="text-foreground/80">
                    {seg.value}
                  </span>
                );
              case "number":
                return (
                  <span
                    key={segKey}
                    className="font-semibold tabular-nums text-foreground"
                  >
                    {seg.value}
                  </span>
                );
              case "emphasis":
                return (
                  <span
                    key={segKey}
                    className="font-semibold uppercase tracking-wide"
                    style={{ color: "var(--accent, currentColor)" }}
                  >
                    {seg.value}
                  </span>
                );
              case "subject":
                return (
                  <span key={segKey} className="font-semibold italic text-foreground">
                    {seg.value}
                  </span>
                );
              case "opponent":
                return (
                  <span key={segKey} className="font-medium italic text-foreground/95">
                    {seg.value}
                  </span>
                );
            }
          })}
        </span>
      ))}
    </p>
  );
}
