import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UpstreamError } from "../img/upstream";
import type { PrismaService } from "../prisma/prisma.service";
import type { FaceDetectionService } from "./face-detection.service";
import {
  SteamSubjectAnchorService,
  smartcropAnchorFromBytes,
} from "./subject-anchor.service";

const fetchUpstreamChain = vi.hoisted(() => vi.fn());
vi.mock("../img/upstream", async () => {
  const actual =
    await vi.importActual<typeof import("../img/upstream")>("../img/upstream");
  return { ...actual, fetchUpstreamChain };
});

beforeEach(() => {
  fetchUpstreamChain.mockReset();
});

// Build a 1920×620 (Steam library_hero aspect) PNG with a bright square
// painted at a known position. smartcrop-sharp follows saliency / edge
// energy, so a high-contrast block against a uniform field reliably
// dominates the centroid. Used to assert the centroid → percent mapping
// rather than the saliency algorithm itself (smartcrop is a vendored dep).
async function makeHeroWithBlock(
  blockX: number,
  blockY: number,
  blockSize = 200
): Promise<Buffer> {
  const w = 1920;
  const h = 620;
  const overlay = await sharp({
    create: {
      width: blockSize,
      height: blockSize,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .png()
    .toBuffer();
  return sharp({
    create: {
      width: w,
      height: h,
      channels: 3,
      background: { r: 20, g: 20, b: 20 },
    },
  })
    .composite([{ input: overlay, top: blockY, left: blockX }])
    .png()
    .toBuffer();
}

describe("smartcropAnchorFromBytes", () => {
  it("X anchors toward a left-of-center salient block", async () => {
    const bytes = await makeHeroWithBlock(200, 210);
    const anchor = await smartcropAnchorFromBytes(bytes);
    // Block center (300, 310) on a 1920×620 canvas → X ~16%.
    expect(anchor.subjectXPercent).toBeLessThan(35);
  });

  it("X anchors toward a right-of-center salient block", async () => {
    const bytes = await makeHeroWithBlock(1500, 210);
    const anchor = await smartcropAnchorFromBytes(bytes);
    expect(anchor.subjectXPercent).toBeGreaterThan(65);
  });

  it("Y is capped at the upper-portion bound when the salient window is mid- or lower-source", async () => {
    // Block top at source y=210 of 620 (34%) — smartcrop picks a window
    // around the block, which would transform to Y_obj ≈ 49% before the
    // cap. The cap (SMARTCROP_MAX_Y_OBJ_PCT = 15) forces the anchor up so
    // that band top sits at source y≈9%, which is what we need for game
    // hero art where the head/helmet is above the smartcrop window.
    const bytes = await makeHeroWithBlock(960, 210);
    const anchor = await smartcropAnchorFromBytes(bytes);
    expect(anchor.subjectYPercent).toBeLessThanOrEqual(15);
  });

  it("Y anchors near 0 when the salient region sits at the top edge of source", async () => {
    // Block at source y=0 — smartcrop's window starts at y=0, the 5% top
    // margin pushes the adjusted top below 0 (clamped to 0), and the
    // transform yields 0. Band starts at the top of source — preserves
    // any subject whose head touches y=0 (Dark Souls Remastered / Nier
    // Replicant pattern).
    const bytes = await makeHeroWithBlock(960, 0);
    const anchor = await smartcropAnchorFromBytes(bytes);
    expect(anchor.subjectYPercent).toBeLessThan(15);
  });

  it("clamps to 0-100 even when the salient region sits at an image edge", async () => {
    const bytes = await makeHeroWithBlock(0, 0, 50);
    const anchor = await smartcropAnchorFromBytes(bytes);
    expect(anchor.subjectXPercent).toBeGreaterThanOrEqual(0);
    expect(anchor.subjectXPercent).toBeLessThanOrEqual(100);
    expect(anchor.subjectYPercent).toBeGreaterThanOrEqual(0);
    expect(anchor.subjectYPercent).toBeLessThanOrEqual(100);
  });
});

describe("SteamSubjectAnchorService.computeMissingAnchors", () => {
  function makeService(
    rows: {
      appid: number;
      libraryHeroPath: string | null;
      assetTimestamp: bigint | null;
    }[],
    faceOverride: {
      centerXPct: number;
      centerYPct: number;
      score: number;
      rotation: 0 | 90 | 180 | 270;
    } | null = null
  ) {
    const prisma = {
      steamGameEnrichment: {
        findMany: vi.fn().mockResolvedValue(rows),
        update: vi.fn().mockResolvedValue(undefined),
      },
    };
    const faceDetection = {
      detectBestFace: vi.fn().mockResolvedValue(faceOverride),
    };
    return {
      service: new SteamSubjectAnchorService(
        prisma as unknown as PrismaService,
        faceDetection as unknown as FaceDetectionService
      ),
      prisma,
      faceDetection,
    };
  }

  it("returns 0 without querying when appids is empty", async () => {
    const { service, prisma } = makeService([]);
    const updated = await service.computeMissingAnchors([]);
    expect(updated).toBe(0);
    expect(prisma.steamGameEnrichment.findMany).not.toHaveBeenCalled();
  });

  it("returns 0 when no rows match the IS NULL filter", async () => {
    const { service, prisma } = makeService([]);
    const updated = await service.computeMissingAnchors([42]);
    expect(updated).toBe(0);
    expect(prisma.steamGameEnrichment.update).not.toHaveBeenCalled();
  });

  it("writes the 50/50 sentinel when fetchUpstreamChain throws", async () => {
    fetchUpstreamChain.mockRejectedValue(new UpstreamError("test", "404"));
    const { service, prisma } = makeService([
      { appid: 1, libraryHeroPath: null, assetTimestamp: null },
    ]);
    const updated = await service.computeMissingAnchors([1]);
    expect(updated).toBe(1);
    const call = prisma.steamGameEnrichment.update.mock.calls[0]?.[0] as
      | { data: { subjectXPercent: number; subjectYPercent: number } }
      | undefined;
    expect(call?.data.subjectXPercent).toBe(50);
    expect(call?.data.subjectYPercent).toBe(50);
  });

  it("persists the smartcrop centroid when face detection finds nothing", async () => {
    const bytes = await makeHeroWithBlock(1500, 210);
    fetchUpstreamChain.mockResolvedValue(bytes);
    const { service, prisma } = makeService(
      [{ appid: 42, libraryHeroPath: "hash", assetTimestamp: 1n }],
      null
    );
    const updated = await service.computeMissingAnchors([42]);
    expect(updated).toBe(1);
    const call = prisma.steamGameEnrichment.update.mock.calls[0]?.[0] as
      | { data: { subjectXPercent: number; subjectYPercent: number } }
      | undefined;
    expect(call?.data.subjectXPercent).toBeGreaterThan(65);
  });

  it("anchors on the face when face detection succeeds, with headroom bias above", async () => {
    fetchUpstreamChain.mockResolvedValue(Buffer.from([1, 2, 3]));
    const { service, prisma, faceDetection } = makeService(
      [{ appid: 42, libraryHeroPath: "hash", assetTimestamp: 1n }],
      { centerXPct: 25.3, centerYPct: 77.8, score: 0.92, rotation: 180 }
    );
    await service.computeMissingAnchors([42]);
    expect(faceDetection.detectBestFace).toHaveBeenCalled();
    const call = prisma.steamGameEnrichment.update.mock.calls[0]?.[0] as
      | {
          data: {
            subjectXPercent: number;
            subjectYPercent: number;
            flipHero: boolean;
          };
        }
      | undefined;
    // X passes through (25.3, no inset needed — far from any edge).
    expect(call?.data.subjectXPercent).toBe(25);
    // Y has the FACE_HEADROOM_PCT (4%) subtracted: 77.8 − 4 = 73.8 → 74.
    expect(call?.data.subjectYPercent).toBe(74);
    // X=25 is above FLIP_TRIGGER_X_PCT (22) — no flip.
    expect(call?.data.flipHero).toBe(false);
  });

  it("flips the hero and inverts X when the face is far enough left to clash with the logo", async () => {
    fetchUpstreamChain.mockResolvedValue(Buffer.from([1, 2, 3]));
    const { service, prisma } = makeService(
      [{ appid: 42, libraryHeroPath: "hash", assetTimestamp: 1n }],
      // RE4-style: Leon detected at source X≈18%, well inside the logo zone.
      { centerXPct: 18, centerYPct: 47, score: 0.6, rotation: 0 }
    );
    await service.computeMissingAnchors([42]);
    const call = prisma.steamGameEnrichment.update.mock.calls[0]?.[0] as
      | {
          data: {
            subjectXPercent: number;
            subjectYPercent: number;
            flipHero: boolean;
          };
        }
      | undefined;
    expect(call?.data.flipHero).toBe(true);
    // Inverted: 100 − 18 = 82 → after clamp to insetHigh (90) stays 82.
    expect(call?.data.subjectXPercent).toBe(82);
  });

  it("clamps face anchors to the inset bounds when the face sits flush against an edge", async () => {
    fetchUpstreamChain.mockResolvedValue(Buffer.from([1, 2, 3]));
    const { service, prisma } = makeService(
      [{ appid: 42, libraryHeroPath: "hash", assetTimestamp: 1n }],
      { centerXPct: 96, centerYPct: 5, score: 0.85, rotation: 0 }
    );
    await service.computeMissingAnchors([42]);
    const call = prisma.steamGameEnrichment.update.mock.calls[0]?.[0] as
      | { data: { subjectXPercent: number; subjectYPercent: number } }
      | undefined;
    // X clamps from 96 down to 90 (inset 10 from the right edge).
    expect(call?.data.subjectXPercent).toBe(90);
    // Y: headroom subtraction first (5 − 4 = 1), then inset clamp up to 10.
    expect(call?.data.subjectYPercent).toBe(10);
  });

  it("caps the smartcrop fallback Y at the upper-portion bound", async () => {
    const bytes = await makeHeroWithBlock(1500, 210);
    fetchUpstreamChain.mockResolvedValue(bytes);
    const { service, prisma } = makeService(
      [{ appid: 42, libraryHeroPath: "hash", assetTimestamp: 1n }],
      null
    );
    await service.computeMissingAnchors([42]);
    const call = prisma.steamGameEnrichment.update.mock.calls[0]?.[0] as
      | { data: { subjectXPercent: number; subjectYPercent: number } }
      | undefined;
    // Mid-source salient block transforms to Y_obj ~49% pre-cap; the
    // SMARTCROP_MAX_Y_OBJ_PCT cap forces it to 15 or less so the band
    // top stays near the top of source (Dark Souls / Nier Replicant
    // pattern — heads above the smartcrop window must remain in frame).
    expect(call?.data.subjectYPercent).toBeLessThanOrEqual(15);
  });
});
