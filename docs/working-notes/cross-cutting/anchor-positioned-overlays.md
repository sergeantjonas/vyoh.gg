# Anchor-positioned overlays

**Status:** Planned. Part of [elevation-arcs.md](elevation-arcs.md) Tier 2. CSS Anchor Positioning ([`anchor-name`](https://developer.mozilla.org/en-US/docs/Web/CSS/anchor-name) / [`position-anchor`](https://developer.mozilla.org/en-US/docs/Web/CSS/position-anchor) / [`@position-try`](https://developer.mozilla.org/en-US/docs/Web/CSS/@position-try)) for the command-palette result peek and a small set of follow-on-scroll overlays, with a feature-detect + Oddbird polyfill fallback for older browsers.

Read this before adding any overlay that should track its trigger across scroll/resize/zoom, or that needs collision-aware fallback positions.

KB anchors: [01-css-and-styling.md §anchor positioning](~/.claude/knowledge/frontend-2026/01-css-and-styling.md). MDN: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_anchor_positioning.

---

## Why

The command palette ([command-palette.md](command-palette.md)) is the project's single "find-anything surface." Today, selecting `champion: jinx` returns a result row; selecting it navigates. There's no preview. A live preview *next to* the result row — splash thumbnail, win rate, recent form pips — is the cheapest move that pays off the "single find-anything surface" framing: it teaches the user the palette is a viewer, not just a switcher.

The preview must:
1. Anchor to the focused result row.
2. Follow as the user arrows up/down through results (anchor changes).
3. Stay correctly positioned through dialog resize / virtual-scrolling.
4. Flip to the other side when the row is near the dialog edge.

Doing this with JS (Floating UI, manual `getBoundingClientRect` polling) is heavier than the CSS-native equivalent. CSS Anchor Positioning is **Newly Available in 2024–2025**: Chrome 125+, Safari 26+. Firefox is the laggard (still flagged); the Oddbird polyfill covers the gap but is ~10kB gz so only lazy-load when needed.

Beyond the palette, two adjacent overlays benefit:
- **Hover cards that should track during scroll**: Steam library hover cards today probably reposition awkwardly mid-scroll. Anchor positioning fixes this for free.
- **Match-row peek**: hovering a match row could anchor a small "scoreboard at a glance" overlay; same primitive.

---

## What this is NOT

- **Not a replacement for Radix `Popper`.** Radix uses Floating UI under the hood — robust, cross-browser. This arc is additive: surfaces that *benefit* specifically from "follows the anchor through any container scroll" use anchor positioning; the rest stay on Radix.
- **Not anchor-positioned tooltips.** Tooltips are short-lived; the existing TooltipPrimitive is fine and used uniformly per [repo-conventions.md §TooltipPrimitive](../../repo-conventions.md).
- **Not a polyfill-first approach.** Feature-detect first; load polyfill only when needed; never ship to users who don't need it.

---

## Browser-support stance

Per [01-css-and-styling.md](~/.claude/knowledge/frontend-2026/01-css-and-styling.md) and caniuse (verify at pickup):

| Feature | Chrome | Safari | Firefox |
|---|---|---|---|
| `anchor-name` / `position-anchor` | 125+ | 26+ | Behind `layout.css.anchor-positioning.enabled` |
| `@position-try` | 125+ | 18.4+ (partial) | Same flag |
| `anchor()` function in `inset`/`width` | 125+ | 26+ | Same flag |

**Detection**: `CSS.supports('anchor-name', '--x')`. Branch on this in the JS that decides whether to load the [Oddbird polyfill](https://github.com/oddbird/css-anchor-positioning) (~10kB gz).

**Fallback**: when neither native nor polyfill is feasible (or while the polyfill is loading), fall back to Floating UI via Radix `Popper` — the palette already uses Radix; the preview can render in a Radix `HoverCard` aligned to the focused row using `useFloating` from `@floating-ui/react`.

---

## Target outcome

### Command palette result peek

- Open ⌘K, type a query.
- Arrow through results; **for each result that has a preview-able entity** (champion, match, game), a card slides into view to the right of the result row showing:
  - **Champion**: square icon, name, top 3 stats (WR, KDA, games), recent-form pips.
  - **Match**: champion icon, KDA, queue, duration, date, outcome chip.
  - **Game (Steam)**: capsule art, last-played, total playtime, achievement %.
- Card anchors to the focused row; follows arrow nav.
- Card flips to the left side when the focused row is in the right half of the dialog.
- Card has its own ~150ms entry transition (composes with [mount-and-overlay-motion.md](mount-and-overlay-motion.md) overlay patterns).

### Steam library hover card scroll-tracking

- Today's Radix HoverCard on library tiles likely repositions on scroll via Floating UI's middleware. Verify; if it's not anchored, switch to anchor positioning so it tracks the tile continuously.

### Match-row peek (optional, depends on data)

- Hovering a match row anchors a "scoreboard at a glance" overlay showing all 10 players + KDA + items. Cheaper UX than navigating to the detail page for a quick check.

---

## Chunked plan

### Chunk 1 — Feature-detect + polyfill loader

New file `apps/web/src/lib/anchor-positioning.ts`:

```ts
let polyfillPromise: Promise<unknown> | null = null;

export async function ensureAnchorPositioning(): Promise<"native" | "polyfill" | "unavailable"> {
  if (typeof CSS !== "undefined" && CSS.supports?.("anchor-name", "--x")) return "native";
  if (!polyfillPromise) {
    polyfillPromise = import("@oddbird/css-anchor-positioning")
      .then((mod) => mod.default())
      .catch(() => null);
  }
  const loaded = await polyfillPromise;
  return loaded ? "polyfill" : "unavailable";
}
```

Test: `CSS.supports` mocked both ways; polyfill import branch tested with `vi.mock`.

### Chunk 2 — Palette preview component shell

- New file `apps/web/src/components/command-palette-preview.tsx`.
- Reads the focused result from the palette's existing focused-index state.
- Renders the preview card with `position-anchor: --palette-focused-row` inline.
- For now, no actual entity preview — just render the result label twice as a smoke test. Validates the anchor-positioning wiring before adding content.

The result rows need `anchor-name: --palette-focused-row` set inline **on the focused row only** (others have `anchor-name: none`). Toggle via React state in the palette's existing focus management.

Test: focusing different rows updates which row has the anchor-name.

### Chunk 3 — Real preview content for champion / match / game

- Per-entity-type preview content components.
- Lazy-load (per entity type) so the palette stays light when the preview is unused.
- Data: reuse TanStack Query for cached entity data; trigger prefetch when the user starts navigating with arrow keys (gives ~50ms head start vs. on-focus).

### Chunk 4 — Position-try fallback positions

```css
.palette-preview {
  position: fixed;
  position-anchor: --palette-focused-row;
  inset-block-start: anchor(start);
  inset-inline-start: calc(anchor(end) + 12px);
  position-try-fallbacks: --flip-block, --flip-inline;
}

@position-try --flip-inline {
  inset-inline-start: auto;
  inset-inline-end: calc(anchor(start) + 12px);
}

@position-try --flip-block {
  inset-block-start: auto;
  inset-block-end: anchor(end);
}
```

Test: visual on a small viewport — preview flips when the focused row is near the right edge.

### Chunk 5 — Polyfill fallback path

- Branch: if `ensureAnchorPositioning()` returns `"unavailable"`, render the preview inside the focused row inline (less elegant but functional).
- This is the Firefox-without-flag case; minimise design effort.

### Chunk 6 — Apply to Steam library hover card

- Audit current behavior — is the HoverCard already correctly tracking? If yes, no change needed. If not, swap to anchor positioning on tiles that have `anchor-name: --tile-${appId}` and a HoverCard content with `position-anchor`.

### Chunk 7 — (Optional) Match-row peek

- Defer until palette + Steam hover are validated. The match-row peek is delightful but adds the cost of fetching the scoreboard data for every hover; consider behind a 300ms hover delay.

---

## Files in scope

New:
- `apps/web/src/lib/anchor-positioning.ts` + test
- `apps/web/src/components/command-palette-preview.tsx` + test (and per-entity sub-components)

Modified:
- `apps/web/src/components/command-palette-dialog.tsx` (apply `anchor-name` to focused row, mount preview)
- `apps/web/src/styles/globals.css` (preview position rules + `@position-try` fallbacks)
- Steam library tile + hover-card components (Chunk 6)
- `apps/web/package.json` (add `@oddbird/css-anchor-positioning` as a dependency — but lazy-loaded)

Update [command-palette.md](command-palette.md) with a reference to this arc so the palette chunk list points here.

---

## Risks / open questions

- **Polyfill size + impact.** ~10kB gz isn't trivial. Verify with bundle analysis that it stays out of the initial bundle (lazy import). Acceptable to ship to Firefox users only; not acceptable to inflate Chrome's bundle.
- **Focus state vs hover state.** Palette result preview is **focus-driven** (arrow keys). Steam hover-card is **hover-driven**. These have different timing semantics — focus should anchor immediately; hover wants a 100–200ms delay. Different code paths.
- **Virtualised result lists.** If the palette ever virtualises results, `anchor-name` must be applied to the actual rendered element (not a virtual placeholder). Coordinate with whatever virtualization happens then.
- **Reduced-motion.** Anchor positioning itself is static; entry/exit transitions inherit from [mount-and-overlay-motion.md](mount-and-overlay-motion.md). No new motion concerns.
- **iOS Safari fixed positioning.** Anchor-positioned overlays use `position: fixed` which has historical iOS Safari quirks (keyboard pushing content). Verify on iOS sim with on-screen keyboard active.

---

## Reduced motion

Anchor positioning is layout, not motion. The entry/exit transitions for the preview card use the [mount-and-overlay-motion.md](mount-and-overlay-motion.md) overlay pattern, which is already reduced-motion-aware.
