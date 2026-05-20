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

  it("uses the calibrated positive-bucket mean once N >= MIN_CALIBRATION_SAMPLE", () => {
    const result = buildComposite(
      [signal("positive", "p1"), signal("positive", "p2"), signal("positive", "p3")],
      {
        n: 50,
        directionalHits: 30,
        directionalAccuracy: 0.6,
        // Player gains ~12 LP on average when the composite reads positive —
        // very different from the heuristic's +20.
        meanLpForPositive: 12,
        meanLpForNegative: -18,
        meanLpForNeutral: 1,
      }
    );
    expect(result.bandSource).toBe("calibration");
    expect(result.band).toBe("+7 to +17 LP");
  });

  it("uses the calibrated negative-bucket mean for warning composites", () => {
    const result = buildComposite(
      [signal("warning", "w1"), signal("warning", "w2"), signal("warning", "w3")],
      {
        n: 60,
        directionalHits: 36,
        directionalAccuracy: 0.6,
        meanLpForPositive: 12,
        meanLpForNegative: -18,
        meanLpForNeutral: 1,
      }
    );
    expect(result.bandSource).toBe("calibration");
    expect(result.band).toBe("-23 to -13 LP");
  });

  it("falls back to the heuristic when the calibration sample is too small", () => {
    const result = buildComposite(
      [signal("positive", "p1"), signal("positive", "p2"), signal("positive", "p3")],
      {
        n: 12,
        directionalHits: 8,
        directionalAccuracy: 0.66,
        meanLpForPositive: 12,
        meanLpForNegative: null,
        meanLpForNeutral: null,
      }
    );
    expect(result.bandSource).toBe("heuristic");
    expect(result.band).toBe("+15 to +25 LP");
  });

  it("falls back to the heuristic when the matching bucket has no observations", () => {
    // N=60 so calibration is trusted in general, but no negative-bucket
    // games have been observed yet, so the warning band can't be calibrated.
    const result = buildComposite(
      [signal("warning", "w1"), signal("warning", "w2"), signal("warning", "w3")],
      {
        n: 60,
        directionalHits: 36,
        directionalAccuracy: 0.6,
        meanLpForPositive: 12,
        meanLpForNegative: null,
        meanLpForNeutral: 1,
      }
    );
    expect(result.bandSource).toBe("heuristic");
    expect(result.band).toBe("-25 to -15 LP");
  });
});
