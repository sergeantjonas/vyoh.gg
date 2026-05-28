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
