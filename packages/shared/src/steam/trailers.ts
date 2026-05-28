// One full-length trailer for a Steam game, projected from
// `IStoreBrowseService/GetItems.trailers.highlights[]`. Persisted as JSON in
// `SteamGameEnrichment.trailersJson` and surfaced on `SteamOwnedGame.trailers`.
// The trailer modal hydrates this array client-side and picks the best
// `AdaptiveTrailer` per browser at play time.
//
// Why a flat per-highlight shape rather than the upstream nested form: the
// raw payload mixes the microtrailer sub-array, the adaptive sub-array, the
// poster fields, and editorial metadata at different depths. Flattening at
// projection time means every consumer reads the same shape and the modal
// doesn't have to re-derive codec arrays per click.
export interface SteamAdaptiveTrailer {
  // CDN-relative path under `https://video.akamai.steamstatic.com/store_trailers/`.
  // Shape: `{appid}/{movieid}/{hash}/{ts}/{filename.(mpd|m3u8)}`. Segment
  // files referenced inside the manifest (DASH `.m4s` chunks, HLS variant
  // playlists + `.ts` chunks) sit alongside it on the same CDN.
  cdnPath: string;
  // Upstream-supplied codec/container tag. Known values: `dash_av1`,
  // `dash_h264`, `hls_h264`. Modal picks based on browser support — Safari
  // gets HLS for native playback; AV1-capable Chrome/Firefox prefer
  // `dash_av1` for the better quality-per-byte ratio.
  encoding: string;
}

// Direct CDN base. Trailer assets (microtrailers + adaptive manifests +
// segment files referenced inside the manifests) are served with
// `Access-Control-Allow-Origin: *`, so the browser can fetch them straight
// from Steam. Skipping the proxy avoids one redundant network hop per
// segment (DASH/HLS trailers fetch 30+ segments) AND avoids maintaining a
// segment-file proxy route for every codec subdir Steam might add.
//
// Same approach as `steamScreenshotThumbUrl` (also direct CDN); contrast
// with capsule/hero which DO route through the proxy because Sharp WebP
// transcoding happens there.
const TRAILER_CDN_BASE = "https://video.akamai.steamstatic.com/store_trailers";

export function steamTrailerCdnUrl(cdnPath: string): string {
  return `${TRAILER_CDN_BASE}/${cdnPath}`;
}

// Pick the best adaptive variant for the current browser. Order:
// 1. Safari → HLS (Shaka uses Safari's native player; smoother than MSE-on-Safari).
// 2. AV1-capable Blink/Gecko → DASH AV1 (smaller byte size, sharper at the same bitrate).
// 3. Anything else → DASH H.264 (universally decodable).
// 4. No adaptive variants at all → null; renderer falls back to playing
//    `microtrailerMp4` as a static `<video>` (no audio, no quality switching).
export function pickAdaptiveTrailer(
  variants: SteamAdaptiveTrailer[],
  detect: { isSafari: boolean; supportsAv1: boolean }
): SteamAdaptiveTrailer | null {
  if (variants.length === 0) return null;
  const byEncoding = new Map(variants.map((v) => [v.encoding, v]));
  // Safari never gets AV1 — desktop Safari's AV1 support is recent and
  // patchy, iOS Safari doesn't have it at all, and HLS is the native path
  // anyway. Always prefer HLS, then h264 DASH, then whatever's there.
  if (detect.isSafari) {
    return (
      byEncoding.get("hls_h264") ?? byEncoding.get("dash_h264") ?? variants[0] ?? null
    );
  }
  if (detect.supportsAv1) {
    const av1 = byEncoding.get("dash_av1");
    if (av1) return av1;
  }
  return byEncoding.get("dash_h264") ?? byEncoding.get("hls_h264") ?? variants[0] ?? null;
}

export interface SteamGameTrailer {
  // Editorial label as the publisher wrote it. Often a long internal id
  // (`07【RE4】_GELaunchPV_…`) rather than a clean title; the modal trims
  // visually but still surfaces it for screen readers.
  trailerName: string | null;
  // Steam's internal category id for the trailer. Surfaced for future
  // grouping but not displayed today (unstable label across locales).
  trailerCategory: number | null;
  // `false` means Steam gates the trailer behind its maturity toggle. The
  // modal should refuse playback when this is false and the viewer hasn't
  // opted in. `null` means the field was missing on the upstream entry —
  // treat as `true` to avoid over-gating on missing metadata.
  allAges: boolean | null;
  // 6-second silent loop. Same fields as the flat columns on the row —
  // duplicated here so multi-trailer consumers see each highlight's loop
  // (not just `highlights[0]`).
  microtrailerWebm: string | null;
  microtrailerMp4: string | null;
  // Poster derivatives. `screenshotMedium` is the 293×165 thumbnail used as
  // the microtrailer's static `<video poster=…>` and the carousel chip;
  // `screenshotFull` is the `movie_full.jpg` derivative shown in the modal
  // loading state and the storefront's own lightbox header.
  screenshotMedium: string | null;
  screenshotFull: string | null;
  // Adaptive-stream manifests. Empty when the trailer hasn't been
  // transcoded — modal falls back to playing the microtrailer.mp4 at
  // 1× (no adaptive switching, no audio, but better than nothing).
  adaptiveTrailers: SteamAdaptiveTrailer[];
}
