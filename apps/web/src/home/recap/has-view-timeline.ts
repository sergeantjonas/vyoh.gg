// Runtime engine gate for CSS `animation-timeline: view()`. Chrome 115+
// and Safari 26+ expose the `ViewTimeline` constructor on `window`;
// Firefox 2026 still gates the scroll-driven-animations module behind
// `layout.css.scroll-driven-animations.enabled` and does NOT expose the
// constructor even when `CSS.supports("animation-timeline: view()")`
// returns true — the supports query lies on Firefox. The `in` check is
// the only reliable runtime gate.
//
// Module-level evaluation: the value can't change at runtime (a browser
// doesn't gain or lose `ViewTimeline` support mid-session), so we read
// once and freeze. SSR-safe via `typeof window` guard.
//
// Lives in its own module so the chapter-beat test can mock it cleanly
// without going through `vi.stubGlobal` / `vi.resetModules` gymnastics.
export const HAS_VIEW_TIMELINE =
  typeof window !== "undefined" && "ViewTimeline" in window;
