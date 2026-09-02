// Launch-window rarity drift — the maths behind the `LAUNCH_RARITY_DRIFT`
// Steam moment chapter. A game bought at release has global unlock rates that
// climb steeply for weeks as the rest of the player base finishes it, so an
// achievement the owner earned on day one reads as far rarer at the moment
// they earned it than it does today. Settled titles do not move like this and
// are deliberately out of scope (docs/working-notes/steam/achievement-rarity-drift.md).
//
// Pure: the api detector queries the rows and calls in here, the same split as
// `deriveSteamGameRecap`.

import type {
  SteamLaunchDriftStats,
  SteamLaunchDriftUnlock,
} from "../home/recap-chapter.ts";

/**
 * A rarity reading only counts as "what it was when you earned it" if it was
 * taken this recently before the unlock. Anything older and the copy would
 * claim a precision the sampling never had.
 */
export const LAUNCH_DRIFT_SAMPLE_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;
/** Ten of Steam's one-decimal quanta, so no receipt row is rounding. */
export const LAUNCH_DRIFT_MIN_DELTA_PP = 1.0;
/** Fewer qualifying rows than this and there is no story, only a number. */
export const LAUNCH_DRIFT_MIN_RECEIPT_ROWS = 3;
export const LAUNCH_DRIFT_RECEIPT_CAP = 5;
export const LAUNCH_DRIFT_DELTA_CAP_PP = 30;
/**
 * Chosen so a capped beat scores `30 × 4/3 = 40` — the same ceiling as a
 * capped achievement cluster (`CLUSTER_UNLOCK_CAP × CLUSTER_SIGNAL_FACTOR`).
 * The two moment types share a decay and a floor, and a launch title the owner
 * binged produces both, so they get compared by score whenever they collide on
 * one appid. That comparison is only meaningful if the scales agree: at any
 * lower factor the drift beat loses to every qualifying cluster by arithmetic
 * rather than by being the weaker story.
 */
export const LAUNCH_DRIFT_SIGNAL_FACTOR = 4 / 3;
/**
 * Denominator floor for the relative ranking. Steam reports a literal `0` for
 * any share below its one-decimal resolution, so the raw value would divide by
 * zero; this bound turns it into a lower bound on the ratio instead, and is
 * the same sub-resolution bound the rarity formatter renders as `<0.1%`.
 */
export const LAUNCH_DRIFT_FLOOR_PERCENT = 0.05;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface LaunchDriftObservation {
  apiName: string;
  percent: number;
  observedAt: Date;
}

export interface LaunchDriftUnlockRow {
  apiName: string;
  displayName: string;
  unlockedAt: Date;
  /** Null while the rarity poll has not covered the achievement yet. */
  percentNow: number | null;
}

export interface LaunchDriftInput {
  releaseDate: Date;
  /** Ascending `observedAt`, every achievement of the game in one list. */
  observations: readonly LaunchDriftObservation[];
  unlocks: readonly LaunchDriftUnlockRow[];
}

/**
 * Quantised to Steam's own one decimal, for the same reason the rarity poller
 * rounds before its "did it move" test: Steam publishes one decimal but
 * serialises it through a float32, so a stored value is 47.900001525878906
 * rather than 47.9. Subtracting the raw pair puts roughly one move in seventy
 * just under the threshold (4.1 − 3.1 = 0.9999999999999996) and would drop a
 * genuine 1.0pp row.
 */
function deltaPp(unlock: SteamLaunchDriftUnlock): number {
  return Math.round((unlock.percentNow - unlock.percentAtUnlock) * 10) / 10;
}

function relativeGain(unlock: SteamLaunchDriftUnlock): number {
  return unlock.percentNow / Math.max(unlock.percentAtUnlock, LAUNCH_DRIFT_FLOOR_PERCENT);
}

/** Latest reading at or before `at` in an ascending series, or null. */
function sampleBefore(
  series: readonly LaunchDriftObservation[],
  at: Date
): LaunchDriftObservation | null {
  let found: LaunchDriftObservation | null = null;
  for (const observation of series) {
    if (observation.observedAt.getTime() > at.getTime()) break;
    found = observation;
  }
  return found;
}

/**
 * Pure deriver — the receipt for one game, or null when the game has no story
 * to tell. Null covers every disqualifying shape (no history, no unlock
 * bracketed by a fresh enough sample, too few rows that actually moved), so
 * the caller never has to reason about which of them applied.
 */
export function deriveLaunchDrift(input: LaunchDriftInput): SteamLaunchDriftStats | null {
  const { observations, unlocks } = input;
  if (observations.length === 0) return null;

  const seriesByAchievement = new Map<string, LaunchDriftObservation[]>();
  for (const observation of observations) {
    const series = seriesByAchievement.get(observation.apiName);
    if (series) series.push(observation);
    else seriesByAchievement.set(observation.apiName, [observation]);
  }

  const bracketed: SteamLaunchDriftUnlock[] = [];
  for (const unlock of unlocks) {
    if (unlock.percentNow === null) continue;
    const series = seriesByAchievement.get(unlock.apiName);
    if (!series) continue;
    const sample = sampleBefore(series, unlock.unlockedAt);
    if (!sample) continue;
    if (
      unlock.unlockedAt.getTime() - sample.observedAt.getTime() >
      LAUNCH_DRIFT_SAMPLE_MAX_AGE_MS
    ) {
      continue;
    }
    bracketed.push({
      apiName: unlock.apiName,
      displayName: unlock.displayName,
      unlockedAt: unlock.unlockedAt.toISOString(),
      percentAtUnlock: sample.percent,
      percentNow: unlock.percentNow,
    });
  }

  const moved = bracketed.filter(
    (unlock) => deltaPp(unlock) >= LAUNCH_DRIFT_MIN_DELTA_PP
  );
  if (moved.length < LAUNCH_DRIFT_MIN_RECEIPT_ROWS) return null;

  // Relative gain is the story ("thirty times rarer when you got it"); the
  // absolute delta only breaks ties, so a 0 → 5.0 row outranks 10.0 → 40.0.
  moved.sort((a, b) => relativeGain(b) - relativeGain(a) || deltaPp(b) - deltaPp(a));

  const headline = moved[0];
  if (!headline) return null;
  const receipt = moved.slice(0, LAUNCH_DRIFT_RECEIPT_CAP);
  const curve = (seriesByAchievement.get(headline.apiName) ?? []).map((o) => o.percent);
  // Unreachable after the bracketing step, but it keeps `<Sparkline>`'s own
  // two-point guard from ever being the thing that silently hides a beat.
  if (curve.length < 2) return null;

  // Bounds come off the distinct-timestamp set rather than the ends of the
  // list, so a caller whose ordering slipped gets a correct span instead of
  // an inverted one.
  const stamps = [...new Set(observations.map((o) => o.observedAt.getTime()))];

  return {
    releaseDate: input.releaseDate.toISOString().slice(0, 10),
    observedFrom: new Date(Math.min(...stamps)).toISOString(),
    observedTo: new Date(Math.max(...stamps)).toISOString(),
    observationCount: stamps.length,
    bracketedUnlockCount: bracketed.length,
    headline,
    curve,
    receipt,
  };
}

/**
 * Recency-independent signal: the headline's absolute gain, capped so a
 * runaway launch curve cannot outrank everything else on the page forever.
 * At the cap a fresh beat scores 40 and decays past the floor after about six
 * weeks without a new unlock.
 */
export function launchDriftBaseSignal(stats: SteamLaunchDriftStats): number {
  const delta = deltaPp(stats.headline);
  return Math.min(delta, LAUNCH_DRIFT_DELTA_CAP_PP) * LAUNCH_DRIFT_SIGNAL_FACTOR;
}

/**
 * Days since the freshest unlock in the receipt — the same "newest owner
 * signal" anchor every other detector uses, and what the chapter's when-line
 * means to a reader. Not days since release, and not since the last poll.
 */
export function launchDriftDaysSince(stats: SteamLaunchDriftStats, now: Date): number {
  const newest = Math.max(...stats.receipt.map((r) => Date.parse(r.unlockedAt)));
  return Math.max(0, Math.floor((now.getTime() - newest) / DAY_MS));
}
