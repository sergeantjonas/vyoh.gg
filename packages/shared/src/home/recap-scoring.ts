// Pure scoring + selection for the landing-page recap chapter stream.
// Picks Steam subjects in R-4a; the same selector accepts LoL-moment and
// Steam-moment candidates in R-6/R-7 without contract churn.
//
// Per the arc note:
//   score = base_signal × 0.5 ^ (daysSince / HALF_LIFE_DAYS)
// HALF_LIFE_DAYS = 14 means a candidate at 14 days carries half the weight
// of a candidate today; at 28 days, a quarter. The selector ranks within
// each kind (subject vs moment), then concatenates the kept-per-kind lists
// in a fixed order: LoL moments → Steam subjects → Steam moments. That
// platform-clusters the page (one LoL block right after the Ahri anchor,
// then one Steam block), so the reader makes a single platform jump
// instead of bouncing Steam → LoL → Steam. The Ahri chapter sits above
// this list as a structural anchor, hardcoded in `routes/index.tsx`.

import { ageBucketFromDaysSince } from "./age-bucket.ts";
import type {
  LolFavoriteChampionStats,
  LolHiatusReturnStats,
  LolKdaOutlierStats,
  LolLifetimePeakStats,
  LolMarathonStats,
  LolMomentChapterDescriptor,
  LolMomentMatchStats,
  LolRankUpDelta,
  LolStreakStats,
  RecapChapterDescriptor,
  RecapChapterFraming,
  SteamAchievementClusterStats,
  SteamFirstTimeStats,
  SteamLaunchDriftStats,
  SteamMomentChapterDescriptor,
} from "./recap-chapter.ts";

/** Recency half-life for the exp-decay weight. Calibrated to the arc note —
 *  a 14d window means anything inside the chronotype "this season" bucket
 *  still has measurable lift, but a 90d-old subject sinks below the floor
 *  even with strong base signal. */
export const RECAP_HALF_LIFE_DAYS = 14;

/** Minimum score for any chapter to qualify. Floor is conservative on
 *  purpose — the landing should never render a thin chapter just to fill
 *  rows. Tuned to the arc note; bump in landing-config once we have a few
 *  weeks of real selection signal to look at. */
export const RECAP_SCORE_FLOOR = 5;

/** Default visibility boost applied to off-meta moments so an unusual pick
 *  isn't drowned by mainline activity even when its raw signal is small.
 *  Applied as a multiplier on `score`, not on `baseSignal`. */
export const RECAP_OFF_META_BOOST = 1.5;

export interface RecapSelectionOptions {
  steamSubjectCap?: number;
  lolMomentCap?: number;
  steamMomentCap?: number;
  /** Multiplier applied to candidates flagged `offMeta: true`. */
  offMetaBoost?: number;
  /** Hard score floor — candidates below this are dropped regardless of cap. */
  floor?: number;
}

const DEFAULT_OPTIONS: Required<RecapSelectionOptions> = {
  steamSubjectCap: 5,
  lolMomentCap: 5,
  steamMomentCap: 3,
  offMetaBoost: RECAP_OFF_META_BOOST,
  floor: RECAP_SCORE_FLOOR,
};

/**
 * Compute the recency-decayed score for a single candidate. Pulled out as a
 * standalone helper so the API service can ship the same number it ranked
 * with back to the client — useful for the `useChapters()` debug surface
 * and for the curator's "why is this chapter here" question.
 *
 * Inputs:
 *   baseSignal — domain-specific aggregate (Steam: playtime hours + ach × 0.5;
 *                LoL: event magnitude; Steam moment: cluster size).
 *   daysSince  — integer days since the candidate's freshest signal.
 *
 * The decay treats `daysSince <= 0` as "today" (score = baseSignal) — clock
 * skew shouldn't *boost* a score above baseline.
 */
export function recapScore(baseSignal: number, daysSince: number): number {
  if (!Number.isFinite(baseSignal) || !Number.isFinite(daysSince)) {
    throw new Error(
      `recapScore: non-finite input (baseSignal=${baseSignal}, daysSince=${daysSince})`
    );
  }
  const effectiveDays = Math.max(0, daysSince);
  return baseSignal * 2 ** (-effectiveDays / RECAP_HALF_LIFE_DAYS);
}

/** Discriminated candidate shape carrying enough metadata for the selector
 *  to assemble the final descriptor without a per-kind branch in the API
 *  service. `baseSignal` and `daysSince` stay raw so the selector can apply
 *  off-meta boost, floor, and cap uniformly. */
export type RecapCandidate =
  | {
      kind: "steam-subject";
      slug: string;
      appid: number;
      name: string;
      baseSignal: number;
      daysSince: number;
      offMeta?: boolean;
      framing?: RecapChapterFraming | null;
    }
  | {
      kind: "lol-moment";
      slug: string;
      momentType: LolMomentChapterDescriptor["momentType"];
      baseSignal: number;
      daysSince: number;
      matchId?: string | null;
      championAlias?: string | null;
      matchStats?: LolMomentMatchStats | null;
      rankUp?: LolRankUpDelta | null;
      kdaOutlier?: LolKdaOutlierStats | null;
      hiatusReturn?: LolHiatusReturnStats | null;
      streak?: LolStreakStats | null;
      marathon?: LolMarathonStats | null;
      favoriteChampion?: LolFavoriteChampionStats | null;
      lifetimePeak?: LolLifetimePeakStats | null;
      offMeta?: boolean;
      framing?: RecapChapterFraming | null;
    }
  | {
      kind: "steam-moment";
      slug: string;
      momentType: SteamMomentChapterDescriptor["momentType"];
      appid: number;
      name: string;
      baseSignal: number;
      daysSince: number;
      firstTime?: SteamFirstTimeStats | null;
      cluster?: SteamAchievementClusterStats | null;
      launchDrift?: SteamLaunchDriftStats | null;
      offMeta?: boolean;
      framing?: RecapChapterFraming | null;
    };

interface ScoredCandidate {
  candidate: RecapCandidate;
  score: number;
}

function scoreCandidate(c: RecapCandidate, offMetaBoost: number): ScoredCandidate {
  const raw = recapScore(c.baseSignal, c.daysSince);
  const score = c.offMeta ? raw * offMetaBoost : raw;
  return { candidate: c, score };
}

function toDescriptor({ candidate, score }: ScoredCandidate): RecapChapterDescriptor {
  const ageBucket = ageBucketFromDaysSince(Math.max(0, candidate.daysSince));
  const framing = candidate.framing ?? null;
  if (candidate.kind === "steam-subject") {
    return {
      kind: "steam-subject",
      slug: candidate.slug,
      appid: candidate.appid,
      name: candidate.name,
      score,
      daysSince: candidate.daysSince,
      ageBucket,
      framing,
    };
  }
  if (candidate.kind === "lol-moment") {
    return {
      kind: "lol-moment",
      slug: candidate.slug,
      momentType: candidate.momentType,
      score,
      daysSince: candidate.daysSince,
      ageBucket,
      matchId: candidate.matchId ?? null,
      championAlias: candidate.championAlias ?? null,
      matchStats: candidate.matchStats ?? null,
      rankUp: candidate.rankUp ?? null,
      kdaOutlier: candidate.kdaOutlier ?? null,
      hiatusReturn: candidate.hiatusReturn ?? null,
      streak: candidate.streak ?? null,
      marathon: candidate.marathon ?? null,
      favoriteChampion: candidate.favoriteChampion ?? null,
      lifetimePeak: candidate.lifetimePeak ?? null,
      framing,
    };
  }
  return {
    kind: "steam-moment",
    slug: candidate.slug,
    momentType: candidate.momentType,
    score,
    daysSince: candidate.daysSince,
    ageBucket,
    appid: candidate.appid,
    name: candidate.name,
    firstTime: candidate.firstTime ?? null,
    cluster: candidate.cluster ?? null,
    launchDrift: candidate.launchDrift ?? null,
    framing,
  };
}

/**
 * Score, floor, cap, and assemble the recap chapter list. Stable ordering
 * within a kind: descending score, then ascending daysSince as a tiebreak
 * (a fresher candidate wins when two scores collide — happens with the
 * decay math more than you'd guess at small baseSignal). Cross-kind order
 * is fixed: lol-moment → steam-subject → steam-moment. That sequences the
 * page as Ahri-anchor → LoL moments → Steam subjects → Steam moments —
 * one platform block per kind, so the reader makes a single LoL→Steam
 * transition instead of bouncing back and forth.
 */
export function selectChapters(
  candidates: RecapCandidate[],
  options: RecapSelectionOptions = {}
): RecapChapterDescriptor[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const scored = candidates
    .map((c) => scoreCandidate(c, opts.offMetaBoost))
    .filter((s) => s.score >= opts.floor)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.candidate.daysSince - b.candidate.daysSince;
    });

  const keep = (kind: RecapCandidate["kind"], cap: number) =>
    scored.filter((s) => s.candidate.kind === kind).slice(0, cap);

  return [
    ...keep("lol-moment", opts.lolMomentCap),
    ...keep("steam-subject", opts.steamSubjectCap),
    ...keep("steam-moment", opts.steamMomentCap),
  ].map(toDescriptor);
}
