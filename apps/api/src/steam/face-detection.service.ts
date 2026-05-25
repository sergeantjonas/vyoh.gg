import { resolve } from "node:path";
import { Injectable, Logger } from "@nestjs/common";
import * as ort from "onnxruntime-node";
import sharp from "sharp";

// Ultraface-RFB-320 — vendored at `apps/api/models/ultraface-rfb-320.onnx`.
// ~1.2 MB ONNX model trained on WIDER FACE, designed for mobile/server
// inference. Outputs softmax scores + normalized bboxes for ≤ 4420 anchors.
//
// We use it for one job only: locating a face inside a Steam library hero
// asset at enrichment time, so the library row's cover crop can anchor on
// the face instead of saliency-only centroid. Run at 0°/90°/180°/270° to
// catch inverted compositions (Stellar Blade's EVE), pick the rotation
// with the highest single score, and convert that rotation's bbox center
// back to source-space coordinates.
const MODEL_RELATIVE_PATH = "models/ultraface-rfb-320.onnx";
const MODEL_INPUT_WIDTH = 320;
const MODEL_INPUT_HEIGHT = 240;

// Confidence floor. 0.4 catches profile / partially-occluded faces like
// RE4's Leon (his cover art profile detects at 0.588). Below this, we
// reject as either noise or phantom (geometric patterns the detector
// misreads as face-like).
const SCORE_THRESHOLD = 0.4;

// "Good enough" threshold for the natural-orientation (0°) detection. If
// 0° produces a face at or above this score, we use it even when a
// rotated pass produces a higher score. Rationale: virtually all Steam
// hero art is composed with the main character upright; the 4-rotation
// pass exists to catch the rare inverted asset (Stellar Blade), not as
// a tiebreaker for "which of the multiple faces in this composition is
// the focal one." When the source has a foreground hero face AND a
// secondary (downed/turned-away/background) face that happens to be
// upright-when-rotated, the rotated face often outscores the natural one
// because it's larger or more frontal in its rotated frame — but the
// natural-orientation face is what the artist meant as the subject.
// Picking 0° preferentially fixes assets like Assassin's Creed II where
// Ezio (0°) is the focal but the dead character (180°) scores higher.
const PREFER_ZERO_DEG_THRESHOLD = 0.5;

// Bbox size sanity bounds for a "real face" detection, expressed as a
// fraction of the source dimensions (the model output is already in
// normalized 0-1 source coords). Real Steam hero art faces typically
// span 5-30% on each axis, with the largest legitimate cases being
// close-up profiles like RE4's Leon (estimated ~40-50% on the taller
// axis). Ultraface occasionally hallucinates large "faces" covering
// most of a frame when rotated source produces high-contrast geometric
// patterns — DOOM 3's demon-and-marine composition at 270° produces a
// phantom 67%×54% "face" at score 0.518.
//
// Bounds chosen as: MIN excludes pixel-tiny noise; MAX excludes the
// "whole composition" phantoms while leaving enough headroom for
// legitimate close-up shots. The 0.6 ceiling rejects DOOM 3's 67%×54%
// phantom but accepts plausible large detections.
const MIN_BBOX_FRACTION = 0.03;
const MAX_BBOX_FRACTION = 0.6;

// Edge-guard for NON-zero-degree detections. A face detected at 90/180/270°
// that un-rotates to the outer 10% strip of source is virtually always a
// phantom — the detector latched onto an edge artifact of the rotated
// frame (bright fire effects at source bottom flipped to top in the
// rotated frame, geometric patterns near the source edges, etc.).
//
// DOOM 3 BFG at 180° produces a "face" of plausible size (5.5×12.2%) at
// score 0.697 that un-rotates to source (58%, 92%) — clearly in the fire
// effects at the source bottom edge, not a real face. The bbox size
// filter doesn't catch it because the bbox itself is face-sized; the
// EDGE guard does.
//
// Only applied to non-0° rotations because 0° detections can legitimately
// sit at the source edges by intended composition (a character whose head
// reaches near the source top, etc.). Rotated-frame detections at edges
// are a different beast — there's no compositional reason for the artist
// to put a focal subject at an edge that becomes meaningful only when the
// image is rotated.
const NON_ZERO_DEG_EDGE_GUARD_FRACTION = 0.1;

// Mean + scale for input normalization, per the Ultraface reference
// preprocessing (subtract 127, divide by 128 → roughly [-1, 1] range).
const INPUT_MEAN = 127;
const INPUT_SCALE = 128;

const ROTATIONS = [0, 90, 180, 270] as const;
type Rotation = (typeof ROTATIONS)[number];

export interface DetectedFace {
  // Bounding-box CENTER in source-space normalized coords [0, 1]. Already
  // un-rotated, so callers can use these directly as `object-position`
  // percentages without knowing which rotation found the face.
  centerXPct: number;
  centerYPct: number;
  score: number;
  rotation: Rotation;
}

@Injectable()
export class FaceDetectionService {
  private readonly logger = new Logger(FaceDetectionService.name);
  // Lazily-loaded singleton — model file is ~1.2 MB and load takes ~50ms.
  // We pay it once on first detection; subsequent calls reuse the session.
  private sessionPromise: Promise<ort.InferenceSession> | null = null;

  private getSession(): Promise<ort.InferenceSession> {
    if (this.sessionPromise === null) {
      // Resolve relative to the package root, not the compiled `dist/`
      // directory — Nest's SWC build leaves the models directory at the
      // package level, not co-located with the JS output.
      const modelPath = resolve(process.cwd(), MODEL_RELATIVE_PATH);
      // `logSeverityLevel: 3` (error) silences Ultraface's per-initializer
      // "appears in graph inputs" warnings on load. Those are a model-export
      // hygiene advisory (could be re-exported with cleaner const-folding);
      // they don't affect inference correctness or any performance metric
      // we care about for a once-at-boot pass.
      this.sessionPromise = ort.InferenceSession.create(modelPath, {
        logSeverityLevel: 3,
      });
    }
    return this.sessionPromise;
  }

  // Detect the focal face across all four cardinal rotations, returning
  // its center in source-space normalized coordinates. Returns null when
  // no rotation produces a detection above the confidence threshold —
  // caller's responsibility to fall back to smartcrop.
  //
  // Selection: if 0° (natural orientation) yields a detection ≥
  // PREFER_ZERO_DEG_THRESHOLD, take it directly. Otherwise pick the
  // best single score across all rotations. The 0° preference is what
  // catches the "multiple faces, pick the focal one" pattern when one
  // face happens to be upside-down in source: a rotated detection on a
  // secondary/downed character can outscore the upright hero face by
  // raw confidence alone, but the artist's intended composition is the
  // 0°-upright subject (Assassin's Creed II Ezio vs the dead character).
  async detectBestFace(bytes: Buffer): Promise<DetectedFace | null> {
    const session = await this.getSession();
    let zeroDeg: DetectedFace | null = null;
    let best: DetectedFace | null = null;
    for (const rotation of ROTATIONS) {
      const tensor = await preprocess(bytes, rotation);
      const result = await session.run({ input: tensor });
      const scoresTensor = result.scores;
      const boxesTensor = result.boxes;
      if (!scoresTensor || !boxesTensor) continue;
      const det = topDetection(
        scoresTensor.data as Float32Array,
        boxesTensor.data as Float32Array
      );
      if (det === null) continue;
      const sourceCenter = unrotateCenter(det.cx, det.cy, rotation);
      if (rotation !== 0 && isInEdgeGuard(sourceCenter)) continue;
      const candidate: DetectedFace = {
        centerXPct: sourceCenter.x * 100,
        centerYPct: sourceCenter.y * 100,
        score: det.score,
        rotation,
      };
      if (rotation === 0) zeroDeg = candidate;
      if (best === null || candidate.score > best.score) {
        best = candidate;
      }
    }
    const chosen =
      zeroDeg !== null && zeroDeg.score >= PREFER_ZERO_DEG_THRESHOLD ? zeroDeg : best;
    if (chosen !== null) {
      this.logger.debug?.(
        `face at (${chosen.centerXPct.toFixed(1)}%, ${chosen.centerYPct.toFixed(1)}%) score=${chosen.score.toFixed(3)} rotation=${chosen.rotation}°`
      );
    }
    return chosen;
  }
}

// Sharp rotate + resize + normalize. Pulled out so the rotation loop in
// `detectBestFace` stays focused on orchestration; the per-pixel buffer
// reshape (HWC uint8 → CHW float32, mean-and-scale) lives here.
async function preprocess(bytes: Buffer, rotation: Rotation): Promise<ort.Tensor> {
  const { data } = await sharp(bytes)
    .rotate(rotation)
    .resize(MODEL_INPUT_WIDTH, MODEL_INPUT_HEIGHT, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const planeSize = MODEL_INPUT_WIDTH * MODEL_INPUT_HEIGHT;
  const out = new Float32Array(3 * planeSize);
  for (let i = 0; i < planeSize; i++) {
    const src = i * 3;
    out[i] = ((data[src] ?? INPUT_MEAN) - INPUT_MEAN) / INPUT_SCALE;
    out[planeSize + i] = ((data[src + 1] ?? INPUT_MEAN) - INPUT_MEAN) / INPUT_SCALE;
    out[2 * planeSize + i] = ((data[src + 2] ?? INPUT_MEAN) - INPUT_MEAN) / INPUT_SCALE;
  }
  return new ort.Tensor("float32", out, [1, 3, MODEL_INPUT_HEIGHT, MODEL_INPUT_WIDTH]);
}

// Parse the top-scoring face from Ultraface output tensors.
// `scores` shape: [N × 2] (bg, face). `boxes` shape: [N × 4] (x1, y1, x2, y2)
// normalized 0-1. Returns null when no face exceeds the threshold.
function topDetection(
  scores: Float32Array,
  boxes: Float32Array
): { cx: number; cy: number; score: number } | null {
  let bestScore = SCORE_THRESHOLD;
  let bestX1 = 0;
  let bestY1 = 0;
  let bestX2 = 0;
  let bestY2 = 0;
  const n = scores.length / 2;
  for (let i = 0; i < n; i++) {
    const score = scores[i * 2 + 1] ?? 0;
    if (score <= bestScore) continue;
    const x1 = boxes[i * 4] ?? 0;
    const y1 = boxes[i * 4 + 1] ?? 0;
    const x2 = boxes[i * 4 + 2] ?? 0;
    const y2 = boxes[i * 4 + 3] ?? 0;
    // Reject phantom detections whose bbox sits outside the size envelope
    // of a real face — see MIN/MAX_BBOX_FRACTION above. Cheap pre-filter
    // before the score swap, so a high-scoring phantom can't beat a
    // legitimate detection further down the list.
    const w = x2 - x1;
    const h = y2 - y1;
    if (w < MIN_BBOX_FRACTION || h < MIN_BBOX_FRACTION) continue;
    if (w > MAX_BBOX_FRACTION || h > MAX_BBOX_FRACTION) continue;
    bestScore = score;
    bestX1 = x1;
    bestY1 = y1;
    bestX2 = x2;
    bestY2 = y2;
  }
  if (bestScore <= SCORE_THRESHOLD) return null;
  return {
    cx: (bestX1 + bestX2) / 2,
    cy: (bestY1 + bestY2) / 2,
    score: bestScore,
  };
}

// True when a face center sits within the outer NON_ZERO_DEG_EDGE_GUARD
// strip on any axis. Used to reject phantom detections from non-zero
// rotations only (see the constant's comment for rationale). Exported
// for test coverage.
export function isInEdgeGuard(center: { x: number; y: number }): boolean {
  const g = NON_ZERO_DEG_EDGE_GUARD_FRACTION;
  return center.x < g || center.x > 1 - g || center.y < g || center.y > 1 - g;
}

// Convert a normalized (x, y) point from a rotated image's coordinate
// space back to the original source's coordinate space. Sharp's `rotate(d)`
// rotates clockwise; the inverse mapping is straightforward in unit-square
// terms (no aspect-ratio dependency because we stay normalized). Exported
// for test coverage so the math is verified independently of the runtime.
export function unrotateCenter(
  x: number,
  y: number,
  rotation: Rotation
): { x: number; y: number } {
  switch (rotation) {
    case 0:
      return { x, y };
    case 90:
      // CW 90° forward: source(x, y) → rotated(1−y, x).
      // Inverse: rotated(X, Y) → source(Y, 1−X).
      return { x: y, y: 1 - x };
    case 180:
      return { x: 1 - x, y: 1 - y };
    case 270:
      // CW 270° forward: source(x, y) → rotated(y, 1−x).
      // Inverse: rotated(X, Y) → source(1−Y, X).
      return { x: 1 - y, y: x };
  }
}
