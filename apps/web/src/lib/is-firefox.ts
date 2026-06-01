// Firefox engine detection. Use sparingly — feature detection beats UA
// sniffing in almost every case — but for "this engine stutters compositing a
// large-bounding-box layer translated by 60vw+ on big windows" there is no
// feature probe, so we gate by engine. Paired class with `is-webkit.ts`.
//
// `navigator.userAgent.includes("Firefox")` catches desktop Firefox plus
// mobile Firefox on Android. On iOS, Firefox wraps WKWebView so its UA also
// reports "FxiOS" but `isWebKit()` already catches that case — there is no
// "Firefox engine" on iOS to worry about here.
//
// Cached at module load. Memoising avoids the navigator read on every
// component render; the UA string does not change at runtime.
const cached: boolean =
  typeof navigator !== "undefined" && navigator.userAgent.includes("Firefox");

export function isFirefox(): boolean {
  return cached;
}
