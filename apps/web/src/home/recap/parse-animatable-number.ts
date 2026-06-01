/**
 * Detects values that are safe to animate with `<CountUp>` — a single
 * leading integer or decimal, with an optional `%` or whitespace-prefixed
 * word suffix (e.g. `"3 games"`, `"55%"`, `"3.22"`).
 *
 * The pattern deliberately excludes compound shapes like the signature-
 * game KDA score `"24/7/14"` — animating just the leading "24" would
 * silently collapse the segment's surface meaning. Compound shapes fall
 * through to a static render at the call site.
 *
 * Used by both the verdict prose (`number` segments inside the deriver-
 * emitted clauses) and the chapter's peak chips (pre-formatted display
 * strings). The shared helper keeps both call sites consistent: any
 * value that animates in one place will animate the same way in the
 * other, with the same suffix preservation and decimal precision.
 */
export const SIMPLE_NUMBER_PATTERN = /^(\d+(?:\.(\d+))?)(\s+\w+|%)?$/;

export interface AnimatableNumber {
  /** Parsed numeric target — the value the count-up tweens to. */
  raw: number;
  /** Digits after the decimal point in the original string (0 for integers). */
  decimals: number;
  /**
   * Trailing suffix to render verbatim after the animating digits — `"%"`,
   * `" games"`, etc. Rendered as a static sibling so the digits tween
   * while the suffix stays anchored.
   */
  suffix: string;
}

export function parseAnimatableNumber(value: string): AnimatableNumber | null {
  const match = SIMPLE_NUMBER_PATTERN.exec(value);
  if (!match) return null;
  const numericPart = match[1];
  if (!numericPart) return null;
  return {
    raw: Number.parseFloat(numericPart),
    decimals: (match[2] ?? "").length,
    suffix: match[3] ?? "",
  };
}
