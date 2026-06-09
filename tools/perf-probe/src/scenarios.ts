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
];
