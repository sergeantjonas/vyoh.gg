import { m, useReducedMotion } from "motion/react";
import type { CSSProperties } from "react";

import type { VerdictClause, VerdictSegment } from "@vyoh/shared";

import { CountUp } from "@/components/count-up";

import { parseAnimatableNumber } from "./parse-animatable-number";

/** Find the (clauseIdx, segIdx) of the segment that should carry the
 *  first-word kinetic — the verdict's editorial "lead" word. Prefers the
 *  first `emphasis` segment (verdict adjective like "AGGRESSIVE",
 *  "SURGICAL") since those are already typographically heavyweight;
 *  falls back to the first `subject` segment (champion name on Ahri /
 *  game name on Steam) when no emphasis exists; falls back further to
 *  the first segment of any kind so the kinetic never silently drops.
 *  Returns `null` for an empty clauses array. */
function findHeroSegment(
  clauses: readonly VerdictClause[]
): { clauseIdx: number; segIdx: number } | null {
  const preferred: VerdictSegment["kind"][] = ["emphasis", "subject"];
  for (const kind of preferred) {
    for (let ci = 0; ci < clauses.length; ci += 1) {
      const clause = clauses[ci] ?? [];
      const idx = clause.findIndex((s) => s.kind === kind);
      if (idx >= 0) return { clauseIdx: ci, segIdx: idx };
    }
  }
  if (clauses[0]?.[0]) return { clauseIdx: 0, segIdx: 0 };
  return null;
}

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
  /**
   * Gates the "first-word typographic kinetic" — a scale + blur entrance
   * on the verdict's editorial lead word (the first emphasis segment,
   * fallback subject, fallback first-segment-of-any-kind). Scales from
   * 1.4 + blurs from 6px into the settled state OVER A SHORTER WINDOW
   * than the surrounding ChapterReveal, so the lead word's transforms
   * resolve while the rest of the prose is still fading in — the
   * reader's left-to-right scan lands on an already-sharp lead word,
   * not a hole where the first word should be. Default `false` so
   * direct test/storybook renders stay static; subject chapters thread
   * their `nudged` flag.
   */
  firstWordKinetic?: boolean;
  /**
   * Seconds to delay the first-word kinetic after `firstWordKinetic`
   * flips to `true`. Tuned to match the surrounding ChapterReveal's
   * delay (NOT its end-of-reveal) so the kinetic fires concurrently
   * with the prose entrance. The kinetic's shorter 0.55s duration
   * finishes during the parent's longer reveal window, landing the
   * lead word first as the rest of the prose continues fading in.
   */
  firstWordKineticDelay?: number;
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
  firstWordKinetic = false,
  firstWordKineticDelay = 0,
}: Props) {
  const reduced = useReducedMotion();
  const hero = firstWordKinetic && !reduced ? findHeroSegment(clauses) : null;
  /** Wrap the hero segment in a motion.span that scales + blurs + opacity-
   *  fades from a pre-arrival state. Other segments pass through. The
   *  motion span is `inline-block` so the transform doesn't collapse to
   *  the inline parent's text baseline incorrectly under Safari. */
  const renderSegment = (node: React.ReactNode, ci: number, si: number) => {
    if (hero?.clauseIdx === ci && hero?.segIdx === si) {
      return (
        <m.span
          className="inline-block"
          initial={{ scale: 1.4, opacity: 0, filter: "blur(6px)" }}
          animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
          transition={{
            duration: 0.55,
            ease: [0.16, 1, 0.3, 1],
            delay: firstWordKineticDelay,
          }}
        >
          {node}
        </m.span>
      );
    }
    return node;
  };
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
                    {renderSegment(seg.value, ci, si)}
                  </span>
                );
              case "number": {
                // Animate when the value is a simple number (integer /
                // decimal / percentage / "N games"). Compound shapes
                // ("24/7/14") fall through to a static render — animating
                // just the leading "24" would silently change what the
                // segment displays. The deriver-supplied `raw` is the
                // authoritative number target; the parser only contributes
                // decimal precision + suffix preservation.
                const parsed = parseAnimatableNumber(seg.value);
                if (parsed) {
                  return (
                    <span
                      key={segKey}
                      className="font-semibold tabular-nums text-foreground"
                    >
                      {renderSegment(
                        <>
                          <CountUp
                            to={seg.raw}
                            decimals={parsed.decimals}
                            start={numbersActive}
                            delay={numbersDelay}
                          />
                          {parsed.suffix}
                        </>,
                        ci,
                        si
                      )}
                    </span>
                  );
                }
                return (
                  <span
                    key={segKey}
                    className="font-semibold tabular-nums text-foreground"
                  >
                    {renderSegment(seg.value, ci, si)}
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
                    {renderSegment(seg.value, ci, si)}
                  </span>
                );
              case "subject":
                return (
                  <span key={segKey} className="font-semibold italic text-foreground">
                    {renderSegment(seg.value, ci, si)}
                  </span>
                );
              case "opponent":
                return (
                  <span key={segKey} className="font-medium italic text-foreground/95">
                    {renderSegment(seg.value, ci, si)}
                  </span>
                );
            }
          })}
        </span>
      ))}
    </p>
  );
}
