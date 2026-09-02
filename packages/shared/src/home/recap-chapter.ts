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
  queueId: number;
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
 * Marathon-session framing carried on a `MARATHON` LoL moment chapter.
 * `matchCount` is the number of ranked games inside the marathon window
 * (≥6); `spanHours` is the elapsed hours between the first and last match
 * of the session (≤12). The chapter narrates "N ranked games in one
 * sitting, capped on Champ". Null on other momentTypes.
 */
export interface LolMarathonStats {
  matchCount: number;
  spanHours: number;
}

/**
 * Lifetime-peak-rank framing carried on a `LIFETIME_PEAK_RANK` LoL
 * moment chapter. R-7i Lane B retrospective detector — surfaces the
 * owner's all-time peak rank regardless of whether they've played
 * recently. Fills the LoL block during TRUE dry spells (no ranked play
 * in 30d at all), where even the Lane A `FAVORITE_CHAMPION_OF_PERIOD`
 * detector goes empty. Editorial register is explicitly retrospective
 * ("Looking back —") so the reader doesn't read it as recent-moment
 * energy.
 *
 *   - `tier` / `rank` / `leaguePoints` — the peak snapshot triple. Apex
 *     tiers (Master+) drop the division in the displayed title.
 *   - `achievedAt` — ISO date of the match where the peak was hit.
 *     Drives the "Season YYYY" caption + the chapter's matchId link
 *     (the chapter's `matchId` field points to that match for the
 *     click-through).
 *
 * Null on other momentTypes.
 */
export interface LolLifetimePeakStats {
  tier: string;
  rank: string;
  leaguePoints: number;
  achievedAt: string;
}

/**
 * Favorite-champion-of-period framing carried on a
 * `FAVORITE_CHAMPION_OF_PERIOD` LoL moment chapter. R-7i Lane A filler
 * detector — fires whenever there's a champion the owner played heavily
 * in the 30d window (≥5 games), even if no event-flavored moment fired.
 * Fills the LoL block during dry spells where rank-ups / KDA outliers /
 * streaks / marathons all stay silent but ranked play DID happen.
 *
 *   - `gameCount` — total ranked games on this champion in the window.
 *   - `winCount` / `lossCount` — win/loss split (`winCount + lossCount =
 *     gameCount`). Drives the receipt's WR%.
 *   - `championAlias` — the champion's Riot alias; matches the descriptor's
 *     top-level `championAlias` field. Carried here so the chapter receipt
 *     can read it without falling back to the top-level for type-narrowing.
 *
 * Null on other momentTypes.
 */
export interface LolFavoriteChampionStats {
  gameCount: number;
  winCount: number;
  lossCount: number;
  championAlias: string;
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
    | "RETURN_FROM_HIATUS"
    | "FAVORITE_CHAMPION_OF_PERIOD"
    | "LIFETIME_PEAK_RANK";
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
  marathon: LolMarathonStats | null;
  favoriteChampion: LolFavoriteChampionStats | null;
  lifetimePeak: LolLifetimePeakStats | null;
  framing: RecapChapterFraming | null;
}

/**
 * First-time framing carried on a `FIRST_TIME_GAME` Steam moment chapter.
 *
 *   - `windowPlayMinutes` / `sessionCount` — total play + number of distinct
 *     closed sessions since the first launch. Drives the headline receipt
 *     and lets the reader distinguish "one long sit-down" from "kept coming
 *     back over a week".
 *   - `firstSessionMinutes` — duration of the first session specifically.
 *     Editorially: a 4h first sit-down reads as instant engagement; a 30m
 *     first session followed by longer ones reads as "warmed up to it".
 *     This stat is the sub-beat of the receipt strip.
 *   - `addedAt` / `firstPlayedAt` — ISO date strings for "when we first saw
 *     the game in your library" vs "when you first actually launched it".
 *     The gap (or lack of one) is the chapter's narrative seed: same-day =
 *     "dove right in", multi-day = "made time for it after picking it up",
 *     long-gap = "backlog finally beaten".
 *
 * Null on other momentTypes.
 */
export interface SteamFirstTimeStats {
  windowPlayMinutes: number;
  sessionCount: number;
  firstSessionMinutes: number;
  addedAt: string;
  firstPlayedAt: string;
}

/**
 * Achievement-cluster framing carried on an `ACHIEVEMENT_CLUSTER` Steam
 * moment chapter. A "cluster" is ≥5 unlocks on one game inside a 24h
 * window. The detector picks the densest qualifying window per appid;
 * this descriptor carries the receipt the chapter renders:
 *
 *   - `unlockCount` — total unlocks inside the cluster's 24h window.
 *   - `spanHours` — elapsed wall-clock hours from the first to last unlock
 *     of the cluster (≤24). Tighter spans read as "session run"; wider
 *     spans as "binge day".
 *   - `capUnlockedAt` — ISO timestamp of the most recent unlock in the
 *     cluster (the "cap"). Anchors the chapter's "when" line + drives the
 *     decay score's recency anchor.
 *   - `unlockNames` — up to 5 achievement display names from the cluster,
 *     ordered by unlock time. Lets the chapter render an inline receipt
 *     ("Survivor · Hunter · Marksman …") without a second roundtrip
 *     through the achievement-schema query.
 *
 * Null on other momentTypes.
 */
export interface SteamAchievementClusterStats {
  unlockCount: number;
  spanHours: number;
  capUnlockedAt: string;
  unlockNames: string[];
}

/**
 * One owner unlock on a launch-window title, paired with the global rarity
 * Steam reported at the most recent observation before the unlock and the
 * value it carries today.
 *
 *   - `percentAtUnlock` — the raw reading Steam sent, never more than
 *     `LAUNCH_DRIFT_SAMPLE_MAX_AGE_MS` older than `unlockedAt`. May be a
 *     literal `0`: that is Steam's floor for any share below its one-decimal
 *     resolution, not a measurement of zero, and every surface renders it as
 *     `<0.1%`.
 *   - `percentNow` — the current value from the rarity row.
 *
 * Unlocks with no qualifying earlier sample are absent from the receipt
 * entirely rather than falling back to softer copy; see the known-limit
 * section of docs/working-notes/steam/achievement-rarity-drift.md.
 */
export interface SteamLaunchDriftUnlock {
  apiName: string;
  displayName: string;
  unlockedAt: string;
  percentAtUnlock: number;
  percentNow: number;
}

/**
 * Launch-window rarity drift carried on a `LAUNCH_RARITY_DRIFT` Steam moment
 * chapter — a game the owner played inside its release window, whose global
 * unlock rates climbed under them as the rest of the player base caught up:
 *
 *   - `releaseDate` — `yyyy-mm-dd`, from the game's enrichment row.
 *   - `observedFrom` / `observedTo` — ISO bounds of the rarity history the
 *     curve is drawn from.
 *   - `observationCount` — distinct observation timestamps for the game, not
 *     history rows. It is the honest denominator for "N readings over D days".
 *   - `bracketedUnlockCount` — owner unlocks that had a qualifying sample,
 *     counted before the visibility filter, so the chapter can say how many
 *     more were earned early than the receipt names.
 *   - `headline` — `receipt[0]`, hoisted for the prose. Identity holds only
 *     server-side; across the wire it is a separate object, so a consumer must
 *     not filter the receipt tail by reference.
 *   - `curve` — the headline achievement's global percentage at each
 *     observation, ascending, at least two points.
 *   - `receipt` — 3–5 unlocks ranked by relative gain, absolute gain as the
 *     tiebreak. Fewer than three qualifying rows produces no stats at all.
 *
 * Null on other momentTypes.
 */
export interface SteamLaunchDriftStats {
  releaseDate: string;
  observedFrom: string;
  observedTo: string;
  observationCount: number;
  bracketedUnlockCount: number;
  headline: SteamLaunchDriftUnlock;
  curve: number[];
  receipt: SteamLaunchDriftUnlock[];
}

/**
 * Steam moment chapter — single-event narrative (achievement cluster, first
 * play of a tracked game, rarity drift on a launch-window title).
 * `FIRST_TIME_GAME` ships in R-7f; `ACHIEVEMENT_CLUSTER` ships in R-7g;
 * `LAUNCH_RARITY_DRIFT` ships in R3 of the achievement-rarity-drift arc.
 * `name` is the Steam display name carried inline so the chapter can render
 * the masthead without a second roundtrip through `useSteamGameRecap`.
 */
export interface SteamMomentChapterDescriptor {
  kind: "steam-moment";
  slug: string;
  momentType: "ACHIEVEMENT_CLUSTER" | "FIRST_TIME_GAME" | "LAUNCH_RARITY_DRIFT";
  score: number;
  daysSince: number;
  ageBucket: RecapAgeBucket;
  appid: number;
  name: string;
  firstTime: SteamFirstTimeStats | null;
  cluster: SteamAchievementClusterStats | null;
  launchDrift: SteamLaunchDriftStats | null;
  framing: RecapChapterFraming | null;
}

export type RecapChapterDescriptor =
  | SteamSubjectChapterDescriptor
  | LolMomentChapterDescriptor
  | SteamMomentChapterDescriptor;

export interface RecapChaptersResponse {
  chapters: RecapChapterDescriptor[];
}
