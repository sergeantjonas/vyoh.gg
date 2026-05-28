// AV1 decode support feature-detect. Cached at module load — `MediaSource`'s
// codec answer doesn't change at runtime in any browser. Used by the trailer
// modal's variant picker so AV1-capable browsers get the better
// quality-per-byte stream, and everyone else falls through to H.264.
//
// Codec string: `av01.0.05M.08` is the standard "Main profile, level 5.0,
// 8-bit" descriptor — what Steam encodes its `dash_av1` variants to. Other
// AV1 profile strings exist; we test the one we'd actually play.
//
// `MediaSource.isTypeSupported` is the Shaka-friendly probe — Shaka uses
// the same API internally before deciding to attach a stream. Skips
// hand-rolling a `<video canPlayType>` call which gives weaker answers
// (returns "maybe" / "probably" / "" rather than a hard bool).
const cached: boolean = (() => {
  if (typeof MediaSource === "undefined") return false;
  return MediaSource.isTypeSupported('video/mp4; codecs="av01.0.05M.08"');
})();

export function supportsAv1(): boolean {
  return cached;
}
