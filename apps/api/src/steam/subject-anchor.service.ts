import { Injectable, Logger } from "@nestjs/common";
import sharp from "sharp";
import smartcrop from "smartcrop-sharp";
import { UpstreamError, fetchUpstreamChain } from "../img/upstream";
import { PrismaService } from "../prisma/prisma.service";
import { FaceDetectionService } from "./face-detection.service";

const STEAM_CDN_HOST = "https://shared.akamai.steamstatic.com";
const STEAM_STORE_ASSETS_PATH = "store_item_assets";

// Per-app concurrency for anchor compute. Each app is a Steam CDN fetch
// (~50-300ms) plus a Sharp + smartcrop pass (~50ms). Going higher than
// ~6 doesn't materially shrink wall time because the CDN is the bottleneck,
// and overshooting risks rate-limit pushback on a single source.
const ANCHOR_CONCURRENCY = 6;

// Target window for smartcrop's saliency search. The library row container
// is ~7.5:1 (h-40 against a typical desktop column); tuning the target
// aspect to match steers smartcrop toward picking a salient region whose
// shape resembles the eventual cropped frame. Absolute size doesn't
// matter — only the ratio.
const TARGET_WIDTH = 750;
const TARGET_HEIGHT = 100;

// Canonical visible-band fraction for the row container at h-40 against
// a typical desktop column width. With cover-fit and width-binding, the
// visible band shows `source_aspect / container_aspect` of source height:
// Steam's 1920×620 hero (aspect 3.1) in a 7.5:1 row → ~0.41. Drives the
// cover-fit transform for the smartcrop fallback below, which maps a
// source-space focal Y to the `objectPosition` percent the row needs.
const CANONICAL_VISIBLE_FRACTION = 0.41;

// Breathing space above the salient window's top, expressed as percent
// of source height. Smartcrop's window top approximately marks where the
// salient region starts; the margin gives composition room above without
// losing the subject at the bottom of the band.
const SMARTCROP_TOP_MARGIN_PCT = 5;

// Hard cap on the smartcrop fallback's `objectPosition` Y. Smartcrop
// maximizes per-region saliency (edge density + skin tone + saturation),
// which on stylized game hero art frequently picks the brightest mid- or
// lower-source region (armor body, sword, weapon) and excludes the head
// above it (Dark Souls II/III/Remastered helmets, Nier Replicant trio
// heads, full-figure characters where the head is darker than the body).
// "Anchor to top of salient region" then anchors mid-source and the
// head is clipped above the visible band.
//
// Capping Y_obj at ~15% (band top at source y≈9%) forces all no-face
// cases into upper-portion framing — under the assumption that game
// hero art consistently places focal subjects with heads in the upper
// half of source. Holds across the sample set; if a future asset has
// its real focal subject in the lower half AND has no detectable face,
// we'd hit it as a regression and revisit.
const SMARTCROP_MAX_Y_OBJ_PCT = 15;

// Headroom bias above a detected face center. Smaller than the smartcrop
// margin because face detection already gives us a precise center — we
// only need ~hair/forehead room, not generic "shift up" budget.
const FACE_HEADROOM_PCT = 4;

// Inset bounds for face anchors. A face center landing flush against the
// source edge produces a row crop where the face is squished against the
// row's edge — reads as cropped rather than composed. Pulling the anchor
// inward to [INSET, 100−INSET] gives the face a small margin even when
// the source itself frames it close to the edge.
const FACE_INSET_PCT = 10;

// When the focal face sits in the leftmost slice of source, the library
// row's wordmark logo (anchored at the card's left edge) lands on top of
// the face. Mirroring the hero horizontally puts the face on the right
// side instead — clear of the logo — at the cost of a flipped composition
// (acceptable for 3D portrait art; live with rare baked-asymmetry quirks).
// Threshold picked just under the X anchor where the logo's right edge
// starts encroaching on a centered face. The same `flipHero` boolean
// flows to both the row hero and the game-detail destination hero so the
// view-transition morph stays continuous across the route swap.
const FLIP_TRIGGER_X_PCT = 22;

// 50/50 is the "computed but inconclusive / unavailable" sentinel. Stored
// rather than left null so the enrichment job doesn't re-fetch the same
// missing asset every cycle (Track B titles like Deus Ex HR original or
// Far Cry 1, where `library_hero.jpg` 404s at every URL in the chain).
// Renderer treats null and 50/50 identically.
const DEFAULT_ANCHOR = {
  subjectXPercent: 50,
  subjectYPercent: 50,
  flipHero: false,
} as const;

export interface SubjectAnchor {
  subjectXPercent: number;
  subjectYPercent: number;
  flipHero: boolean;
}

function composeHeroUrls(
  appid: number,
  hashedPath: string | null,
  timestamp: bigint | null
): string[] {
  const legacy = `${STEAM_CDN_HOST}/${STEAM_STORE_ASSETS_PATH}/steam/apps/${appid}/library_hero.jpg`;
  if (!hashedPath) return [legacy];
  const t = timestamp != null ? `?t=${timestamp.toString()}` : "";
  return [
    `${STEAM_CDN_HOST}/${STEAM_STORE_ASSETS_PATH}/steam/apps/${appid}/${hashedPath}${t}`,
    legacy,
  ];
}

// Smartcrop saliency fallback — used when face detection finds no face at
// any rotation (non-humanoid art like Hollow Knight or Tunic, helmeted or
// hooded characters like Dark Souls, stylized shots where the detector
// can't lock on). Pure function — exported for test coverage.
//
// X is the smartcrop window's horizontal centroid: at desktop viewports
// width is fully visible (no horizontal crop), but on narrower viewports
// where height becomes the binding dimension the X percent controls
// left/right framing.
//
// Y anchors on the salient window's TOP (not its centroid) with a small
// breathing margin, then applies the cover-fit `objectPosition` transform
// so the salient region's top lands inside the visible band. Centroid
// anchoring fails for full-figure compositions (Nier Replicant trio,
// Dark Souls II/Remastered armor, Elden Ring) because the centroid lands
// mid-figure and the head/helmet above is clipped above the band.
// Anchoring on the window top keeps that upper element in frame.
//
// Note this path never sees inverted figures (Stellar Blade-style) — those
// hit face detection at 180° rotation first and never reach this fallback.
// So "anchor to top of salient region" is safe here in a way it wouldn't
// be as a global strategy.
export async function smartcropAnchorFromBytes(bytes: Buffer): Promise<SubjectAnchor> {
  const meta = await sharp(bytes).metadata();
  const srcW = meta.width;
  const srcH = meta.height;
  if (!srcW || !srcH) return DEFAULT_ANCHOR;
  // `minScale: 1.0` (smartcrop's default) forbids shrinking the crop window
  // below the requested target size — which in practice means the algorithm
  // can fail to find any qualifying crop on a Steam hero and silently return
  // the full image (center 50/50). Lowering to 0.5 lets it consider crops
  // down to half the target size, restoring useful saliency behavior.
  const result = await smartcrop.crop(bytes, {
    width: TARGET_WIDTH,
    height: TARGET_HEIGHT,
    minScale: 0.5,
  });
  const top = result.topCrop;
  const cx = top.x + top.width / 2;
  const topPct = (top.y / srcH) * 100;
  const adjustedTopPct = Math.max(0, topPct - SMARTCROP_TOP_MARGIN_PCT);
  // Cover-fit transform: objectPosition Y maps to band-top position in
  // the scrollable excess `(1 − f) × source_h`. Inverting, to land the
  // salient region's top at source-Y = T%, set objectPosition Y = T/(1−f).
  // Capped at SMARTCROP_MAX_Y_OBJ_PCT so the band never anchors below
  // upper-source — see the constant's comment for why.
  const yObjFromWindow = adjustedTopPct / (1 - CANONICAL_VISIBLE_FRACTION);
  const yObj = Math.min(SMARTCROP_MAX_Y_OBJ_PCT, yObjFromWindow);
  return {
    subjectXPercent: Math.max(0, Math.min(100, Math.round((cx / srcW) * 100))),
    subjectYPercent: Math.max(0, Math.min(100, Math.round(yObj))),
    // No flip on the smartcrop fallback path. Smartcrop returns generic
    // saliency, not face position — without knowing which side a face
    // sits on, we can't decide whether flipping would help. Frontend
    // renders these unflipped (face-detected rows are the ones that get
    // the flip when X is leftward).
    flipHero: false,
  };
}

@Injectable()
export class SteamSubjectAnchorService {
  private readonly logger = new Logger(SteamSubjectAnchorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly faceDetection: FaceDetectionService
  ) {}

  // Compute and persist anchors for any row in `appids` whose
  // `subjectXPercent` is null. Idempotent — already-anchored rows are
  // skipped, so the method is safe to call after every enrichment cycle.
  // To force a refresh after publisher art swaps, NULL the two columns for
  // the affected appids; the next cycle will recompute them.
  //
  // Per-asset strategy: face detection first (Ultraface @ 4 rotations) for
  // any humanoid hero; if no face is found at any rotation, fall back to
  // smartcrop saliency centroid. This pairs face-aware anchoring (correct
  // even for upside-down characters like Stellar Blade) with smartcrop's
  // robust coverage of non-humanoid art (Hollow Knight, Tunic, Hades).
  async computeMissingAnchors(appids: number[]): Promise<number> {
    if (appids.length === 0) return 0;
    const rows = await this.prisma.steamGameEnrichment.findMany({
      where: { appid: { in: appids }, subjectXPercent: null },
      select: {
        appid: true,
        libraryHeroPath: true,
        assetTimestamp: true,
      },
    });
    if (rows.length === 0) return 0;
    const start = Date.now();
    let updated = 0;
    for (let i = 0; i < rows.length; i += ANCHOR_CONCURRENCY) {
      const batch = rows.slice(i, i + ANCHOR_CONCURRENCY);
      const results = await Promise.all(
        batch.map((row) =>
          this.computeOne(row.appid, row.libraryHeroPath, row.assetTimestamp)
        )
      );
      for (const { appid, anchor } of results) {
        await this.prisma.steamGameEnrichment.update({
          where: { appid },
          data: {
            subjectXPercent: anchor.subjectXPercent,
            subjectYPercent: anchor.subjectYPercent,
            flipHero: anchor.flipHero,
          },
        });
        updated += 1;
      }
    }
    const duration = Date.now() - start;
    this.logger.log(`anchored ${updated}/${rows.length} apps in ${duration}ms`);
    return updated;
  }

  // Per-app worker: fetch hero bytes via the same hashed → legacy chain
  // the proxy uses, then try face detection. Smartcrop centroid is the
  // fallback when no face is detected at any rotation. Any failure (404
  // across the chain, network timeout, malformed bytes) collapses to the
  // 50/50 sentinel so a permanently-missing asset isn't re-fetched on
  // every cycle.
  private async computeOne(
    appid: number,
    libraryHeroPath: string | null,
    assetTimestamp: bigint | null
  ): Promise<{ appid: number; anchor: SubjectAnchor }> {
    try {
      const urls = composeHeroUrls(appid, libraryHeroPath, assetTimestamp);
      const bytes = await fetchUpstreamChain(urls);
      const face = await this.faceDetection.detectBestFace(bytes);
      if (face !== null) {
        // Flip decision happens BEFORE the edge-inset clamp so we judge
        // against the raw detected position. If the face lives in the
        // leftmost slice of source, we mirror the hero so the face moves
        // out from under the wordmark logo; the X anchor is also inverted
        // (100 − X) so the cover-crop still tracks the face after flip.
        const flipHero = face.centerXPct < FLIP_TRIGGER_X_PCT;
        const detectedX = flipHero ? 100 - face.centerXPct : face.centerXPct;
        // Edge-inset clamp keeps the face from sitting flush against the
        // row's edge (RE Requiem-style framing). Headroom bias shifts up
        // slightly so hair/forehead has breathing room above the face.
        const insetLow = FACE_INSET_PCT;
        const insetHigh = 100 - FACE_INSET_PCT;
        const x = Math.min(insetHigh, Math.max(insetLow, detectedX));
        const y = Math.min(
          insetHigh,
          Math.max(insetLow, face.centerYPct - FACE_HEADROOM_PCT)
        );
        return {
          appid,
          anchor: {
            subjectXPercent: Math.max(0, Math.min(100, Math.round(x))),
            subjectYPercent: Math.max(0, Math.min(100, Math.round(y))),
            flipHero,
          },
        };
      }
      // `smartcropAnchorFromBytes` already anchors to the salient window's
      // top with the cover-fit transform applied; no post-processing here.
      const anchor = await smartcropAnchorFromBytes(bytes);
      return { appid, anchor };
    } catch (err) {
      if (!(err instanceof UpstreamError)) {
        this.logger.warn(`anchor compute failed for ${appid}: ${String(err)}`);
      }
      return { appid, anchor: DEFAULT_ANCHOR };
    }
  }
}
