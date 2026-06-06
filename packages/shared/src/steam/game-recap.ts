import type { VerdictClause } from "../lol/champion-recap.ts";
import type { SteamGameAchievements } from "./achievements.ts";
import type { SteamOwnedGame } from "./owned-games.ts";
import type { SteamScreenshotEntry } from "./screenshots.ts";

/**
 * Slim projection of a single recent unlock — the deriver's row shape for the
 * "recent unlocks" strip in a Steam subject chapter. `unlockedAt` is
 * non-nullable here (locked rows are filtered out before this projection);
 * `globalPercent` stays nullable because the weekly rarity poll may not have
 * covered every achievement on the game yet (first hours after a new game's
 * schema lands).
 */
export interface SteamUnlock {
  apiName: string;
  displayName: string;
  description: string;
  hidden: boolean;
  unlockedAt: string;
  globalPercent: number | null;
}

/**
 * One unlock surfaced as the chapter's editorial receipt — the rarest unlock
 * the owner has cleared on this game, with recency as tiebreak so a stale
 * rare unlock doesn't beat an equally-rare fresh one. Mirrors the
 * ChampionSignatureGame contract — pre-computes `daysAgo` so the chapter
 * doesn't redo the date math at render time.
 */
export interface SteamStandoutUnlock extends SteamUnlock {
  daysAgo: number;
}

/** Max length of `recentUnlocks` returned by the deriver. */
export const STEAM_RECAP_RECENT_UNLOCKS_LIMIT = 5;

/**
 * Max length of `unlocksPerWeek` returned by the deriver. 12 weeks is the
 * sparkline-band horizon — three months of trailing unlock cadence. Beyond
 * that the visual reads as "history" rather than "what's happening lately."
 * The window is right-anchored at the current Brussels week and adaptive
 * on the left: a game with only 4 weeks of unlock history shows 4 columns,
 * not 8 weeks of leading zeros.
 */
export const STEAM_RECAP_UNLOCKS_PER_WEEK_LIMIT = 12;

/** Max length of `remainingRarestUnlocks` returned by the deriver — the
 * achievements-remaining ladder on beat 2. Three rows fits comfortably
 * alongside the existing PeakChip strip without crowding the beat. */
export const STEAM_RECAP_REMAINING_LIMIT = 3;

/** Min minutes in the trailing 30d for the playtime trend to read as
 * "active" (rather than "dormant"). Equivalent to ~10 min/day average. */
const TREND_ACTIVE_MIN_MINUTES = 300;
/** Multiplier above which a trailing-7d burst flips the trend from
 * "active" to "spike". Last 7 days must be ≥ this × the prior 23-day
 * daily average. */
const TREND_SPIKE_MULTIPLIER = 2;

/**
 * Playtime trend bucket derived from `recentPlaytimeMinutes` (last 30
 * days, oldest first). Drives the beat-2 trend chip on the Steam chapter:
 *
 *  - `spike`   — last 7d totals ≥ TREND_SPIKE_MULTIPLIER × prior 23-day
 *                daily average (game is being binged right now)
 *  - `active`  — total trailing-30d ≥ TREND_ACTIVE_MIN_MINUTES but no
 *                7-day spike
 *  - `dormant` — total trailing-30d < TREND_ACTIVE_MIN_MINUTES (game has
 *                gone quiet)
 *
 * Null when the snapshot array is empty (no recent playtime data on
 * file) — chapter hides the trend chip in that case.
 */
export type SteamPlaytimeTrend = "spike" | "active" | "dormant";

/** Min 2-week playtime (minutes) to flag the chapter as currently-active. */
const CURRENT_THRESHOLD_MIN = 300;
/** Min lifetime playtime (minutes) to flag the chapter as engrossed-tier. */
const ENGROSSED_THRESHOLD_MIN = 1800;
/**
 * Achievement completion ratio threshold for the completionist primary
 * verdict. Set to 1.0 (truly 100%) so the 80–99% range falls through to
 * "nearly cleared" framing — at 90%+ the editorial weight is in the *gap*
 * ("3 achievements left"), not in calling it cleared when it isn't.
 */
const COMPLETIONIST_THRESHOLD = 1.0;
/** Days since last play that flips the chapter into dormant territory. */
const DORMANT_THRESHOLD_DAYS = 90;
/** Global-percent ceiling above which an unlock no longer reads as "rare". */
const RARE_UNLOCK_PERCENT_CEILING = 25;

/**
 * Age bucket for the chapter's honest-recency framing copy. Boundaries are
 * the arc note's "Steam framing" column — the chapter picks an eyebrow
 * label based on which bucket the owner's last play falls into.
 */
export type SteamAgeBucket = "current" | "recent" | "season" | "year";

/**
 * Full recap shape returned by the deriver. Mirrors the slim+wide tradeoff
 * from `ChampionRecap` — narrow enough not to bloat the wire, wide enough
 * that each band in the chapter has its own row of story to tell:
 *
 *  - Opener     → name + heroImageUrl source fields + accent + age bucket
 *  - Verdict    → playtime forever + achievements + recent trajectory
 *  - Sparkline  → recentPlaytimeMinutes (last 30d, oldest first)
 *  - Unlocks    → recentUnlocks (up to 5 newest-first)
 *  - Standout   → standoutUnlock (rarest + recency tiebreak)
 *  - Closer     → screenshots (raw entries — chapter composes URLs)
 *
 * Asset URL composition lives at the consumer (web layer) because the URL
 * shape is web-only (proxied through the API host); the deriver exposes
 * enough fields for the chapter to call `steamLibraryHeroUrl` itself.
 */
export interface SteamGameRecap {
  appid: number;
  name: string;
  // Asset bookkeeping for composing hero/backdrop URLs at render time. The
  // chapter component calls `steamLibraryHeroUrl(appid, assetTimestamp,
  // flipHero)` with these fields; the deriver doesn't compose the URL itself
  // because the proxy host lives in the web layer.
  assetTimestamp: number | null;
  hasLibraryHero: boolean;
  flipHero: boolean;
  // Saliency anchor on `library_hero.jpg` (0–100 integer percent), computed
  // by the enrichment-side face detector. The chapter passes these through
  // to the atmosphere claim → `object-position` on the backdrop, so the
  // focal subject stays visible regardless of how the image is cropped at
  // the viewport. Both null when the anchor hasn't been computed yet —
  // renderer treats null and 50/50 identically (center crop).
  subjectXPercent: number | null;
  subjectYPercent: number | null;
  // True when the enrichment row carries a `logoPath`. Drives the chapter's
  // masthead choice: official Steam logo when `hasLogo`, typographic
  // fallback when not (~5% of titles ship without one).
  hasLogo: boolean;
  // Per-game dominant color (already in the owned-games enrichment pipeline).
  // Drives the chapter's `--accent` cascade — null when enrichment hasn't
  // covered this app yet.
  dominantHex: string | null;
  // One-line marketing blurb — the chapter's subtitle slot (equivalent to
  // CHAMPION_TITLE in the Ahri chapter, just deriver-supplied instead of
  // hardcoded). Null when the enrichment row is missing.
  shortDescription: string | null;
  // Lifetime + 2-week playtime story (minutes). `playtime2WeeksMinutes` is
  // null when Steam reports no recent activity at all — kept distinct from
  // 0 because Steam itself draws that distinction (the field is omitted
  // rather than zeroed when there's no recent play).
  playtimeForeverMinutes: number;
  playtime2WeeksMinutes: number | null;
  // Last client-reported launch (ISO). Null on titles the owner has never
  // started — drives the recency/dormancy story and the age bucket.
  lastPlayedAt: string | null;
  // Steam storefront release date (`YYYY-MM-DD`). Null when the enrichment
  // row hasn't been populated or the upstream omitted a release block. Used
  // for the chapter's release-date chip — pure metadata, not part of any
  // ageBucket / verdict computation (those key on owner activity, not
  // calendar age of the title).
  releaseDate: string | null;
  // Per-day playtime over the last up-to-30 days, oldest first. Drives the
  // sparkline band; empty when the game has fewer than two snapshots on file.
  recentPlaytimeMinutes: number[];
  // Achievement story. `achievementsTotal` is null when the game has no
  // schema (CS2, demos, schema-less titles); the chapter hides the
  // achievement band entirely in that case. When total is 0 the same hide
  // applies — the schema exists but is empty.
  achievementsTotal: number | null;
  achievementsUnlocked: number;
  /** 0..1 ratio; null when achievementsTotal is null/0. */
  completionPct: number | null;
  recentUnlocks: SteamUnlock[];
  // Per-week unlock counts ending at the current Brussels calendar week,
  // oldest first. Drives the beat-1 sparkline header band. Empty when the
  // game has no unlocks in the last `STEAM_RECAP_UNLOCKS_PER_WEEK_LIMIT`
  // weeks (the band gates on `length >= 2` to avoid a one-point line). The
  // window is right-anchored and adaptive on the left — see
  // `STEAM_RECAP_UNLOCKS_PER_WEEK_LIMIT` doc.
  unlocksPerWeek: number[];
  // Median `globalPercent` across UNLOCKED achievements (0–100). Null when
  // no unlocked achievement has a known rarity value yet. Drives the beat-2
  // "median rarity" chip — a one-number summary of how rare the owner's
  // unlocks tend to be on this game, complementing the standout's single
  // rarest unlock with the bulk distribution.
  medianAchievementRarity: number | null;
  // Days from first unlock to last unlock on this game. Non-null ONLY when
  // `completionPct === 1` (game is 100%'d) AND both endpoints are known.
  // Drives the beat-2 "cleared in N days" framing for completed games.
  daysToCompletion: number | null;
  // Achievements-remaining ladder for games not yet 100%'d — top
  // `STEAM_RECAP_REMAINING_LIMIT` LOCKED achievements ordered by lowest
  // `globalPercent` (rarest still to unlock first). Empty array when the
  // game is 100%'d, schema-less, or has no remaining achievements with
  // known rarity. Beat-2 renders the ladder for incomplete games as the
  // editorial counterpart to `daysToCompletion` on completed ones.
  remainingRarestUnlocks: SteamUnlock[];
  // Playtime trend bucket — see `SteamPlaytimeTrend` doc. Null when the
  // game has no recent-playtime snapshots on file (the trend chip hides
  // when this is null).
  playtimeTrend: SteamPlaytimeTrend | null;
  standoutUnlock: SteamStandoutUnlock | null;
  // Raw screenshot entries for the closer rotator — chapter composes URLs
  // via `steamScreenshotFullUrl(appid, filename)`.
  screenshots: SteamScreenshotEntry[];
  // Honest recency framing per the arc note: 0–7d → current, 8–30d → recent,
  // 31–90d → season, 91d+ → year. Null when lastPlayedAt is null.
  ageBucket: SteamAgeBucket | null;
}

/**
 * Pure deriver — composes a slim recap from the three upstream payloads
 * (owned-games row, per-game achievements payload, screenshot entries).
 * `now` is injectable so tests don't drift with wall-clock time.
 *
 * Returns a zero-state recap when `ownedGame` is null (game not in the
 * library, or the owned-games poll hasn't covered it yet) — the chapter
 * still renders a meaningful "no data yet" frame instead of unmounting.
 */
export function deriveSteamGameRecap(
  appid: number,
  ownedGame: SteamOwnedGame | null,
  achievements: SteamGameAchievements | null,
  screenshots: readonly SteamScreenshotEntry[],
  now: Date = new Date()
): SteamGameRecap {
  if (!ownedGame) {
    return {
      appid,
      name: "",
      assetTimestamp: null,
      hasLibraryHero: false,
      flipHero: false,
      subjectXPercent: null,
      subjectYPercent: null,
      hasLogo: false,
      dominantHex: null,
      shortDescription: null,
      playtimeForeverMinutes: 0,
      playtime2WeeksMinutes: null,
      lastPlayedAt: null,
      recentPlaytimeMinutes: [],
      achievementsTotal: null,
      achievementsUnlocked: 0,
      completionPct: null,
      recentUnlocks: [],
      unlocksPerWeek: [],
      medianAchievementRarity: null,
      daysToCompletion: null,
      remainingRarestUnlocks: [],
      playtimeTrend: null,
      standoutUnlock: null,
      screenshots: [...screenshots],
      ageBucket: null,
      releaseDate: null,
    };
  }

  const schema = achievements?.achievements ?? null;
  const achievementsTotal = schema === null ? null : schema.length;
  const unlocked = schema === null ? [] : schema.filter((a) => a.unlockedAt !== null);
  const achievementsUnlocked = unlocked.length;
  const completionPct =
    achievementsTotal !== null && achievementsTotal > 0
      ? achievementsUnlocked / achievementsTotal
      : null;

  // Newest unlocks first — `unlockedAt` is ISO so string-compare descending
  // works without parsing dates per row.
  const newestUnlockFirst = [...unlocked].sort((a, b) =>
    (b.unlockedAt ?? "").localeCompare(a.unlockedAt ?? "")
  );

  const recentUnlocks: SteamUnlock[] = newestUnlockFirst
    .slice(0, STEAM_RECAP_RECENT_UNLOCKS_LIMIT)
    .map((a) => ({
      apiName: a.apiName,
      displayName: a.displayName,
      description: a.description,
      hidden: a.hidden,
      // Non-null asserted because the prior filter dropped locked rows. We
      // checked above; this is the projection's contract.
      unlockedAt: a.unlockedAt as string,
      globalPercent: a.globalPercent,
    }));

  const standoutUnlock = pickStandoutUnlock(unlocked, now);
  const unlocksPerWeek = buildUnlocksPerWeek(unlocked, now);
  const medianAchievementRarity = computeMedianRarity(unlocked);
  const daysToCompletion =
    completionPct === COMPLETIONIST_THRESHOLD ? computeDaysToCompletion(unlocked) : null;
  const remainingRarestUnlocks =
    completionPct !== null && completionPct < COMPLETIONIST_THRESHOLD && schema !== null
      ? pickRemainingRarest(schema)
      : [];
  const playtimeTrend = computePlaytimeTrend(ownedGame.recentPlaytimeMinutes);

  const lastPlayedAt = ownedGame.rtimeLastPlayedAt;
  const ageBucket = ageBucketFor(lastPlayedAt, now);

  return {
    appid,
    name: ownedGame.name,
    assetTimestamp: ownedGame.assetTimestamp,
    hasLibraryHero: ownedGame.libraryHeroPath !== null,
    flipHero: ownedGame.flipHero,
    subjectXPercent: ownedGame.subjectXPercent,
    subjectYPercent: ownedGame.subjectYPercent,
    hasLogo: ownedGame.logoPath !== null,
    dominantHex: ownedGame.dominantHex,
    shortDescription: ownedGame.shortDescription,
    playtimeForeverMinutes: ownedGame.playtimeForeverMinutes,
    playtime2WeeksMinutes: ownedGame.playtime2WeeksMinutes,
    lastPlayedAt,
    recentPlaytimeMinutes: [...ownedGame.recentPlaytimeMinutes],
    achievementsTotal,
    achievementsUnlocked,
    completionPct,
    recentUnlocks,
    unlocksPerWeek,
    medianAchievementRarity,
    daysToCompletion,
    remainingRarestUnlocks,
    playtimeTrend,
    standoutUnlock,
    screenshots: [...screenshots],
    ageBucket,
    releaseDate: ownedGame.releaseDate,
  };
}

function pickStandoutUnlock(
  unlocked: ReadonlyArray<{
    apiName: string;
    displayName: string;
    description: string;
    hidden: boolean;
    unlockedAt: string | null;
    globalPercent: number | null;
  }>,
  now: Date
): SteamStandoutUnlock | null {
  if (unlocked.length === 0) return null;

  // Two-tier selection. Tier 1: unlocks with a known global percentage.
  // Pick the rarest (lowest percent), with newer-first as tiebreak.
  // Tier 2 (no rarity data anywhere): pick the most recent unlock so the
  // chapter still has a receipt to render.
  const withRarity = unlocked.filter((a) => a.globalPercent !== null);
  const candidates = withRarity.length > 0 ? withRarity : [...unlocked];

  candidates.sort((a, b) => {
    if (withRarity.length > 0) {
      // Lower globalPercent = rarer; both are non-null here.
      const ap = a.globalPercent ?? Number.POSITIVE_INFINITY;
      const bp = b.globalPercent ?? Number.POSITIVE_INFINITY;
      if (ap !== bp) return ap - bp;
    }
    return (b.unlockedAt ?? "").localeCompare(a.unlockedAt ?? "");
  });

  const pick = candidates[0];
  if (!pick || !pick.unlockedAt) return null;

  const daysAgo = Math.floor(
    (now.getTime() - new Date(pick.unlockedAt).getTime()) / (1000 * 60 * 60 * 24)
  );

  return {
    apiName: pick.apiName,
    displayName: pick.displayName,
    description: pick.description,
    hidden: pick.hidden,
    unlockedAt: pick.unlockedAt,
    globalPercent: pick.globalPercent,
    daysAgo: Math.max(0, daysAgo),
  };
}

/**
 * Format the release-date chip for a Steam chapter. Pure helper so the same
 * register lands on both subject and moment chapters without rendering drift.
 *
 * Register table (matches the existing chapter vocabulary — "Released" prefix
 * mirrors "Cleared" / "Currently in" verdicts so the chip reads as honest
 * metadata, not marketing copy):
 *   0–6 days   → "Released this week"
 *   7–30 days  → "Released last month"
 *   31–365 d   → "Released {Mon YYYY}"  (e.g. "Released Apr 2025")
 *   ≥1 year    → "Released {YYYY}"      (e.g. "Released 2014")
 *   future     → null (pre-purchase / pre-order edge case — skip the chip
 *                rather than render a wrong-tense claim)
 *
 * Returns null when releaseDate is null so callers can render conditionally
 * without re-deriving the falsy check.
 */
export function formatReleaseDateChip(
  releaseDate: string | null,
  now: Date = new Date()
): string | null {
  if (!releaseDate) return null;
  const released = new Date(releaseDate);
  if (Number.isNaN(released.getTime())) return null;
  const days = Math.floor((now.getTime() - released.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 0) return null;
  if (days <= 6) return "Released this week";
  if (days <= 30) return "Released last month";
  if (days <= 365) {
    const month = released.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
    return `Released ${month} ${released.getUTCFullYear()}`;
  }
  return `Released ${released.getUTCFullYear()}`;
}

/**
 * Bucket an ISO timestamp into a Brussels-calendar-week anchor.
 *
 * Returns a UTC noon `Date` aligned to the Monday of the Brussels calendar
 * week the timestamp falls into. Monday-anchor matches the broader project
 * convention (`getDay()` remap to Mon=0..Sun=6 in `pregame-signals.ts` /
 * `match-stats.ts`) and ISO 8601.
 *
 * Why noon-UTC: the anchor is used as the comparison key in
 * `weeksBetween()`. Choosing noon (rather than midnight) puts the anchor
 * safely inside the calendar day regardless of DST transitions — Brussels
 * DST shifts happen at 02:00–03:00 local, so 12:00 UTC (= 13:00 or 14:00
 * Brussels) is always inside the same calendar day on both sides of a
 * transition. The day-arithmetic in `weeksBetween()` then collapses
 * cleanly because every Monday anchor sits exactly 7 × 86_400_000 ms from
 * the next.
 */
function brusselsWeekAnchor(date: Date): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Brussels",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const lookup = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";
  const year = Number(lookup("year"));
  const month = Number(lookup("month"));
  const day = Number(lookup("day"));
  const calendarNoon = new Date(Date.UTC(year, month - 1, day, 12));
  // getUTCDay: Sun=0..Sat=6 → remap to Mon=0..Sun=6 (project convention).
  const weekdayMonZero = (calendarNoon.getUTCDay() + 6) % 7;
  return new Date(calendarNoon.getTime() - weekdayMonZero * 86_400_000);
}

/** Whole weeks from `from` (inclusive) to `to` (inclusive), both Monday anchors. */
function weeksBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / (7 * 86_400_000));
}

/**
 * Build the per-week unlock-count series for the sparkline header band on
 * beat 1. Right-anchored at the current Brussels week, oldest-first.
 *
 * Window is adaptive: the series starts at the oldest in-window unlock's
 * week (at most `STEAM_RECAP_UNLOCKS_PER_WEEK_LIMIT - 1` weeks ago) and
 * ends at the current week. So a game with unlocks only in the last 3
 * weeks returns 3 entries; a game with sparse unlocks across the whole
 * 12-week horizon returns 12. A game with zero unlocks in the last 12
 * weeks (everything older) returns `[]` — the band gates on
 * `length >= 2` at the consumer, so an empty array hides it.
 *
 * Why right-anchored: the rightmost bar is always "this week", which
 * gives the reader a stable visual anchor across games. The leftmost
 * bar is "first week of relevant activity", which makes the visual
 * width itself meaningful — a wider sparkline reads as "they've been
 * at this longer" than a narrower one.
 */
function buildUnlocksPerWeek(
  unlocked: ReadonlyArray<{ unlockedAt: string | null }>,
  now: Date
): number[] {
  if (unlocked.length === 0) return [];

  const nowAnchor = brusselsWeekAnchor(now);
  const maxWeeksAgo = STEAM_RECAP_UNLOCKS_PER_WEEK_LIMIT - 1;

  // Aggregate counts keyed by `weeksAgo` (0 = this week, 1 = last week, …).
  const counts = new Map<number, number>();
  let oldestWeeksAgo = -1;
  for (const a of unlocked) {
    if (a.unlockedAt === null) continue;
    const ts = new Date(a.unlockedAt);
    if (Number.isNaN(ts.getTime())) continue;
    const weeksAgo = weeksBetween(brusselsWeekAnchor(ts), nowAnchor);
    if (weeksAgo < 0 || weeksAgo > maxWeeksAgo) continue;
    counts.set(weeksAgo, (counts.get(weeksAgo) ?? 0) + 1);
    if (weeksAgo > oldestWeeksAgo) oldestWeeksAgo = weeksAgo;
  }

  if (oldestWeeksAgo < 0) return [];

  // Oldest first → reverse `weeksAgo` from [oldestWeeksAgo .. 0].
  const series: number[] = [];
  for (let w = oldestWeeksAgo; w >= 0; w -= 1) {
    series.push(counts.get(w) ?? 0);
  }
  return series;
}

/**
 * Median `globalPercent` across the unlocked-with-rarity subset of
 * achievements. Two-element series returns the average (standard median
 * convention). Returns null when fewer than 1 unlocked achievement has
 * a known `globalPercent` — the beat-2 chip hides in that case rather
 * than showing a misleading single-data-point median.
 *
 * Why median rather than mean: rarity distributions are heavily skewed
 * — completionist players have most of their unlocks at the common end
 * (50–80% rarity), with a long tail of rare ones. Mean overweights the
 * tail and reads as "rarer than reality." Median reads as the
 * mid-distribution unlock and is the honest editorial summary.
 */
function computeMedianRarity(
  unlocked: ReadonlyArray<{ globalPercent: number | null }>
): number | null {
  const percents = unlocked
    .map((a) => a.globalPercent)
    .filter((p): p is number => p !== null);
  if (percents.length === 0) return null;
  percents.sort((a, b) => a - b);
  const mid = Math.floor(percents.length / 2);
  if (percents.length % 2 === 1) {
    return percents[mid] ?? null;
  }
  const a = percents[mid - 1];
  const b = percents[mid];
  return a !== undefined && b !== undefined ? (a + b) / 2 : null;
}

/**
 * Days from earliest unlock to latest unlock across the unlocked set.
 * Used for the beat-2 "cleared in N days" framing when the game is
 * 100%'d. Returns null when fewer than 2 unlocks have parseable
 * timestamps — a "0 days" or "1 day" framing on a half-clear is
 * editorial whiplash that misrepresents progress.
 */
function computeDaysToCompletion(
  unlocked: ReadonlyArray<{ unlockedAt: string | null }>
): number | null {
  const stamps = unlocked
    .map((a) => (a.unlockedAt ? new Date(a.unlockedAt).getTime() : Number.NaN))
    .filter((t) => Number.isFinite(t));
  if (stamps.length < 2) return null;
  const min = Math.min(...stamps);
  const max = Math.max(...stamps);
  return Math.max(0, Math.floor((max - min) / (1000 * 60 * 60 * 24)));
}

/**
 * Top `STEAM_RECAP_REMAINING_LIMIT` LOCKED achievements ordered by
 * rarest-first (lowest `globalPercent`). Used for the beat-2
 * achievements-remaining ladder on games that aren't yet 100%'d. Skips
 * locked achievements without rarity data — they can't be ranked, and
 * a "???" ladder reads as filler rather than editorial content.
 */
function pickRemainingRarest(
  schema: ReadonlyArray<{
    apiName: string;
    displayName: string;
    description: string;
    hidden: boolean;
    unlockedAt: string | null;
    globalPercent: number | null;
  }>
): SteamUnlock[] {
  return schema
    .filter((a) => a.unlockedAt === null && a.globalPercent !== null)
    .sort(
      (a, b) =>
        (a.globalPercent ?? Number.POSITIVE_INFINITY) -
        (b.globalPercent ?? Number.POSITIVE_INFINITY)
    )
    .slice(0, STEAM_RECAP_REMAINING_LIMIT)
    .map((a) => ({
      apiName: a.apiName,
      displayName: a.displayName,
      description: a.description,
      hidden: a.hidden,
      // Locked achievements have no unlock timestamp; expose empty string
      // so the consumer can treat absence with the same "no date" check
      // as elsewhere. SteamUnlock requires a string here for shape
      // consistency with the existing recent-unlocks contract.
      unlockedAt: "",
      globalPercent: a.globalPercent,
    }));
}

/**
 * Playtime trend bucket from the trailing-30-day snapshot array. Returns
 * null when the array is empty (no recent activity data at all).
 *
 * Order of checks matters: a spike implies active engagement, so we
 * test for spike before active. Dormant is the catch-all when total
 * recent playtime is below the active threshold.
 */
function computePlaytimeTrend(
  recentMinutes: readonly number[]
): SteamPlaytimeTrend | null {
  if (recentMinutes.length === 0) return null;
  const total = recentMinutes.reduce((sum, m) => sum + m, 0);
  // Need at least a 7-day tail to compute a spike; degrade gracefully on
  // short arrays.
  if (recentMinutes.length >= 7) {
    const last7 = recentMinutes.slice(-7).reduce((sum, m) => sum + m, 0);
    const priorDays = recentMinutes.length - 7;
    const prior = recentMinutes.slice(0, priorDays).reduce((sum, m) => sum + m, 0);
    const priorDailyAvg = priorDays > 0 ? prior / priorDays : 0;
    const last7DailyAvg = last7 / 7;
    if (priorDailyAvg > 0 && last7DailyAvg >= priorDailyAvg * TREND_SPIKE_MULTIPLIER) {
      return "spike";
    }
    // Fresh-game case: no prior history, but the last 7 days have real
    // playtime — read as a spike rather than steady-active. Editorial
    // framing for "first weekend of a new title."
    if (priorDailyAvg === 0 && last7 >= TREND_ACTIVE_MIN_MINUTES) {
      return "spike";
    }
  }
  return total >= TREND_ACTIVE_MIN_MINUTES ? "active" : "dormant";
}

function ageBucketFor(lastPlayedAt: string | null, now: Date): SteamAgeBucket | null {
  if (!lastPlayedAt) return null;
  const days = Math.floor(
    (now.getTime() - new Date(lastPlayedAt).getTime()) / (1000 * 60 * 60 * 24)
  );
  if (days < 0) return "current";
  if (days <= 7) return "current";
  if (days <= 30) return "recent";
  if (days <= DORMANT_THRESHOLD_DAYS) return "season";
  return "year";
}

/**
 * Tag for the primary verdict so the context clause can avoid double-counting
 * a signal that's already been used as an adjective.
 */
type PrimaryVerdict = "current" | "completionist" | "engrossed" | "dormant" | "dabbling";

function pickPrimaryVerdict(recap: SteamGameRecap): PrimaryVerdict {
  const { playtime2WeeksMinutes, playtimeForeverMinutes, completionPct, ageBucket } =
    recap;
  if (completionPct !== null && completionPct >= COMPLETIONIST_THRESHOLD)
    return "completionist";
  if ((playtime2WeeksMinutes ?? 0) >= CURRENT_THRESHOLD_MIN) return "current";
  if (ageBucket === "year") return "dormant";
  if (playtimeForeverMinutes >= ENGROSSED_THRESHOLD_MIN) return "engrossed";
  return "dabbling";
}

const VERDICT_LABEL: Record<PrimaryVerdict, string> = {
  current: "Currently in",
  completionist: "Cleared",
  engrossed: "Engrossed",
  dormant: "Dormant",
  dabbling: "Sampled",
};

/**
 * Compose the verdict paragraph from a Steam recap. Mirrors
 * `verdictParagraph` from champion-recap (same `VerdictClause[]` contract)
 * so the chapter can reuse `VerdictProse` without a parallel renderer.
 *
 * Selection rules:
 *  - Clause 1 (verdict): 1–2 adjectives picked from signal strength.
 *  - Clause 2 (volume):  always "{Game} has {N}h logged; {Z}% achievements
 *                        unlocked." (achievement half is omitted when the
 *                        game has no schema).
 *  - Clause 3 (receipt): the standout unlock, framed as "Rarest milestone
 *                        so far: {name} ({R}% of players)."
 *  - Clause 4 (context): completion-near-end / dormancy / recent activity
 *                        — whichever is strongest, never repeating clause 1.
 */
export function verdictParagraphSteam(recap: SteamGameRecap): VerdictClause[] {
  if (recap.playtimeForeverMinutes === 0 && recap.achievementsUnlocked === 0) {
    return [
      [
        { kind: "text", value: "No tracked " },
        { kind: "subject", value: recap.name || "this game" },
        { kind: "text", value: " activity yet." },
      ],
    ];
  }

  const primary = pickPrimaryVerdict(recap);
  const clauses: VerdictClause[] = [];

  clauses.push(verdictAdjectives(recap, primary));
  clauses.push(volumeClause(recap));

  const receipt = receiptClause(recap);
  if (receipt) clauses.push(receipt);

  const context = contextClause(recap, primary);
  if (context) clauses.push(context);

  return clauses;
}

function verdictAdjectives(
  recap: SteamGameRecap,
  primary: PrimaryVerdict
): VerdictClause {
  const adjectives: string[] = [VERDICT_LABEL[primary]];

  // Secondary axis — only "with history" survives as a non-overlapping
  // refinement. Activity-trajectory and completion-proximity adjectives
  // would double-count signals the context clause already handles ("N
  // achievement left", "Picked back up — Nh in the last two weeks").
  if (primary === "dormant" && recap.playtimeForeverMinutes >= 1200) {
    // Soften the dormant verdict for games the owner sank real time into —
    // it's history, not a failed attempt.
    adjectives.push("with history");
  }

  const head = adjectives[0];
  const tail = adjectives[1];
  if (!head) return [{ kind: "text", value: "" }];
  if (!tail) {
    return [
      { kind: "emphasis", value: head },
      { kind: "text", value: "." },
    ];
  }
  return [
    { kind: "emphasis", value: head },
    { kind: "text", value: ", " },
    { kind: "emphasis", value: tail },
    { kind: "text", value: "." },
  ];
}

function volumeClause(recap: SteamGameRecap): VerdictClause {
  const hours = Math.round(recap.playtimeForeverMinutes / 60);
  const clause: VerdictClause = [
    { kind: "subject", value: recap.name || "This title" },
    { kind: "text", value: " has " },
    {
      kind: "number",
      value: `${hours}h`,
      raw: hours,
    },
    { kind: "text", value: " logged" },
  ];

  // Only join the achievement half when the schema exists AND there's
  // something unlocked — otherwise the sentence reads as "0% done" which is
  // a weaker editorial beat than just letting the playtime stand alone.
  if (
    recap.completionPct !== null &&
    recap.completionPct > 0 &&
    recap.achievementsTotal !== null
  ) {
    const pct = Math.round(recap.completionPct * 100);
    clause.push(
      { kind: "text", value: "; " },
      { kind: "number", value: `${pct}%`, raw: pct },
      { kind: "text", value: " achievements unlocked." }
    );
  } else {
    clause.push({ kind: "text", value: "." });
  }

  return clause;
}

function receiptClause(recap: SteamGameRecap): VerdictClause | null {
  const standout = recap.standoutUnlock;
  if (!standout) return null;
  // Only frame the standout as "rarest" when we actually have rarity data
  // AND the unlock is genuinely rare. A 73%-globally-unlocked achievement
  // labeled "rarest" reads as overclaiming; fall back to "milestone".
  const hasRarity = standout.globalPercent !== null;
  const isRare =
    hasRarity && (standout.globalPercent as number) <= RARE_UNLOCK_PERCENT_CEILING;

  if (isRare) {
    const pct = standout.globalPercent as number;
    // Single-digit rarities keep one decimal — "1.8% of players" carries the
    // editorial weight rounding to "2%" would erase. Double-digit rarities
    // round to integers (no point claiming "12.4%" when "12%" reads cleaner).
    const pctRounded = pct < 10 ? pct.toFixed(1) : String(Math.round(pct));
    return [
      { kind: "text", value: "Rarest milestone so far: " },
      { kind: "emphasis", value: standout.displayName },
      { kind: "text", value: " — only " },
      { kind: "number", value: `${pctRounded}%`, raw: Number(pctRounded) },
      { kind: "text", value: " of players have it." },
    ];
  }

  return [
    { kind: "text", value: "Latest milestone: " },
    { kind: "emphasis", value: standout.displayName },
    { kind: "text", value: "." },
  ];
}

function contextClause(
  recap: SteamGameRecap,
  primary: PrimaryVerdict
): VerdictClause | null {
  const {
    completionPct,
    achievementsTotal,
    achievementsUnlocked,
    playtime2WeeksMinutes,
    lastPlayedAt,
  } = recap;

  // Near-completion is the strongest signal — narrate it explicitly when the
  // primary verdict didn't already cover it.
  if (
    primary !== "completionist" &&
    completionPct !== null &&
    completionPct >= 0.9 &&
    achievementsTotal !== null
  ) {
    const remaining = achievementsTotal - achievementsUnlocked;
    if (remaining > 0) {
      return [
        { kind: "number", value: String(remaining), raw: remaining },
        {
          kind: "text",
          value: remaining === 1 ? " achievement left." : " achievements left.",
        },
      ];
    }
  }

  // 2-week ramp — meaningful only when we're not already calling it current.
  if (primary !== "current" && (playtime2WeeksMinutes ?? 0) >= 120) {
    const hours = Math.round((playtime2WeeksMinutes ?? 0) / 60);
    return [
      { kind: "text", value: "Picked back up — " },
      { kind: "number", value: `${hours}h`, raw: hours },
      { kind: "text", value: " in the last two weeks." },
    ];
  }

  // Quiet stretch — only when we have a timestamp and the primary verdict
  // didn't already call it dormant.
  if (primary !== "dormant" && lastPlayedAt) {
    const days = Math.floor(
      (Date.now() - new Date(lastPlayedAt).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (days >= 30) {
      return [
        { kind: "text", value: "Quiet for " },
        { kind: "number", value: String(days), raw: days },
        { kind: "text", value: " days." },
      ];
    }
  }

  return null;
}
