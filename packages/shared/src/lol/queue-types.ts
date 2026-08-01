// Canonical Riot Match-V5 queueId → human label. The labels used here are
// the "compact" form ("Ranked Solo", not "Ranked Solo/Duo") because they
// appear in match history rows, queue filters, and analytics rollups where
// vertical density matters. The live-game spectator surface uses
// `queueLabelExpanded()` to read "Ranked Solo/Duo" instead — see the
// repo-conventions audit doc for the rationale.
//
// Labels need not be unique — the id is the identity, and a family that plays
// as one mode reads as one name (every Swarm lobby size is "Swarm"). Names are
// taken from CommunityDragon's queue catalogue, which carries live queues that
// Riot's static `queues.json` has not documented; 710 is one of them.
export const QUEUE_TYPES: Record<number, string> = {
  0: "Custom",
  400: "Normal Draft",
  420: "Ranked Solo",
  430: "Normal Blind",
  440: "Ranked Flex",
  450: "ARAM",
  480: "Swiftplay",
  490: "Quickplay",
  700: "Clash",
  710: "Ranked 5s",
  720: "ARAM Clash",
  830: "Co-op vs AI Intro",
  840: "Co-op vs AI Beginner",
  850: "Co-op vs AI Intermediate",
  870: "Co-op vs AI Intro",
  880: "Co-op vs AI Beginner",
  890: "Co-op vs AI Intermediate",
  900: "URF",
  1020: "One for All",
  1300: "Nexus Blitz",
  1400: "Ultimate Spellbook",
  1700: "Arena",
  1710: "Arena",
  1810: "Swarm",
  1820: "Swarm",
  1830: "Swarm",
  1840: "Swarm",
  1900: "URF",
  2300: "Brawl",
  2301: "Brawl",
  2302: "Brawl",
  2303: "Brawl",
  2304: "Brawl",
  2305: "Brawl",
  2400: "ARAM: Mayhem",
  2401: "ARAM: Mayhem",
  2403: "ARAM: Mayhem",
  2405: "ARAM: Mayhem",
  2410: "ARAM: Mayhem",
  2450: "ARAM: Mayhem",
  3100: "Custom",
  3130: "Tournament Draft",
  3240: "ARAM: Mayhem",
  3270: "ARAM: Mayhem",
  3280: "ARAM: Mayhem",
};

export function queueLabel(queueId: number): string {
  return QUEUE_TYPES[queueId] ?? `Queue ${queueId}`;
}

// Wider-vocabulary variant used by the live-game spectator surface, where
// "Ranked Solo/Duo" is the conversational label League players recognise and
// there is room for it. Diverges from the compact canonical label on purpose.
export function queueLabelExpanded(queueId: number): string {
  if (queueId === 420) return "Ranked Solo/Duo";
  return queueLabel(queueId);
}

// Maps Riot's numeric Match-V5 queueId to the League-V4 queueType string
// used in RankSnapshot rows — bridges the two API representations.
//
// 710 is on Riot's legacy `RANKED_PREMADE_5x5` string, which League-V4 returns
// alongside solo and flex for accounts that have played it. Verified against
// live data 2026-08-01; it is absent from Riot's static queue docs, so the
// pairing is only observable from an entries/by-puuid response.
export const RANKED_QUEUE_MAP: Record<number, string> = {
  420: "RANKED_SOLO_5x5",
  440: "RANKED_FLEX_SR",
  710: "RANKED_PREMADE_5x5",
};

// "Which queues carry LP" as Match.queueId values. Derived from the map above
// rather than restated so the two cannot drift apart, and used wherever a
// query needs to mean ranked-only.
export const RANKED_QUEUE_IDS: readonly number[] =
  Object.keys(RANKED_QUEUE_MAP).map(Number);

// Queue families, keyed on id. These used to be Sets of labels living in three
// separate web components. Asking the label meant a queue that shares a label
// with another was covered by accident rather than on purpose — "Arena" caught
// both 1700 and 1710 for free, so listing both here is what preserves the
// behaviour, not what changes it.

/** Queues with no laned Summoner's Rift phase. Gates the lane-opponent chip
 *  and the map overlay: there is no lane to have an opponent in. */
export const NON_LANED_QUEUE_IDS: ReadonlySet<number> = new Set([
  450, // ARAM
  720, // ARAM Clash
  1700, // Arena
  1710, // Arena
  2300, // Brawl
  2301,
  2302,
  2303,
  2304,
  2305,
  2400, // ARAM: Mayhem
  2401,
  2403,
  2405,
  2410,
  2450,
  3240,
  3270,
  3280,
]);

/** Summoner's Rift queues where the lane-phase review reads meaningfully.
 *  Excludes co-op-vs-AI (830-890) on purpose: same map, but a bot lane makes
 *  the differential meaningless. */
export const SR_LANE_QUEUE_IDS: ReadonlySet<number> = new Set([
  400, // Normal Draft
  420, // Ranked Solo
  430, // Normal Blind
  440, // Ranked Flex
  480, // Swiftplay
  490, // Quickplay
  700, // Clash
  710, // Ranked 5s
]);

// Compact discriminator used by ranked-only UIs (LP history, season history,
// hero rank strip) to pick between the ladders. Pairs with the maps below so a
// single key value drives label, queueId, queueType, and accent colour
// consistently across surfaces — a new ladder is an entry here, never a new
// condition at a call site.
//
// Order is the display preference: surfaces that must choose one queue take the
// first available, and `pickHigherRank` folds in this order so an identical-LP
// tie resolves to the earlier key.
export type RankedQueueKey = "solo" | "flex" | "premade";

export const RANKED_QUEUE_KEYS: readonly RankedQueueKey[] = ["solo", "flex", "premade"];

export const RANKED_QUEUE_KEY_TO_ID: Record<RankedQueueKey, number> = {
  solo: 420,
  flex: 440,
  premade: 710,
};

export const RANKED_QUEUE_KEY_TO_TYPE: Record<RankedQueueKey, string> = {
  solo: "RANKED_SOLO_5x5",
  flex: "RANKED_FLEX_SR",
  premade: "RANKED_PREMADE_5x5",
};

// The inverse, for reading a League-V4 row back into a key. Derived rather than
// restated so the two directions cannot disagree, and it doubles as the "do we
// track this ladder" test: League-V4 returns every ladder an account has played
// (RANKED_TFT, arena queues), and an unknown string yields `undefined` here.
export const RANKED_QUEUE_TYPE_TO_KEY: Record<string, RankedQueueKey> =
  Object.fromEntries(
    RANKED_QUEUE_KEYS.map((key) => [RANKED_QUEUE_KEY_TO_TYPE[key], key])
  );

// Shortest readable label — used in the segmented "Solo/Duo | Flex | 5s" toggle
// where the surrounding chrome already implies "ranked queue."
export const RANKED_QUEUE_KEY_LABEL: Record<RankedQueueKey, string> = {
  solo: "Solo/Duo",
  flex: "Flex",
  premade: "5s",
};
