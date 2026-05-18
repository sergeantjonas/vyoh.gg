import type { RitualSignal } from "@/lol/profile/ritual-tile";
import { describe, expect, it } from "vitest";
import { buildComposite } from "./pregame-composite";

const signal = (tone: RitualSignal["tone"], id = `s-${tone}`): RitualSignal => ({
  id,
  label: id,
  verdict: id,
  tone,
});

describe("buildComposite", () => {
  it("returns the empty placeholder when no signal has a tone", () => {
    const result = buildComposite([signal("neutral", "a"), signal("neutral", "b")]);
    expect(result.empty).toBe(true);
    expect(result.firing).toBe(0);
    expect(result.tone).toBe("neutral");
    expect(result.band).toMatch(/Play a few games/);
  });

  it("flags 'low confidence' when only one signal fires", () => {
    const result = buildComposite([
      signal("positive"),
      signal("neutral", "n1"),
      signal("neutral", "n2"),
      signal("neutral", "n3"),
    ]);
    expect(result.firing).toBe(1);
    expect(result.confidence).toMatch(/low confidence/);
    // mean = 1/4 = 0.25 → tone is positive (>= 0.25), center = 5,
    // low = 0 (formats as "0", no '+'), high = 10 (+10).
    expect(result.tone).toBe("positive");
    expect(result.band).toBe("0 to +10 LP");
  });

  it("flags 'directional only' when exactly two signals fire", () => {
    const result = buildComposite([
      signal("positive", "p1"),
      signal("warning", "w1"),
      signal("neutral", "n1"),
      signal("neutral", "n2"),
    ]);
    expect(result.firing).toBe(2);
    expect(result.confidence).toBe("directional only");
    // mean = 0 → tone neutral, center = 0, band = -5 to +5
    expect(result.tone).toBe("neutral");
    expect(result.band).toBe("-5 to +5 LP");
  });

  it("clears the confidence caveat once 3 signals fire", () => {
    const result = buildComposite([
      signal("warning", "w1"),
      signal("warning", "w2"),
      signal("warning", "w3"),
    ]);
    expect(result.firing).toBe(3);
    expect(result.confidence).toBe("");
    // mean = -1 → warning tone, center = -20, band = -25 to -15
    expect(result.tone).toBe("warning");
    expect(result.band).toBe("-25 to -15 LP");
  });

  it("formats positive centers with an explicit '+' sign", () => {
    const result = buildComposite([
      signal("positive", "p1"),
      signal("positive", "p2"),
      signal("positive", "p3"),
    ]);
    // mean = 1 → center = 20, band = +15 to +25
    expect(result.band).toBe("+15 to +25 LP");
  });
});
