import type { GenreFingerprint } from "@vyoh/shared";

export type BounceRate = {
  tag: string;
  /** Games in this genre the owner gave up on. */
  bounced: number;
  /** Every game in this genre they ever opened, bounced or not. */
  tried: number;
};

/**
 * Below this a rate is an anecdote, not a pattern: one abandoned game out of
 * two opened is a true 50% and still says nothing. Gating on abandonments
 * rather than on attempts also covers the denominator, since a genre cannot
 * have been tried fewer times than it was dropped.
 */
const MIN_BOUNCED = 2;

const LEADING_BOUNCES = 3;

/**
 * "Bounced off 7" is only a claim next to "tried 8" — three abandoned games
 * read completely differently at 3-of-3 than at 3-of-16. The tasted fingerprint
 * carries the numerator and the lifetime one the rest of the denominator, so
 * the join happens here rather than the api shipping a rate.
 *
 * Ranked by rate, then by volume to break ties, and by carrier counts
 * throughout: inside a cohort capped at 59 minutes the minute-weighted `share`
 * a fingerprint sorts by is noise.
 */
export function bounceRates(
  tasted: GenreFingerprint,
  lifetime: GenreFingerprint
): BounceRate[] {
  const stuckWith = new Map(lifetime.genres.map((genre) => [genre.tag, genre.gameCount]));

  return tasted.genres
    .map((genre) => ({
      tag: genre.tag,
      bounced: genre.gameCount,
      tried: genre.gameCount + (stuckWith.get(genre.tag) ?? 0),
    }))
    .filter((rate) => rate.bounced >= MIN_BOUNCED)
    .sort((a, b) => bounceShare(b) - bounceShare(a) || b.bounced - a.bounced)
    .slice(0, LEADING_BOUNCES);
}

export function bounceShare(rate: BounceRate): number {
  return rate.tried === 0 ? 0 : rate.bounced / rate.tried;
}

/** "tried 2 JRPGs, bounced off both" — the second half only. */
export function describeBounce(rate: BounceRate): string {
  if (rate.bounced === rate.tried) return rate.tried === 2 ? "both" : "every one";
  return `${rate.bounced}`;
}
