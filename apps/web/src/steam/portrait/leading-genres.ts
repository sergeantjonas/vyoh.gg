import type { GenreShare } from "@vyoh/shared";
import { isThinGenre } from "@vyoh/shared";

const LEADING_GENRES = 3;

/**
 * The genres a claim may name: the leading few, minus any trailing entry too
 * thin to describe a player.
 *
 * The trim is what stops the third slot from being noise. Measured 2026-08-02
 * the owner's fourth-ranked genre was 434 hours of one game sitting half a
 * percentage point behind a genre carried by ten — indistinguishable from the
 * share alone, and a card that named it would be reporting a single purchase
 * as an identity. Always keeps the first entry, so a fingerprint made entirely
 * of thin genres returns one and the caller can see that it is thin.
 */
export function leadingGenres(genres: readonly GenreShare[]): GenreShare[] {
  const leading = genres.slice(0, LEADING_GENRES);
  while (leading.length > 1) {
    const last = leading.at(-1);
    if (last === undefined || !isThinGenre(last)) break;
    leading.pop();
  }
  return leading;
}

export function joinGenres(genres: readonly GenreShare[]): string {
  const names = genres.map((genre) => genre.tag);
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

export function shareOf(genres: readonly GenreShare[]): number {
  return genres.reduce((sum, genre) => sum + genre.share, 0);
}
