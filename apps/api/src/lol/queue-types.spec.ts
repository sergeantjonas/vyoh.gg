import { describe, expect, it } from "vitest";
import { RANKED_QUEUE_MAP, queueTypeName } from "./queue-types";

describe("queueTypeName", () => {
  it("maps known queue ids to their human labels", () => {
    expect(queueTypeName(420)).toBe("Ranked Solo");
    expect(queueTypeName(440)).toBe("Ranked Flex");
    expect(queueTypeName(450)).toBe("ARAM");
    expect(queueTypeName(490)).toBe("Quickplay");
    expect(queueTypeName(1700)).toBe("Arena");
  });

  it("falls back to `Queue <id>` for unmapped ids", () => {
    expect(queueTypeName(9999)).toBe("Queue 9999");
    expect(queueTypeName(0)).toBe("Queue 0");
  });
});

describe("RANKED_QUEUE_MAP", () => {
  it("bridges Match-V5 queueId to League-V4 queueType for ranked queues only", () => {
    expect(RANKED_QUEUE_MAP[420]).toBe("RANKED_SOLO_5x5");
    expect(RANKED_QUEUE_MAP[440]).toBe("RANKED_FLEX_SR");
    expect(RANKED_QUEUE_MAP[450]).toBeUndefined();
  });
});
