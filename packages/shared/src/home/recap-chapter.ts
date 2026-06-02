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
