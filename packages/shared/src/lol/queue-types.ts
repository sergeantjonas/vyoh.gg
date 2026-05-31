// Canonical Riot Match-V5 queueId → human label. The labels used here are
// the "compact" form ("Ranked Solo", not "Ranked Solo/Duo") because they
// appear in match history rows, queue filters, and analytics rollups where
// vertical density matters. The live-game spectator surface uses
// `queueLabelExpanded()` to read "Ranked Solo/Duo" instead — see the
// repo-conventions audit doc for the rationale.
export const QUEUE_TYPES: Record<number, string> = {
  400: "Normal Draft",
  420: "Ranked Solo",
  430: "Normal Blind",
  440: "Ranked Flex",
  450: "ARAM",
  480: "Swiftplay",
  490: "Quickplay",
  700: "Clash",
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
};

export function queueLabel(queueId: number): string {
  return QUEUE_TYPES[queueId] ?? `Queue ${queueId}`;
}

// Wider-vocabulary variant used by the live-game spectator surface. Custom
// games (`queueId === 0`) only appear on the live feed, and "Ranked Solo/Duo"
// is the conversational label League players recognise — both diverge from
// the compact canonical labels on purpose.
export function queueLabelExpanded(queueId: number): string {
  if (queueId === 0) return "Custom";
  if (queueId === 420) return "Ranked Solo/Duo";
  return queueLabel(queueId);
}

// Maps Riot's numeric Match-V5 queueId to the League-V4 queueType string
// used in RankSnapshot rows — bridges the two API representations.
export const RANKED_QUEUE_MAP: Record<number, string> = {
  420: "RANKED_SOLO_5x5",
  440: "RANKED_FLEX_SR",
};

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
