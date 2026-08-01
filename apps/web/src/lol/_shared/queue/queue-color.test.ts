import { describe, expect, it } from "vitest";
import { queueColor } from "./queue-color";

describe("queueColor", () => {
  it("returns the explicit anchor color for known queues", () => {
    expect(queueColor(420)).toBe("#fbbf24"); // Ranked Solo
    expect(queueColor(440)).toBe("#a78bfa"); // Ranked Flex
    expect(queueColor(450)).toBe("#38bdf8"); // ARAM
    expect(queueColor(1700)).toBe("#f472b6"); // Arena
    expect(queueColor(900)).toBe("#fb923c"); // URF
  });

  it("anchors Quickplay and Normal Draft/Blind to emerald so they read as 'normals'", () => {
    expect(queueColor(490)).toBe("#34d399"); // Quickplay
    expect(queueColor(400)).toBe("#34d399"); // Normal Draft
    expect(queueColor(430)).toBe("#34d399"); // Normal Blind
  });

  // The distribution donut groups by label, so a queue family that reads as one
  // thing has to paint as one thing. Hashing the id instead of the label would
  // hand these four different colors and split one legend row into four.
  it("gives every id sharing a label the same color", () => {
    expect(queueColor(1820)).toBe(queueColor(1810)); // both "Swarm"
    expect(queueColor(1840)).toBe(queueColor(1810));
    expect(queueColor(1710)).toBe(queueColor(1700)); // both "Arena"
    expect(queueColor(1900)).toBe(queueColor(900)); // both "URF"
  });

  it("returns the same palette color for the same unknown queue across calls (stable hash)", () => {
    expect(queueColor(9999)).toBe(queueColor(9999));
  });

  it("returns a hex color from the palette for unknown queues", () => {
    expect(queueColor(9999)).toMatch(/^#[0-9a-f]{6}$/i);
  });
});
