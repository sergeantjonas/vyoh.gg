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
export const RANKED_QUEUE_MAP: Record<number, string> = {
  420: "RANKED_SOLO_5x5",
  440: "RANKED_FLEX_SR",
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
// hero rank strip) that need to pick between exactly two queues. Pairs with
// the four maps below so a single key value drives label, queueId, queueType,
// and accent colour consistently across surfaces.
export type RankedQueueKey = "solo" | "flex";

export const RANKED_QUEUE_KEYS: readonly RankedQueueKey[] = ["solo", "flex"];

export const RANKED_QUEUE_KEY_TO_ID: Record<RankedQueueKey, number> = {
  solo: 420,
  flex: 440,
};

export const RANKED_QUEUE_KEY_TO_TYPE: Record<RankedQueueKey, string> = {
  solo: "RANKED_SOLO_5x5",
  flex: "RANKED_FLEX_SR",
};

// Shortest readable label — used in the segmented "Solo/Duo | Flex" toggle
// where the surrounding chrome already implies "ranked queue."
export const RANKED_QUEUE_KEY_LABEL: Record<RankedQueueKey, string> = {
  solo: "Solo/Duo",
  flex: "Flex",
};
