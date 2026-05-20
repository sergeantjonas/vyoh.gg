import type { CompositeRead } from "@/lol/profile/pregame-composite";
import { type CalibrationStats, MIN_CALIBRATION_SAMPLE } from "@vyoh/shared";

export {
  MIN_CALIBRATION_SAMPLE,
  computeCalibration,
  replayHistory,
} from "@vyoh/shared";
export type { CalibrationStats, ReplayPoint } from "@vyoh/shared";

export interface CalibratedConfidence {
  text: string;
  source: "calibration" | "heuristic";
}

// Produces the confidence text. When we have enough historical replays to
// trust the calibration, use it. Otherwise fall back to LP1's heuristic
// (the existing string already on `composite.confidence`).
export function calibrateConfidence(
  composite: CompositeRead,
  calibration: CalibrationStats
): CalibratedConfidence {
  if (composite.empty) return { text: "", source: "heuristic" };
  if (calibration.n >= MIN_CALIBRATION_SAMPLE) {
    const pct = Math.round(calibration.directionalAccuracy * 100);
    return {
      text: `Directionally right ${pct}% on your last ${calibration.n} ranked games.`,
      source: "calibration",
    };
  }
  return { text: composite.confidence, source: "heuristic" };
}
