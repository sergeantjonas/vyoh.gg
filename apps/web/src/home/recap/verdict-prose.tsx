import type { CSSProperties } from "react";

import type { VerdictClause } from "@vyoh/shared";

import { CountUp } from "@/components/count-up";

/**
 * Matches verdict-paragraph number values that are safe to animate as a
 * single count-up — integer or decimal, with an optional percent suffix.
 * Compound shapes like the signature-game KDA score ("24/7/14") fall
 * through to a static render because counting "24" alone would change the
 * surface meaning of the segment.
 */
const SIMPLE_NUMBER_PATTERN = /^(\d+(?:\.(\d+))?)(%?)$/;

type Props = {
  clauses: VerdictClause[];
  className?: string;
  /**
   * Inline style applied to the wrapping `<p>`. The common reason to pass
   * this is `textShadow` — every chapter background is different so the
   * shadow tuning lives at the call site rather than baked into the primitive.
   */
  style?: CSSProperties;
  /**
   * Per-segment style override for `emphasis` segments (verdict adjectives
   * like "AGGRESSIVE"). Emphasis sits on `var(--accent)`, which can collide
   * with same-hue splash crops — the chapter passes a heavier shadow +
   * stroke combo here that overrides the inherited shadow.
   */
  emphasisStyle?: CSSProperties;
  /**
   * Gates the count-up animation on `number` segments. Defaults to `true`
   * so direct test/storybook renders behave statically. Subject chapters
   * thread their `nudged` state here so numbers only count up once the
   * chapter is actually pinned into view — otherwise the animation runs
   * before the user can see it and the result reads as a static value.
   */
  numbersActive?: boolean;
  /**
   * Seconds to delay the count-up animation after `numbersActive` flips
   * to `true`. Use to let the prose's own fade-in finish before the
   * numbers start counting — otherwise the count-up and the entrance
   * compete for attention. Typical value: the surrounding ChapterReveal
   * delay + its duration + a small settle (~1.1–1.3s for the standard
   * verdict-tier reveal).
   */
  numbersDelay?: number;
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
export function VerdictProse({
  clauses,
  className,
  style,
  emphasisStyle,
  numbersActive = true,
  numbersDelay = 0,
}: Props) {
  return (
    <p
      className={[
        // `max-w-prose` ties the paragraph at ~65ch editorial measure even
        // when the surrounding chapter container is wider. Long-form reads
        // better at narrow measure than at the chapter's full width.
        // `text-wrap-pretty` over `text-balance` — balance forces equal
        // line lengths and produced awkward "Best [break] night" splits
        // on short paragraphs; pretty optimizes for the natural break
        // (no orphans/widows) and keeps phrase units intact.
        "max-w-prose text-pretty text-base leading-relaxed text-foreground/90 sm:text-lg",
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
              case "number": {
                // Animate when the value is a simple number (integer /
                // decimal / percentage). Compound shapes ("24/7/14")
                // fall through to a static render — animating just the
                // leading "24" would silently change what the segment
                // displays.
                const match = SIMPLE_NUMBER_PATTERN.exec(seg.value);
                if (match) {
                  const decimalDigits = match[2] ?? "";
                  const suffix = match[3] ?? "";
                  return (
                    <span
                      key={segKey}
                      className="font-semibold tabular-nums text-foreground"
                    >
                      <CountUp
                        to={seg.raw}
                        decimals={decimalDigits.length}
                        start={numbersActive}
                        delay={numbersDelay}
                      />
                      {suffix}
                    </span>
                  );
                }
                return (
                  <span
                    key={segKey}
                    className="font-semibold tabular-nums text-foreground"
                  >
                    {seg.value}
                  </span>
                );
              }
              case "emphasis":
                return (
                  <span
                    key={segKey}
                    className="font-semibold uppercase tracking-wide"
                    style={{
                      color: "var(--accent, currentColor)",
                      ...emphasisStyle,
                    }}
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
