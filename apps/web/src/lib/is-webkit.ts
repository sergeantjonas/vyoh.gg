// WebKit engine detection. Use sparingly — feature detection beats UA sniffing
// in almost every case — but for "this engine has expensive VT snapshot
// capture" there is no feature probe, so we gate by engine.
//
// `navigator.vendor === "Apple Computer, Inc."` is the cleanest signal:
//   - macOS / iPadOS / iOS Safari: "Apple Computer, Inc."
//   - iOS Chrome / Firefox / Edge: also "Apple Computer, Inc." (all WKWebView)
//   - Desktop Chrome / Edge: "Google Inc."
//   - Desktop Firefox: "" (empty)
// Catching iOS Chrome/Firefox is what we want — they share the engine and the
// snapshot cost.
//
// Cached at module load. Memoising avoids paying for the navigator read on
// every router classification call; `navigator.vendor` is not expected to
// change at runtime.
const cached: boolean =
  typeof navigator !== "undefined" && navigator.vendor === "Apple Computer, Inc.";

export function isWebKit(): boolean {
  return cached;
}
