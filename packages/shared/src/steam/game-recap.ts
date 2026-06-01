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
      standoutUnlock: null,
      screenshots: [...screenshots],
      ageBucket: null,
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

  const lastPlayedAt = ownedGame.rtimeLastPlayedAt;
  const ageBucket = ageBucketFor(lastPlayedAt, now);

  return {
    appid,
    name: ownedGame.name,
    assetTimestamp: ownedGame.assetTimestamp,
    hasLibraryHero: ownedGame.libraryHeroPath !== null,
    flipHero: ownedGame.flipHero,
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
    standoutUnlock,
    screenshots: [...screenshots],
    ageBucket,
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
