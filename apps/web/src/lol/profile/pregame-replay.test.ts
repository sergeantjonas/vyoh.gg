import { MIN_CALIBRATION_SAMPLE } from "@vyoh/shared";
import { describe, expect, it } from "vitest";
import { buildComposite } from "./pregame-composite";
import { calibrateConfidence } from "./pregame-replay";

describe("calibrateConfidence", () => {
  const fired = buildComposite([
    { id: "form", label: "Form", verdict: "x", tone: "positive" },
    { id: "tilt", label: "Tilt", verdict: "x", tone: "positive" },
    { id: "slot", label: "Slot", verdict: "x", tone: "neutral" },
    { id: "champ", label: "Champ", verdict: "x", tone: "neutral" },
  ]);

  it("uses calibration text once the sample crosses MIN_CALIBRATION_SAMPLE", () => {
    const cal = calibrateConfidence(fired, {
      n: MIN_CALIBRATION_SAMPLE,
      directionalHits: 22,
      directionalAccuracy: 22 / MIN_CALIBRATION_SAMPLE,
      meanLpForPositive: 8,
      meanLpForNegative: -6,
      meanLpForNeutral: 0,
    });
    expect(cal.source).toBe("calibration");
    expect(cal.text).toMatch(/Directionally right/);
    expect(cal.text).toMatch(new RegExp(`${MIN_CALIBRATION_SAMPLE}`));
  });

  it("falls back to the heuristic string when the sample is too small", () => {
    const cal = calibrateConfidence(fired, {
      n: 5,
      directionalHits: 3,
      directionalAccuracy: 0.6,
      meanLpForPositive: null,
      meanLpForNegative: null,
      meanLpForNeutral: null,
    });
    expect(cal.source).toBe("heuristic");
    // The composite above is "directional only" (2 firing), so the LP1 string flows through.
    expect(cal.text).toBe(fired.confidence);
  });

  it("returns empty text for the empty-read composite", () => {
    const empty = buildComposite([
      { id: "form", label: "Form", verdict: "x", tone: "neutral" },
    ]);
    const cal = calibrateConfidence(empty, {
      n: 100,
      directionalHits: 80,
      directionalAccuracy: 0.8,
      meanLpForPositive: null,
      meanLpForNegative: null,
      meanLpForNeutral: null,
    });
    expect(cal.text).toBe("");
  });
});
