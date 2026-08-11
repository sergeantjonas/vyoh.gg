// Scenario definitions for `pnpm --filter @vyoh/tools-perf-probe probe`.
// Each scenario describes a route and (optionally) an interaction to perform
// after cold-load, so the probe can capture both first-paint and the cost of
// the interaction itself (panel open, tab switch, etc.).

export interface ScreenshotMoment {
  // Human-readable label; becomes the screenshot filename stem.
  name: string;
  // Capture timing relative to the previous step:
  //   "load"           — immediately after route entry, post-LCP
  //   "post-open"      — after openSelector has been clicked + settled
  //   "post-close"     — after closeSelector has been clicked + settled
  //   "scroll-bottom"  — after scrolling main to its bottom and settling
  phase: "load" | "post-open" | "post-close" | "scroll-bottom";
  // Optional extra wait after the phase trigger before the shot lands.
  // Use to clear in-flight animations (Motion easing, AnimatePresence exits).
  settleMs?: number;
}

export interface Scenario {
  // CLI handle: `--scenario <name>`.
  name: string;
  // Path appended to the dev-server origin. Owner slug is wired into routes
  // that need it.
  path: string;
  // Selector clicked after cold-load. Captures the open transition cost.
  openSelector?: string;
  // Selector clicked after open to dismiss the panel/overlay. Captures the
  // close transition cost (the panel-arc trace showed close-phase was the
  // most diagnostic — layer count after panel unmount reveals what the host
  // route is structurally carrying).
  closeSelector?: string;
  screenshotMoments: ScreenshotMoment[];
}

// Owner slug. Mirrors the primary owner from apps/api/accounts.json.
const OWNER_SLUG = "ahri";

export const SCENARIOS: Scenario[] = [
  {
    name: "lol-overview",
    path: `/lol/${OWNER_SLUG}`,
    screenshotMoments: [
      { name: "01-load", phase: "load", settleMs: 500 },
      { name: "02-scroll-bottom", phase: "scroll-bottom", settleMs: 500 },
    ],
  },
  {
    name: "lol-champion-panel",
    // The panel is opened by clicking the first row in the champion table.
    // We land on the champions list first, then click the first VT row link.
    // No data-test attributes in production — selectors target real DOM.
    // Close uses Radix DialogPrimitive.Close in _shared/slide-panel.tsx.
    path: `/lol/${OWNER_SLUG}/champions`,
    openSelector: '[data-list-item-vt] a[href*="/champions/"]',
    closeSelector: '[aria-label="Close panel"]',
    screenshotMoments: [
      { name: "01-load", phase: "load", settleMs: 500 },
      { name: "02-panel-open", phase: "post-open", settleMs: 750 },
      { name: "03-panel-close", phase: "post-close", settleMs: 750 },
    ],
  },
  {
    // The two editorial hero bands plus nine frosted chips, all primed in the
    // route loader. The heaviest reading surface in the Steam section.
    name: "steam-portrait",
    path: "/steam/portrait",
    screenshotMoments: [
      { name: "01-load", phase: "load", settleMs: 750 },
      { name: "02-scroll-bottom", phase: "scroll-bottom", settleMs: 500 },
    ],
  },
  {
    // The Steam *profile* page, not `/steam/library`. The handle predates that
    // route existing and is kept so the historical baselines in
    // progressive-paint-audit.md still line up; the virtualised library route
    // has no scenario of its own.
    name: "steam-library",
    path: "/steam",
    screenshotMoments: [
      { name: "01-load", phase: "load", settleMs: 500 },
      { name: "02-scroll-bottom", phase: "scroll-bottom", settleMs: 500 },
    ],
  },
  {
    name: "recap",
    path: "/",
    screenshotMoments: [
      { name: "01-load", phase: "load", settleMs: 500 },
      { name: "02-scroll-bottom", phase: "scroll-bottom", settleMs: 1000 },
    ],
  },
  {
    // The per-account LoL recap: seven frosted chapter wrappers over the
    // champion splash claim, opened by the season-thread artwork band (inline
    // SVG, one element per match). Load settle covers the band's ~1.7 s
    // clip-path draw-on cascade so the shot and the phase both capture the
    // settled page, entrance raster included.
    name: "lol-recap",
    path: `/lol/${OWNER_SLUG}/recap`,
    screenshotMoments: [
      { name: "01-load", phase: "load", settleMs: 2000 },
      { name: "02-scroll-bottom", phase: "scroll-bottom", settleMs: 1000 },
    ],
  },
  {
    // Patch-notes route pinned to a representative *big* patch (26.3: 41
    // champion + 9 item + 3 rune changes — largest in the DB as of 2026-06-12).
    // The newest patch is often small, which would understate the V3 identity
    // pass's frost/splash cost; pin the heavyweight so the budget reflects the
    // worst case. `?as=` opts into the personalized lens (play-count sort),
    // matching how the owner actually lands here from profile deeplinks.
    name: "lol-patches",
    path: `/lol/patches/26.3?as=${OWNER_SLUG}`,
    screenshotMoments: [
      { name: "01-load", phase: "load", settleMs: 500 },
      { name: "02-scroll-bottom", phase: "scroll-bottom", settleMs: 500 },
    ],
  },
  {
    // The release timeline. Carries the layer-promoting CSS: the frosted calendar
    // wrapper + the imminent hero's backdrop lease (swaps the page-wide Steam
    // backdrop) + the hero/calendar Motion entrances. settleMs on load clears the
    // hero cascade before the shot. The handle keeps its pre-split name so the
    // baseline stays comparable; the view is no longer a tab of the wishlist.
    name: "wishlist-upcoming",
    path: "/steam/upcoming",
    screenshotMoments: [
      { name: "01-load", phase: "load", settleMs: 750 },
      { name: "02-scroll-bottom", phase: "scroll-bottom", settleMs: 500 },
    ],
  },
];
