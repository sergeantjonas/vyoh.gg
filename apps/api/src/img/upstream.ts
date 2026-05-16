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
  quality?: number;
  blur?: number;
}

export async function transcodeToWebp(
  input: Buffer,
  params: TranscodeParams = {}
): Promise<Buffer> {
  const { width, quality = 85, blur } = params;
  let pipeline = sharp(input);
  if (width) pipeline = pipeline.resize({ width, withoutEnlargement: true });
  if (blur !== undefined) pipeline = pipeline.blur(blur);
  return pipeline.webp({ quality }).toBuffer();
}
