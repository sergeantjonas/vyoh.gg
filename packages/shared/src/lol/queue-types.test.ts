import { describe, expect, it } from "vitest";
import {
  QUEUE_TYPES,
  RANKED_QUEUE_KEYS,
  RANKED_QUEUE_KEY_LABEL,
  RANKED_QUEUE_KEY_TO_ID,
  RANKED_QUEUE_KEY_TO_TYPE,
  RANKED_QUEUE_MAP,
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
    expect(queueLabel(0)).toBe("Queue 0");
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
