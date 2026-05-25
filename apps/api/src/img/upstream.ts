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

export async function fetchUpstream(url: string): Promise<Buffer> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ac.signal });
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
}

export async function transcodeToWebp(
  input: Buffer,
  params: TranscodeParams = {}
): Promise<Buffer> {
  const { width, height, fit, quality = 85, blur, extractTopHalf } = params;
  let pipeline = sharp(input);
  if (extractTopHalf) {
    const meta = await pipeline.metadata();
    if (meta.width && meta.height) {
      pipeline = sharp(input).extract({
        left: 0,
        top: 0,
        width: meta.width,
        height: Math.floor(meta.height / 2),
      });
    }
  }
  if (width || height) {
    pipeline = pipeline.resize({
      width,
      height,
      fit,
      withoutEnlargement: fit !== "cover",
    });
  }
  if (blur !== undefined) pipeline = pipeline.blur(blur);
  return pipeline.webp({ quality }).toBuffer();
}

// Sample the asset's leftward content and stretch it horizontally to
// produce an "extended edge" backdrop. The result is a wide image whose
// every vertical position preserves a tint derived from the asset's
// leftmost ~200px at that y — so Pragmata's white edge extends into a
// white bg, RE3's dark sky stays dark at the top + dark ground at the
// bottom, Cyberpunk's yellow continues yellow. Closest non-AI technique
// to "the bg looks like an extension of the hero."
//
// What it WON'T do: extend detail content from the middle of the asset
// (RE3's cityscape is in the middle, not the leftmost zone — the
// extended bg will be dark atmospheric bands at the cityscape's
// vertical position, not a continued cityscape). True content-aware
// extension requires AI outpainting.
//
// Why a 200px-wide sample (and not just the leftmost 12px column):
// many assets have localized content reaching into the very edge
// (Where Winds Meet's red lanterns at y=~80, Tomb Raider's bright
// dust, Metal Gear Rising's sparks). A narrow-column sample preserves
// those highlights as hard horizontal streaks across the entire 1920px
// stretch. Sampling 200px and resizing to width=1 horizontally averages
// each row of asset content — a localized lantern becomes a softer
// warm tint averaged with the surrounding darker pixels, not a sharp
// red bar. Clean-edge assets (Pragmata's uniform white border) are
// unaffected because all 200 columns are already the same color.
//
// Pipeline: extract leftmost 200px → resize to 1×H (horizontal averaging
// per row) → stretch to 1920×H with fit:fill → light gaussian blur to
// soften remaining vertical highlights → webp.
export async function generatePaletteGradient(input: Buffer): Promise<Buffer> {
  const meta = await sharp(input).metadata();
  const sourceHeight = meta.height ?? 620;
  const rowAverages = await sharp(input)
    .extract({ left: 0, top: 0, width: 200, height: sourceHeight })
    .resize({ width: 1, height: sourceHeight, fit: "fill" })
    .toBuffer();
  return sharp(rowAverages)
    .resize({ width: 1920, height: sourceHeight, fit: "fill" })
    .blur(35)
    .webp({ quality: 70 })
    .toBuffer();
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
