// The genre fingerprint: which kinds of game the owner's hours actually sit in.
//
// Two things make this less obvious than a group-by. A game carries up to 20
// community tags and several of them are genres, so its playtime has to be
// *divided* across the genres it matched rather than repeated against each one
// — counting a 434-hour game once per tag reports 300% of a library. And the
// input must already be a cleaned cohort, or a 12-minute curiosity launch
// contributes 12 minutes of its genre to identity. Call `excludeBarelyTouched`
// (lifetime) or `excludeBarelyPlayedInWindow` (recency) first; this function
// trusts what it is handed.

import { selectGenreTags } from "./genre-tags.ts";

/** A share resting on fewer games than this describes a game, not a player. */
export const THIN_GENRE_CARRIERS = 3;

/** How many games a genre names as its own. Enough to recognise, short enough to read. */
export const GENRE_EXAMPLE_LIMIT = 3;

export type FingerprintGame = {
  appid: number;
  name: string;
  minutes: number;
  tags: readonly string[];
};

export type GenreExample = {
  appid: number;
  name: string;
  /**
   * The game's **own** playtime in the cohort, not the slice this genre was
   * attributed. A game's minutes are divided across the genres it matched, so
   * these deliberately do not add up to `GenreShare.minutes` — they answer
   * "which games are these?", not "where did the total come from?".
   */
  minutes: number;
};

export type GenreShare = {
  tag: string;
  minutes: number;
  /** Fraction of `distributedMinutes`, 0..1. */
  share: number;
  /**
   * How many cohort games carry this genre. Measured 2026-08-01, the owner's
   * third-ranked genre rested on a single 434-hour game while the second
   * rested on thirteen — indistinguishable from the percentage alone, which is
   * why card copy gets to see this number.
   */
  gameCount: number;
  /** The genre's biggest carriers, longest-played first, capped at `GENRE_EXAMPLE_LIMIT`. */
  examples: GenreExample[];
};

export type GenreFingerprint = {
  /** Ranked by minutes descending, ties broken alphabetically so order is stable. */
  genres: GenreShare[];
  /** The denominator the shares divide: minutes from games that matched a genre. */
  distributedMinutes: number;
  gamesCounted: number;
  /** Cohort games whose tags matched no genre at all — the blind spot to disclose. */
  gamesWithoutGenre: number;
};

export function buildGenreFingerprint(
  games: Iterable<FingerprintGame>
): GenreFingerprint {
  const minutesByGenre = new Map<string, number>();
  const carriersByGenre = new Map<string, FingerprintGame[]>();
  let distributedMinutes = 0;
  let gamesCounted = 0;
  let gamesWithoutGenre = 0;

  for (const game of games) {
    const genres = selectGenreTags(game.tags);
    if (genres.length === 0) {
      gamesWithoutGenre += 1;
      continue;
    }

    gamesCounted += 1;
    distributedMinutes += game.minutes;
    const perGenre = game.minutes / genres.length;
    for (const genre of genres) {
      minutesByGenre.set(genre, (minutesByGenre.get(genre) ?? 0) + perGenre);
      const carriers = carriersByGenre.get(genre);
      if (carriers === undefined) carriersByGenre.set(genre, [game]);
      else carriers.push(game);
    }
  }

  const genres = [...minutesByGenre.entries()]
    .map(([tag, minutes]) => {
      const carriers = carriersByGenre.get(tag) ?? [];
      return {
        tag,
        minutes,
        share: distributedMinutes === 0 ? 0 : minutes / distributedMinutes,
        gameCount: carriers.length,
        examples: selectGenreExamples(carriers),
      };
    })
    .sort((a, b) => b.minutes - a.minutes || a.tag.localeCompare(b.tag));

  return { genres, distributedMinutes, gamesCounted, gamesWithoutGenre };
}

// Ranked by the game's own playtime rather than by the slice this genre was
// attributed: the question a reader asks of a genre row is "which games are
// these?", and a game that split its hours four ways is no less an example of
// each than one that matched a single genre.
function selectGenreExamples(carriers: readonly FingerprintGame[]): GenreExample[] {
  return [...carriers]
    .sort((a, b) => b.minutes - a.minutes || a.name.localeCompare(b.name))
    .slice(0, GENRE_EXAMPLE_LIMIT)
    .map((game) => ({ appid: game.appid, name: game.name, minutes: game.minutes }));
}

export function isThinGenre(genre: GenreShare): boolean {
  return genre.gameCount < THIN_GENRE_CARRIERS;
}
