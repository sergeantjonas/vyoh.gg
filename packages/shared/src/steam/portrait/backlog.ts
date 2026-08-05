// The bridge between the two halves of the Portrait: what the library says the
// owner should play next, scored from local data only — no Steam call.
//
// The catalog specced this against the *recent* fingerprint ("what you've been
// playing the last 6 weeks"). Chunk 2a measured that window at three games and
// 29 hours, every genre in it resting on a single title, so a recommendation
// built on it would be recommending one purchase back at itself. These score
// against whichever fingerprint the caller hands over, and the service hands
// over the lifetime one until the recency window holds a shape worth matching.

import type { GenreFingerprint } from "./fingerprint.ts";
import { selectGenreTags } from "./genre-tags.ts";

/** Beyond this, an unplayed game with nothing in common is shelf furniture. */
export const ANCIENT_RELEASE_YEARS = 10;

/**
 * Subtracted from a candidate that is both ancient and shares no genre with the
 * portrait. It only ever applies where the overlap is already zero, so its job
 * is to sort bundle leftovers below the merely-unmatched rather than to
 * outweigh a real signal.
 */
export const ANCIENT_PENALTY = 0.05;

/** Untouched games named per sleeping genre. */
export const SLEEPING_GAME_LIMIT = 3;

export type BacklogCandidate = {
  appid: number;
  name: string;
  tags: readonly string[];
  releaseDate: Date | null;
  playtimeForeverMinutes: number;
};

export type BacklogContext = {
  fingerprint: GenreFingerprint;
  /**
   * The year `ANCIENT_RELEASE_YEARS` counts back from — the newest release in
   * the library. Passed in rather than read from the clock on purpose: this
   * scores on the server and again during hydration, and anything derived from
   * `Date.now()` produces a different answer across that boundary. Null
   * disables the age penalty rather than guessing a year.
   */
  referenceYear: number | null;
};

export type ScoredCandidate = {
  candidate: BacklogCandidate;
  score: number;
  /** The candidate's genres that the portrait also carries, strongest first. */
  matched: string[];
  /** Every genre the candidate carries — the denominator in "3 of its 5". */
  genreCount: number;
};

/**
 * A candidate's score is the share of the portrait its genres account for: sum
 * the fingerprint share of each genre the game carries. That makes the number
 * mean something rather than counting tag hits — matching two genres worth 3%
 * between them should not beat matching one worth 30%.
 */
export function scoreCandidate(
  candidate: BacklogCandidate,
  { fingerprint, referenceYear }: BacklogContext
): ScoredCandidate {
  const shareByTag = new Map(fingerprint.genres.map((genre) => [genre.tag, genre.share]));
  const genres = selectGenreTags(candidate.tags);
  const matched = genres
    .filter((tag) => shareByTag.has(tag))
    .sort((a, b) => (shareByTag.get(b) ?? 0) - (shareByTag.get(a) ?? 0));

  const overlap = matched.reduce((sum, tag) => sum + (shareByTag.get(tag) ?? 0), 0);
  const penalty =
    overlap === 0 && isAncient(candidate.releaseDate, referenceYear)
      ? ANCIENT_PENALTY
      : 0;

  return { candidate, score: overlap - penalty, matched, genreCount: genres.length };
}

function isAncient(releaseDate: Date | null, referenceYear: number | null): boolean {
  if (releaseDate === null || referenceYear === null) return false;
  return referenceYear - releaseDate.getUTCFullYear() >= ANCIENT_RELEASE_YEARS;
}

/** Owned, never launched, and carrying at least one genre to match on. */
export function selectBacklogCandidates<T extends BacklogCandidate>(
  games: Iterable<T>
): T[] {
  return [...games].filter(
    (game) => game.playtimeForeverMinutes === 0 && selectGenreTags(game.tags).length > 0
  );
}

// Both single-pick surfaces ask the same question of different cohorts — how
// much of this portrait does the game account for — so they share the ranking
// and differ only in what is handed in.
function bestMatch(
  games: Iterable<BacklogCandidate>,
  context: BacklogContext
): ScoredCandidate | null {
  return (
    [...games]
      .map((candidate) => scoreCandidate(candidate, context))
      .filter((entry) => entry.matched.length > 0)
      .sort(
        (a, b) => b.score - a.score || a.candidate.name.localeCompare(b.candidate.name)
      )[0] ?? null
  );
}

/** The single strongest recommendation, or null when nothing overlaps at all. */
export function selectPickUpNext(
  candidates: Iterable<BacklogCandidate>,
  context: BacklogContext
): ScoredCandidate | null {
  return bestMatch(candidates, context);
}

/**
 * The abandoned game the owner should most regret: opened once, dropped, and
 * carrying the genres they otherwise spend their hours in.
 */
export function selectHighestRegret(
  tasted: Iterable<BacklogCandidate>,
  context: BacklogContext
): ScoredCandidate | null {
  return bestMatch(tasted, context);
}

export type SleepingGenre = {
  tag: string;
  /** Minutes the portrait attributes to this genre — why it is worth waking. */
  minutes: number;
  /** Untouched owned games carrying it, alphabetical. */
  games: BacklogCandidate[];
  /** How many there are in total, which `games` is a sample of. */
  untouchedCount: number;
};

/**
 * The genre the owner demonstrably likes and demonstrably is not playing,
 * ranked by **share × waiting count** — how much of the portrait is sitting
 * unplayed in it.
 *
 * Both halves are load-bearing, measured against the live library on
 * 2026-08-05. Ranking by count alone crowns `Action` (112 waiting, 1% of the
 * portrait) and `Adventure` (101 waiting, 1%) — umbrella genres that every
 * bundle leftover carries, which is the opposite of a genre the owner loves.
 * Ranking by share alone crowns the anchor genre, which is the one "Pick up
 * next" is already recommending from, so the two cards say the same thing
 * twice. The product picks `Action RPG` (23 waiting at 23%) over both.
 *
 * Requires more than one waiting game. A single untouched title in a genre is
 * the "Pick up next" card's job; calling it a pattern is the same thin-data
 * trap the bounce card is gated for.
 */
export function selectSleepingGenre(
  candidates: Iterable<BacklogCandidate>,
  { fingerprint }: BacklogContext,
  /**
   * Kept out of the named sample but not out of the count — the "Pick up next"
   * card sits beside this one and is drawn from the same pool, so its game is
   * usually the strongest match in the strongest genre. Naming it in both
   * spends a slot saying nothing new.
   */
  excludeAppid?: number
): SleepingGenre | null {
  const waiting = new Map<string, BacklogCandidate[]>();
  for (const candidate of candidates) {
    for (const tag of selectGenreTags(candidate.tags)) {
      const games = waiting.get(tag);
      if (games === undefined) waiting.set(tag, [candidate]);
      else games.push(candidate);
    }
  }

  const neglected = (entry: { genre: { share: number }; games: unknown[] }) =>
    entry.genre.share * entry.games.length;

  const best = fingerprint.genres
    .map((genre) => ({ genre, games: waiting.get(genre.tag) ?? [] }))
    .filter((entry) => entry.games.length > 1)
    .sort((a, b) => neglected(b) - neglected(a) || b.genre.minutes - a.genre.minutes)[0];

  if (best === undefined) return null;
  return {
    tag: best.genre.tag,
    minutes: best.genre.minutes,
    // Newest first, not alphabetical: the sample should name games the owner
    // remembers buying, and A-to-Z just names whatever starts with a B.
    games: best.games
      .filter((game) => game.appid !== excludeAppid)
      .sort(byNewestRelease)
      .slice(0, SLEEPING_GAME_LIMIT),
    untouchedCount: best.games.length,
  };
}

function byNewestRelease(a: BacklogCandidate, b: BacklogCandidate): number {
  const at = a.releaseDate?.getTime() ?? Number.NEGATIVE_INFINITY;
  const bt = b.releaseDate?.getTime() ?? Number.NEGATIVE_INFINITY;
  return bt - at || a.name.localeCompare(b.name);
}
