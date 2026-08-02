import { Readable } from "node:stream";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import sharp from "sharp";

// Bounded budget so a hung upstream can't tie up a Node worker. The proxy is
// the only thing in the request path between the browser and the CDN, so a
// fast 502 lets the caller (and any future Nginx layer with `proxy_cache_use_
// stale`) react instead of waiting.
const FETCH_TIMEOUT_MS = 5_000;

export class UpstreamError extends Error {
  constructor(
    public readonly url: string,
    public override readonly cause: unknown
  ) {
    super(`upstream fetch failed for ${url}: ${String(cause)}`);
  }
}

// Every upstream in this module is a known asset host serving a known path, so
// a redirect is never part of a healthy response — and following one would let
// whoever controls that hop choose the address we fetch, including loopback and
// link-local. `redirect: "manual"` makes undici hand back the 3xx itself. The
// `opaqueredirect` arm is the browser/spec shape for the same case; undici does
// not produce it today, but it costs nothing and the alternative is a silently
// followed redirect if that ever changes.
function isRedirect(res: Response): boolean {
  return res.type === "opaqueredirect" || (res.status >= 300 && res.status < 400);
}

export async function fetchUpstream(url: string): Promise<Buffer> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ac.signal, redirect: "manual" });
    if (isRedirect(res)) throw new UpstreamError(url, `refused redirect ${res.status}`);
    if (!res.ok) throw new UpstreamError(url, `HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  } catch (err) {
    if (err instanceof UpstreamError) throw err;
    throw new UpstreamError(url, err);
  } finally {
    clearTimeout(timer);
  }
}

export interface TranscodeParams {
  width?: number;
  height?: number;
  fit?: "cover" | "contain" | "fill" | "inside" | "outside";
  quality?: number;
  blur?: number;
  // Crops the upper 50% of the source before resizing. Used for CDragon's
  // `icon_minions.png` — a 1:2 vertical sprite that needs the bottom half
  // clipped to render as a single CS icon. Resolved from `.metadata()` at
  // transcode time so callers don't need to know sprite dimensions.
  extractTopHalf?: boolean;
  // Trims uniform-alpha borders before resize. Used for Steam wordmark
  // `logo.png` assets — publishers ship them with wildly different
  // transparent-padding conventions (some tightly cropped, some with ~30%
  // padding per side). Trimming normalises the visible bbox so frontend
  // `max-h`/`max-w` constraints produce consistent rendered sizes across
  // the library. Sharp's `.trim()` defaults handle alpha-bordered PNGs
  // cleanly; threshold of 1 catches edge anti-alias halos that the
  // default threshold (10) preserves and that read as extra padding.
  trim?: boolean;
  // Horizontally mirrors the source (Sharp `.flop()`). Used by the hero
  // and page-backdrop routes when the enrichment row has `flipHero=true`
  // (face detected at the left of source — see SteamSubjectAnchorService).
  // Baking the flip into the bytes — rather than applying CSS
  // `transform: scaleX(-1)` on the consumer — keeps Chrome's
  // view-transition snapshots flipped through the morph animation.
  // Otherwise the snapshot captures the un-transformed pixels and the
  // morph animates between two un-flipped frames, snapping to the
  // flipped DOM only after the animation ends.
  flop?: boolean;
  // Permits Sharp to scale the source up to `width`/`height` when the
  // source is smaller. Default behaviour (when `fit !== "cover"`) is to
  // clamp at native dimensions so we never produce upscaled bytes. For
  // hero-large-shaped routes — where the publisher may not have shipped
  // a 2x asset (RE3-shaped: only 1920w available) and the chapter mounts
  // full-bleed at 2560+ — owning the upscale here lets us pair it with a
  // sharpening pass and keeps the browser doing 1:1 sampling.
  enlarge?: boolean;
  // Post-resize sharpening pass via Sharp `.sharpen({ sigma })`. Pairs with
  // `enlarge` for asset shapes where the upscale is unavoidable. Sigma 0.5–0.8
  // is the conservative range — recovers apparent crispness without the
  // halo'd look of an over-sharpened web image. Apply only on `enlarge`
  // routes — sharpening a downscale tends to crunch edges into noise.
  sharpen?: { sigma: number };
}

export async function transcodeToWebp(
  input: Buffer,
  params: TranscodeParams = {}
): Promise<Buffer> {
  const {
    width,
    height,
    fit,
    quality = 85,
    blur,
    extractTopHalf,
    trim,
    flop,
    enlarge,
    sharpen,
  } = params;
  let pipeline = sharp(input);
  if (extractTopHalf) {
    // Crop only when the source is clearly a vertical sprite (height
    // notably larger than width — e.g. CDragon's 52×112 `icon_minions.png`).
    // The same `Resolved.params` shape covers the wiki primary (square
    // `Minion_icon.png`, 72×72) and the CDragon fallback; cropping the
    // wiki one mangles the icon to a horizontal slice, so gate on shape.
    const meta = await pipeline.metadata();
    if (meta.width && meta.height && meta.height > meta.width * 1.5) {
      pipeline = sharp(input).extract({
        left: 0,
        top: 0,
        width: meta.width,
        height: Math.floor(meta.height / 2),
      });
    }
  }
  if (trim) pipeline = pipeline.trim({ threshold: 1 });
  if (flop) pipeline = pipeline.flop();
  if (width || height) {
    pipeline = pipeline.resize({
      width,
      height,
      fit,
      withoutEnlargement: !enlarge && fit !== "cover",
    });
  }
  if (sharpen) pipeline = pipeline.sharpen({ sigma: sharpen.sigma });
  if (blur !== undefined) pipeline = pipeline.blur(blur);
  return pipeline.webp({ quality }).toBuffer();
}

// Streaming variant for assets the proxy must pipe untouched — Steam
// description-block `<video>` WebM clips are 1–10 MB each × up to ~5 per
// page; buffering them into RAM before res.send would waste memory and
// break HTTP `Range` requests (the `<video>` element relies on 206 for
// scrubbing + bandwidth probing). Forwards an optional `Range` header to
// the upstream and surfaces its status/headers so the controller can
// faithfully relay them. Caller is responsible for piping the returned
// body to the response.
export interface StreamUpstreamResult {
  status: number;
  contentType: string | null;
  contentLength: string | null;
  contentRange: string | null;
  acceptRanges: string | null;
  body: Readable;
}

export async function streamUpstream(
  url: string,
  range?: string
): Promise<StreamUpstreamResult> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
  try {
    const headers: Record<string, string> = {};
    if (range) headers.Range = range;
    const res = await fetch(url, { signal: ac.signal, headers, redirect: "manual" });
    if (isRedirect(res)) throw new UpstreamError(url, `refused redirect ${res.status}`);
    // 206 Partial Content is a success for `Range` requests; treat it like 200.
    if (!res.ok && res.status !== 206) {
      throw new UpstreamError(url, `HTTP ${res.status}`);
    }
    if (!res.body) {
      throw new UpstreamError(url, "no body");
    }
    return {
      status: res.status,
      contentType: res.headers.get("content-type"),
      contentLength: res.headers.get("content-length"),
      contentRange: res.headers.get("content-range"),
      acceptRanges: res.headers.get("accept-ranges"),
      body: Readable.fromWeb(res.body as WebReadableStream),
    };
  } catch (err) {
    if (err instanceof UpstreamError) throw err;
    throw new UpstreamError(url, err);
  } finally {
    clearTimeout(timer);
  }
}

// Attempt each candidate URL in order; return bytes from the first 2xx. Used
// for Steam's hashed → legacy filename fallback chain — keeps the fallback
// logic inside the proxy instead of distributing it across N URL helpers in
// the web app or across two requests with a client-side onError handler.
export async function fetchUpstreamChain(urls: string[]): Promise<Buffer> {
  let lastErr: unknown;
  for (const url of urls) {
    try {
      return await fetchUpstream(url);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new UpstreamError(urls[urls.length - 1] ?? "", lastErr);
}
