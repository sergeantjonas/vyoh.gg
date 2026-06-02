// Landing-page recap chapter descriptor — the slim wire shape produced by
// the cross-source `/recap/chapters` selector and consumed by `useChapters()`
// on `/`. The Ahri chapter is a hardcoded anchor above this list (owner is an
// Ahri OTP — per docs/working-notes/cross-cutting/self-portrait-recap-arc.md
// ADR-6), so the discriminated union has no `lol-subject` kind by design:
// algorithmic chapters cover Steam subjects (R-4) and LoL/Steam moments
// (R-6/R-7). Keeping the discriminator stable now means R-6/R-7 are additive
// instead of a contract bump.

import type { SteamAgeBucket } from "../steam/game-recap.ts";

/** Bucket label reused across recap chapter kinds. */
export type RecapAgeBucket = SteamAgeBucket;

/** Per-descriptor framing override populated from `landing-config.ts`. Null
 *  when the algorithmic copy stands without curator intervention. */
export interface RecapChapterFraming {
  eyebrow?: string;
  title?: string;
}

/**
 * Steam game chapter — driven by playtime + achievement signal with a
 * recency decay. Emitted by R-4a. `slug` follows the `steam-{appid}` shape
 * so `landing-config.ts` overrides can key on a stable identifier without
 * depending on the (mutable) Steam display name.
 */
export interface SteamSubjectChapterDescriptor {
  kind: "steam-subject";
  slug: string;
  appid: number;
  name: string;
  score: number;
  /** Days since the candidate's most recent activity signal (last unlock or
   *  last-played, whichever is fresher). Integer. */
  daysSince: number;
  ageBucket: RecapAgeBucket;
  framing: RecapChapterFraming | null;
}

/**
 * Match-level stats carried on a LoL moment chapter — the receipt that backs
 * the moment's editorial framing. Populated by the detector from the same
 * `Match` row that drives `matchId`/`championAlias`, so no extra API call
 * is needed on the web side. Null when the moment isn't backed by a single
 * match (e.g. future STREAK or MARATHON momentTypes that describe a sequence
 * rather than a specific game).
 */
export interface LolMomentMatchStats {
  kills: number;
  deaths: number;
  assists: number;
  win: boolean;
  durationSec: number;
  queueType: string;
}

/**
 * Rank transition carried on a `RANK_UP` LoL moment chapter — the before/after
 * pair the detector reads off the match's snapshot columns. The transition is
 * always strictly upward (`normalizeLp(to…) > normalizeLp(from…)`) AND involves
 * a tier or division change — LP-only gains are not RANK_UP moments. Null on
 * other momentTypes.
 */
export interface LolRankUpDelta {
  fromTier: string;
  fromRank: string;
  fromLp: number;
  toTier: string;
  toRank: string;
  toLp: number;
}

/**
 * KDA outlier framing carried on a `KDA_OUTLIER` LoL moment chapter. The
 * match's KDA is the headline number; `baselineKda` is the owner's 30-day
 * ranked mean so the chapter can show the "Nx the average" multiplier. Both
 * stored as floats; the chapter rounds for display. Null on other momentTypes.
 */
export interface LolKdaOutlierStats {
  matchKda: number;
  baselineKda: number;
}

/**
 * Hiatus framing carried on a `RETURN_FROM_HIATUS` LoL moment chapter. The
 * chapter narrates "X days away, then back on the rift on Champ"; `gapDays`
 * is the integer number of days between the return match and the previous
 * owner ranked match. Null on other momentTypes.
 */
export interface LolHiatusReturnStats {
  gapDays: number;
}

/**
 * Streak framing carried on a `STREAK_5W` / `STREAK_5L` LoL moment chapter.
 * `length` is the run of consecutive same-result ranked matches starting
 * from the most recent game (active or just-completed streak). The chapter
 * shows "{length} wins/losses in a row, last on Champ". Null on other
 * momentTypes.
 */
export interface LolStreakStats {
  result: "W" | "L";
  length: number;
}

/**
 * LoL moment chapter — single-event narrative (rank-up, KDA outlier, off-meta
 * pick, streak, return-from-hiatus, etc.). Schema declared now so the
 * `/recap/chapters` contract is stable; emitted in R-6.
 */
export interface LolMomentChapterDescriptor {
  kind: "lol-moment";
  slug: string;
  momentType:
    | "RANK_UP"
    | "OFF_META_PICK"
    | "MARATHON"
    | "KDA_OUTLIER"
    | "STREAK_5W"
    | "STREAK_5L"
    | "RETURN_FROM_HIATUS";
  score: number;
  daysSince: number;
  ageBucket: RecapAgeBucket;
  matchId: string | null;
  championAlias: string | null;
  matchStats: LolMomentMatchStats | null;
  rankUp: LolRankUpDelta | null;
  kdaOutlier: LolKdaOutlierStats | null;
  hiatusReturn: LolHiatusReturnStats | null;
  streak: LolStreakStats | null;
  framing: RecapChapterFraming | null;
}

/**
 * Steam moment chapter — single-event narrative (achievement cluster, first
 * play of a tracked game). Emitted in R-7.
 */
export interface SteamMomentChapterDescriptor {
  kind: "steam-moment";
  slug: string;
  momentType: "ACHIEVEMENT_CLUSTER" | "FIRST_TIME_GAME";
  score: number;
  daysSince: number;
  ageBucket: RecapAgeBucket;
  appid: number;
  framing: RecapChapterFraming | null;
}

export type RecapChapterDescriptor =
  | SteamSubjectChapterDescriptor
  | LolMomentChapterDescriptor
  | SteamMomentChapterDescriptor;

export interface RecapChaptersResponse {
  chapters: RecapChapterDescriptor[];
}
