import { describe, expect, it } from "vitest";
import { queueColor } from "./queue-color";

describe("queueColor", () => {
  it("returns the explicit anchor color for known queues", () => {
    expect(queueColor("Ranked Solo")).toBe("#fbbf24");
    expect(queueColor("Ranked Flex")).toBe("#a78bfa");
    expect(queueColor("ARAM")).toBe("#38bdf8");
    expect(queueColor("Arena")).toBe("#f472b6");
    expect(queueColor("URF")).toBe("#fb923c");
  });

  it("anchors Quickplay and Normal Draft/Blind to emerald so they read as 'normals'", () => {
    expect(queueColor("Quickplay")).toBe("#34d399");
    expect(queueColor("Normal Draft")).toBe("#34d399");
    expect(queueColor("Normal Blind")).toBe("#34d399");
  });

  it("returns the same palette color for the same unknown queue across calls (stable hash)", () => {
    const first = queueColor("Some Random Queue");
    const second = queueColor("Some Random Queue");
    expect(first).toBe(second);
  });

  it("returns a hex color from the palette for unknown queues", () => {
    expect(queueColor("Bot Game")).toMatch(/^#[0-9a-f]{6}$/i);
  });
});
