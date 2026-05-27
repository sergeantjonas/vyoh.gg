// Feature-detect CSS Anchor Positioning, lazy-loading the Oddbird polyfill only
// when the engine lacks it. Returns a singleton promise so multiple call sites
// share one resolution and the polyfill is never applied twice.
//
// "native"      → engine supports `anchor-name`; nothing else to do.
// "polyfill"    → Oddbird polyfill loaded and applied successfully.
// "unavailable" → polyfill import or apply failed; consumer must fall back.
//
// The polyfill is imported from "@oddbird/css-anchor-positioning/fn" — the
// functional subpath — so we only run it after the feature-detect proves it's
// needed. The bare entry would auto-apply on import, defeating the lazy path.

type AnchorPositioningSupport = "native" | "polyfill" | "unavailable";

let resultPromise: Promise<AnchorPositioningSupport> | null = null;

export function ensureAnchorPositioning(): Promise<AnchorPositioningSupport> {
  if (resultPromise) return resultPromise;

  resultPromise = (async () => {
    if (typeof CSS !== "undefined" && CSS.supports?.("anchor-name", "--x")) {
      return "native";
    }
    try {
      const mod = await import("@oddbird/css-anchor-positioning/fn");
      await mod.default();
      return "polyfill";
    } catch {
      return "unavailable";
    }
  })();

  return resultPromise;
}
