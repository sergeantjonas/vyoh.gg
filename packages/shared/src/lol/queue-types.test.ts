import { describe, expect, it } from "vitest";
import {
  NON_LANED_QUEUE_IDS,
  QUEUE_TYPES,
  RANKED_QUEUE_IDS,
  RANKED_QUEUE_KEYS,
  RANKED_QUEUE_KEY_LABEL,
  RANKED_QUEUE_KEY_TO_ID,
  RANKED_QUEUE_KEY_TO_TYPE,
  RANKED_QUEUE_MAP,
  SR_LANE_QUEUE_IDS,
  queueLabel,
  queueLabelExpanded,
} from "./queue-types.ts";

describe("queueLabel", () => {
  it("returns canonical compact labels for known ids", () => {
    expect(queueLabel(420)).toBe("Ranked Solo");
    expect(queueLabel(440)).toBe("Ranked Flex");
    expect(queueLabel(450)).toBe("ARAM");
    expect(queueLabel(490)).toBe("Quickplay");
    expect(queueLabel(1700)).toBe("Arena");
  });

  it("falls back to `Queue <id>` for unmapped ids", () => {
    expect(queueLabel(9999)).toBe("Queue 9999");
  });

  // 710 is live but absent from Riot's static queues.json, so the label comes
  // from CommunityDragon's catalogue. It reached production as "Queue 710".
  it("names queues Riot's static docs omit", () => {
    expect(queueLabel(710)).toBe("Ranked 5s");
  });

  it("names the queues that render as one family", () => {
    expect(queueLabel(2300)).toBe("Brawl");
    expect(queueLabel(2305)).toBe("Brawl");
    expect(queueLabel(2400)).toBe("ARAM: Mayhem");
    expect(queueLabel(3280)).toBe("ARAM: Mayhem");
  });
});

describe("queueLabelExpanded", () => {
  it("widens 0 to Custom and 420 to Ranked Solo/Duo for the live surface", () => {
    expect(queueLabelExpanded(0)).toBe("Custom");
    expect(queueLabelExpanded(420)).toBe("Ranked Solo/Duo");
  });

  it("delegates every other id to the canonical compact label", () => {
    expect(queueLabelExpanded(440)).toBe("Ranked Flex");
    expect(queueLabelExpanded(450)).toBe("ARAM");
    expect(queueLabelExpanded(1700)).toBe("Arena");
    expect(queueLabelExpanded(9999)).toBe("Queue 9999");
  });
});

describe("RANKED_QUEUE_MAP", () => {
  it("bridges Match-V5 queueId to League-V4 queueType for ranked queues only", () => {
    expect(RANKED_QUEUE_MAP[420]).toBe("RANKED_SOLO_5x5");
    expect(RANKED_QUEUE_MAP[440]).toBe("RANKED_FLEX_SR");
    expect(RANKED_QUEUE_MAP[450]).toBeUndefined();
  });
});

describe("RANKED_QUEUE_IDS", () => {
  it("stays in step with RANKED_QUEUE_MAP because it is derived from it", () => {
    expect([...RANKED_QUEUE_IDS].sort((a, b) => a - b)).toEqual([420, 440]);
    for (const id of RANKED_QUEUE_IDS) {
      expect(RANKED_QUEUE_MAP[id]).toBeDefined();
    }
  });
});

describe("queue-family sets", () => {
  // These replaced Sets of labels. A label test caught every id sharing that
  // label for free, so an id set has to list each one explicitly or it
  // silently narrows: "Arena" covered 1700 and 1710, "Swarm" covered four.
  it("lists every id behind a shared label, not just the first", () => {
    expect(NON_LANED_QUEUE_IDS.has(1700)).toBe(true);
    expect(NON_LANED_QUEUE_IDS.has(1710)).toBe(true);
    expect(queueLabel(1700)).toBe(queueLabel(1710));
  });

  it("covers the ARAM family and excludes Summoner's Rift", () => {
    expect(NON_LANED_QUEUE_IDS.has(450)).toBe(true); // ARAM
    expect(NON_LANED_QUEUE_IDS.has(720)).toBe(true); // ARAM Clash
    expect(NON_LANED_QUEUE_IDS.has(420)).toBe(false);
  });

  it("keeps the two families disjoint", () => {
    for (const id of SR_LANE_QUEUE_IDS) {
      expect(NON_LANED_QUEUE_IDS.has(id)).toBe(false);
    }
  });

  it("treats both ranked queues as laned Summoner's Rift", () => {
    for (const id of RANKED_QUEUE_IDS) {
      expect(SR_LANE_QUEUE_IDS.has(id)).toBe(true);
    }
  });

  // Co-op vs AI runs on Summoner's Rift but against bots, so a lane-phase
  // differential against a bot opponent would read as skill.
  it("excludes co-op vs AI from the lane-review set", () => {
    for (const id of [830, 840, 850, 870, 880, 890]) {
      expect(SR_LANE_QUEUE_IDS.has(id)).toBe(false);
    }
  });
});

describe("RankedQueueKey maps", () => {
  it("keeps every key consistent across id, type, label, and canonical label", () => {
    for (const key of RANKED_QUEUE_KEYS) {
      const id = RANKED_QUEUE_KEY_TO_ID[key];
      expect(RANKED_QUEUE_MAP[id]).toBe(RANKED_QUEUE_KEY_TO_TYPE[key]);
      // The compact RANKED_QUEUE_KEY_LABEL ("Solo/Duo" / "Flex") is shorter
      // than the canonical QUEUE_TYPES label ("Ranked Solo" / "Ranked Flex"),
      // by design. Sanity-check both still cover the same queueId.
      expect(QUEUE_TYPES[id]).toBeDefined();
      expect(RANKED_QUEUE_KEY_LABEL[key].length).toBeGreaterThan(0);
    }
  });
});
