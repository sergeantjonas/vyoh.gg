# Anchor-positioned overlays

**Status:** Active — positioning pivoted twice on 2026-05-28: CSS Anchor Positioning → Floating UI → continuous `requestAnimationFrame` loop with direct DOM mutation (the only mechanism that produced correct positioning across Firefox + Safari in every entry direction and across cmdk list re-flows). Chunks 1, 2, 3a, 3b, 3c, 3d shipped 2026-05-27 → 2026-05-28; Chunk 5 (polyfill loader wiring) descoped. Chunk 1: `ensureAnchorPositioning()` feature-detect + lazy Oddbird `/fn` loader at [apps/web/src/lib/anchor-positioning.ts](../../../apps/web/src/lib/anchor-positioning.ts) — kept as a future-migration hook, no longer consumed. Chunk 2: `<CommandPalettePreview>` shell positions via a body-portalled card whose `top`/`left` are written each frame from the focused cmdk row's `getBoundingClientRect()`; row node is re-queried inside the rAF tick to survive cmdk's mid-stream list re-renders. Chunk 3a: sentinel-prefix parser ([command-palette-preview-value.ts](../../../apps/web/src/components/command-palette-preview-value.ts)) lets the preview dispatch on `<type>:<id>` row values; champion/match/steam-game `CommandItem` values migrated. Chunk 3b: champion preview content ([command-palette-preview-champion.tsx](../../../apps/web/src/components/command-palette-preview-champion.tsx)) — icon + display name + roles + modern-class chips, sourced from already-mounted `useChampionInfo`. Chunk 3c: match preview content ([command-palette-preview-match.tsx](../../../apps/web/src/components/command-palette-preview-match.tsx)) — champion icon + KDA + queue + duration + relative time + Win/Loss chip, sourced from the dialog's lifted `allMatches`. Chunk 3d: Steam-game preview content ([command-palette-preview-steam-game.tsx](../../../apps/web/src/components/command-palette-preview-steam-game.tsx)) — capsule + name + developer + lifetime/last-played + optional achievement %, all from queryClient cache hits. Also fixed on 2026-05-28: a related cmdk arrow-key `scrollIntoView` bug that left the highlighted row below the list viewport; corrective rAF-deferred `scrollTop` pass in CommandPaletteDialog now keeps the row in view across the full list. Chunks 4 (collision-aware flip — partially landed via earlier `flip()` work), 6 (Steam library hover-card), 7 (match-row peek) remain pending. Part of [elevation-arcs.md](elevation-arcs.md) Tier 2. CSS Anchor Positioning ([`anchor-name`](https://developer.mozilla.org/en-US/docs/Web/CSS/anchor-name) / [`position-anchor`](https://developer.mozilla.org/en-US/docs/Web/CSS/position-anchor) / [`@position-try`](https://developer.mozilla.org/en-US/docs/Web/CSS/@position-try)) for the command-palette result peek and a small set of follow-on-scroll overlays, with a feature-detect + Oddbird polyfill fallback for older browsers.

Read this before adding any overlay that should track its trigger across scroll/resize/zoom, or that needs collision-aware fallback positions.

## 2026-05-28 retrospective — why Floating UI instead

The arc originally targeted CSS Anchor Positioning end-to-end (`anchor-name` / `position-anchor` / `anchor()` / `@position-try`) with the Oddbird polyfill covering Firefox-without-flag. Three iterations of the `.palette-preview` rule (logical `inset-block-start: anchor(start)` → physical `top: anchor(top)` → physical with explicit anchor-name `top: anchor(--palette-focused-row top)`) all produced misaligned computed positions across **both** Firefox (native) and Safari (polyfill). MDN browser-support data also turned out to be the opposite of what the original arc note stated — Firefox had native support by 2026-05-28; Chrome/Edge/Safari are listed as Limited Availability. Native-engine output of `top: 300.3px; left: 1368px` for the focused Ahri row (DevTools verified) confirmed the issue was the CSS shape itself, not the polyfill.

Three CSS-fix attempts without converging signaled diminishing returns. Switched to Floating UI's `useFloating` + `autoUpdate` for ship reliability:

- Same dependency tree footprint (already transitive via Radix Popper).
- Handles Chunks 4 (`flip()` middleware), 6 (`autoUpdate` for hover-card scroll tracking), 7 (same) without new code paths.
- TanStack Start migration risk: zero. All arc surfaces are interactive-only (dialog / hover), so no SSR position rendering required.
- Polyfill loader kept at [apps/web/src/lib/anchor-positioning.ts](../../../apps/web/src/lib/anchor-positioning.ts) as a future hook for if CSS Anchor Positioning support consolidates and a future migration becomes attractive.

Honest engineering trade: portfolio narrative loses the "uses bleeding-edge CSS feature" angle but gains a credible "tried, hit cross-browser quirks, made the call to ship reliably with Floating UI" story — the kind of judgment that the freelance positioning is actually selling.

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

### Chunk 1 — Feature-detect + polyfill loader ✅ shipped 2026-05-27

Landed at [apps/web/src/lib/anchor-positioning.ts](../../../apps/web/src/lib/anchor-positioning.ts) + colocated test. The actual shape differs slightly from the original sketch below — the import path is `@oddbird/css-anchor-positioning/fn` (functional subpath), not the bare entry. The bare entry auto-applies on import and would defeat the lazy gate; the `/fn` subpath exposes the manual `polyfill()` function as default per the package's `exports` map. The cached value is a `Promise<"native" | "polyfill" | "unavailable">` (not a polyfill-loaded flag), so a single singleton serves all four states.

Original sketch (kept for trail-of-evidence):

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

### Chunk 2 — Palette preview component shell ✅ shipped 2026-05-27

Landed at [apps/web/src/components/command-palette-preview.tsx](../../../apps/web/src/components/command-palette-preview.tsx) + colocated test, mounted in [command-palette-dialog.tsx](../../../apps/web/src/components/command-palette-dialog.tsx) via `<CommandPalettePreview value={highlighted} />`. The preview reads from the existing `highlighted` cmdk state (already lifted out of cmdk via `value`/`onValueChange` on the Command root for the chord handler) and renders the value twice as a smoke test.

Two implementation calls that differed from the original sketch (kept rationale here as trail-of-evidence):

- **`anchor-name` via a global CSS attribute selector, not inline style.** The arc note originally asked for inline `anchor-name` toggled per-row via React state. Implementing that would require threading a `style` prop through every `CommandItem` call site (~7 surfaces). cmdk already sets `data-selected="true"` on the highlighted item, driven by the same React state we lifted (`value`/`onValueChange`) — so `[cmdk-list] [cmdk-item][data-selected="true"] { anchor-name: --palette-focused-row }` in [index.css](../../../apps/web/src/index.css) is equivalent React-state-driven behavior with zero call-site churn. Only one item ever has `data-selected="true"` at a time, so there's no need for an explicit `anchor-name: none` reset on the others.
- **`.palette-preview` class, not inline style on the card.** happy-dom drops anchor-positioning properties from `style.cssText`, which makes inline-style assertions untestable. Centralising `position-anchor` + `inset-block-start` + `inset-inline-start` in the `.palette-preview` rule makes the class the testable contract AND positions Chunk 4 to extend the same rule with `position-try-fallbacks` — no second migration needed.

Original sketch:

```ts
// inline anchor-name toggled per CommandItem render
<CommandItem style={{ anchorName: isFocused ? "--palette-focused-row" : "none" }} />
```

What shipped:

```css
[cmdk-list] [cmdk-item][data-selected="true"] {
  anchor-name: --palette-focused-row;
}
.palette-preview {
  position: fixed;
  position-anchor: --palette-focused-row;
  inset-block-start: anchor(start);
  inset-inline-start: calc(anchor(end) + 12px);
}
```

Tests: preview renders nothing when value is empty, renders the value twice when non-empty, applies the `.palette-preview` class; dialog-level test types a query and asserts the preview's text reflects the auto-focused first result.

### Chunk 3 — Real preview content for champion / match / game

Split into 4 sub-chunks for incremental visual verification:

- **3a — Dispatch shell ✅ shipped 2026-05-28.** [command-palette-preview-value.ts](../../../apps/web/src/components/command-palette-preview-value.ts) parses `<type>:<id> <…tokens>` sentinel-prefixed CommandItem `value` strings into a typed descriptor (`{ type: "champion" | "match" | "steam-game" | "account" | "other", id }`). `CommandPalettePreview` switches on `parsed.type` and falls back to `null` for "other" (pages, tabs, recents). Champion/match/steam-game `CommandItem` values in `command-palette-dialog.tsx` migrated to the prefix; the existing `ACCOUNT_VALUE_PREFIX` chord pattern stays unchanged. Safe because the dialog passes `shouldFilter={false}` and uses its own `passesFreeText` against an explicit haystack, not the cmdk value — the prefix never reaches the filter.
- **3b — Champion preview content ✅ shipped 2026-05-28.** [command-palette-preview-champion.tsx](../../../apps/web/src/components/command-palette-preview-champion.tsx) reads `useChampionInfo(alias)` (already mounted by the dialog's filter logic, so no new fetch) and renders icon (`ChampionSquareIcon`, size-12) + display name + roles + modern-class chips. Returns `null` while champion data is still loading. No description field exists on `ChampionInfo` — the visual density comes from roles + classes.
- **3c — Match preview content ✅ shipped 2026-05-28.** [command-palette-preview-match.tsx](../../../apps/web/src/components/command-palette-preview-match.tsx) renders champion icon + display name + queue + KDA (raw + ratio) + duration + relative time + a Win/Loss chip. Takes an already-resolved `MatchSummary` prop — the dialog already lifts `allMatches` from the infinite-query cache and passes it through to the dispatcher, which does the `m.matchId === parsed.matchId` lookup, so the preview component itself stays presentational.
- **3d — Steam game preview content ✅ shipped 2026-05-28.** [command-palette-preview-steam-game.tsx](../../../apps/web/src/components/command-palette-preview-steam-game.tsx) reads `queryClient.getQueryData<SteamOwnedGames>(["steam", "owned-games"])` and `<SteamLibraryCompletion>(["steam", "achievements", "library-completion"])` directly (both globally cached for any Steam session). Renders library capsule + name + developer + lifetime playtime + last-played relative + achievement %. Achievement % is gracefully omitted when the completion cache is cold.

Prefetch-on-arrow-nav (~50ms head start) deferred — all three content types are now cache-warm by the time the palette opens, so the perceived savings is small enough to not justify the extra wiring.

Tests cover the parser (6 specs) + dispatch (9 specs, including match-with/without-cache and steam-game) + champion content (4 specs) + match content (5 specs) + steam-game content (6 specs) + an end-to-end dialog test that types a champion name and asserts the preview's `data-preview-type="champion"` + displayed name.

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

### Chunk 5 — Polyfill loader wiring ✅ shipped 2026-05-28

`CommandPaletteDialog` calls `ensureAnchorPositioning()` in a `useLayoutEffect` keyed on `open` so the Oddbird polyfill loads (and applies) the first time the palette opens on an engine without native anchor positioning (Firefox without flag, pre-26 Safari). Singleton-promise inside the lib ensures repeated opens are cheap.

The "polyfill `unavailable` → render inline inside focused row" fallback from the original sketch is **descoped**: Oddbird ships in every modern browser the polyfill targets, and the unavailable branch in practice means a transient network failure where retrying on next open is fine. If unavailability shows up in real telemetry, revisit.

Two side-fixes landed in the same arc:
- `CommandPalettePreview` portals to `document.body` via `createPortal`. Radix `DialogContent` applies `transform: translate(-50%, -50%)` for centering, which establishes a containing block for `position: fixed` descendants AND combines with `overflow-hidden` to clip anything that escapes the dialog rect. Portalling to the body level moves the preview's containing block to the viewport so anchor positioning resolves against viewport coordinates and the card isn't clipped.
- `.palette-preview` CSS rule rewritten to use physical sides + explicit anchor-name reference (`top: anchor(--palette-focused-row top); left: calc(anchor(--palette-focused-row right) + 12px)`) instead of logical `inset-block-start: anchor(start)` / `inset-inline-start: anchor(end)`. The logical-side shorthand produced an unanchored fallback position during initial Safari + Firefox testing on 2026-05-28 even with the portal fix — switching to physical sides + explicit name made the resolution reliable across both engines.

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
