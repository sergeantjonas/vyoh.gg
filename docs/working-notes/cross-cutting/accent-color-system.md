# Per-route / per-entity accent color system

**Status:** ✅ Shipped 2026-05-26 (core cascade + LoL wiring + hook + meta-color updates). Steam-side wiring (Chunk 6) and the broader sweep (Chunk 5 — scrollbar, focus ring, sparklines, hover sheen) deferred; see [Shipped + deferred](#shipped--deferred) below. Original plan body retained for historical context.

## Shipped + deferred

**Shipped 2026-05-26:**
- **Token cascade** in [apps/web/src/index.css](../../../apps/web/src/index.css) — `--theme-color` primitive + derived `--theme-fg`/`--theme-muted`/`--theme-strong`/`--theme-ring` via `oklch(from …)` relative-color syntax, mirrored in `:root` and `.dark`, plus a `@media (prefers-contrast: more)` ring-opacity bump. Default value `oklch(0.6 0.16 240)` matches the body radial-gradient hue, so un-themed routes are visually unchanged.
- **Tailwind `@theme inline` mappings** — `--color-theme`, `--color-theme-fg/-muted/-strong/-ring` so utilities like `bg-theme`, `text-theme-fg`, `ring-theme-ring` exist.
- **`useThemeColor` hook** at [apps/web/src/lib/use-theme-color.ts](../../../apps/web/src/lib/use-theme-color.ts) — sets `--theme-color` on `<html>` and `<meta name="theme-color">`, restores both on unmount. Tested for set/clear/leak prevention and rapid changes.
- **LoL champion detail wiring** at [apps/web/src/routes/lol/$accountSlug/champions/$championKey.tsx](../../../apps/web/src/routes/lol/$accountSlug/champions/$championKey.tsx) — pulls dominantHex from `championTheme(championKey)`.
- **LoL match detail wiring** at [apps/web/src/routes/lol/$accountSlug/matches/$matchId.tsx](../../../apps/web/src/routes/lol/$accountSlug/matches/$matchId.tsx) — pulls dominantHex from the player's pick.
- **Body radial-gradient swap** (Chunk 5 partial) — replaced the hardcoded `oklch(0.6 0.16 240)` literal with `var(--theme-color)` so the ambient page gradient tracks the route accent.

**Namespace deviation from original plan:** The arc was scoped against `--accent-*`, but `--accent` is already reserved by shadcn (`bg-accent`, `text-accent-foreground` drive neutral hover surfaces in command/select/dropdown-menu primitives). Shipped under `--theme-*` instead, extending the existing per-entity `--theme-color` convention used by `.themed-card`. References to `--accent-*` in the plan below should be read as `--theme-*`.

**Deferred:**
- **Chunk 6 — Steam game detail wiring.** No Steam-side dominant-color pipeline exists. Two paths: (a) build-time palette extraction analogous to LoL's `champion-assets.json` (best long-term), (b) runtime canvas sampling of the hero image (cheaper, cross-origin gotchas). Defer until a Steam asset-prep arc lands. Steam routes currently render with the default `oklch(0.6 0.16 240)` accent. Tracked as [steam-lol-parity.md Item 6](steam-lol-parity.md#item-6--per-game-accent-color-on-steam-game-detail) — the parity tracker is the canonical owner.
- **Chunk 5 — broader sweep.** Only the body radial gradient was swept. Per-site judgement still needed for: scrollbar thumb tint (likely best left grey — colour-flipping on every nav reads as noise), focus ring `--ring` (would tint shadcn's primary ring across unthemed surfaces too — needs scoping), Recharts strokes in sparklines, hover sheen on tiles. Re-pick these one-by-one when scoping data-viz-densification.

**Pickup path for the deferred Chunk 5 sweep:** [data-viz-densification.md](data-viz-densification.md) is the natural home — its sparkline component, `:has()` outline rules, and ambient-hue-drift section all already reference theme tokens (updated 2026-05-26 to use the `--theme-*` namespace). When that arc gets picked up, the per-surface accent wiring lands incidentally.

**Original 7-chunk plan retained below for context.**

---

**Status (historical):** Planned. Part of [elevation-arcs.md](elevation-arcs.md) Tier 1. Promotes the existing per-champion "theme color" (currently used only for splash backdrop overlay tint) into a **full propagated accent token** (`--accent`, `--accent-fg`, `--accent-muted`, `--accent-strong`) that cascades to focus rings, scrollbar, sparklines, hover glow, and `<meta name="theme-color">` (so mobile browser chrome adopts the active entity's color).

Read this before adding any visual that should "belong to" the current route/entity, and before scoping arcs that depend on `--accent` ([scroll-driven-shell.md](scroll-driven-shell.md) Chunk 4, [data-viz-densification.md](data-viz-densification.md), [editorial-typography.md](editorial-typography.md)).

KB anchors: [01-css-and-styling.md §OKLCH is the new default working space](~/.claude/knowledge/frontend-2026/01-css-and-styling.md), [02-design-systems.md §Token tiers](~/.claude/knowledge/frontend-2026/02-design-systems.md).

---

## Why

The infrastructure is already there but used minimally:

- [apps/web/src/lol/_shared/assets/champion-theme.ts](../../../apps/web/src/lol/_shared/assets/champion-theme.ts) extracts a per-champion color.
- The splash backdrop and a few card surfaces consume it via `color-mix()`.
- Recharts strokes, focus rings, scrollbar tint, hover sheen all use **fixed** sky-blue/foreground colors regardless of which entity the page is showing.

The cost of fixing the missing propagation now is small (one root-level CSS variable cascade + a hook that writes to it on route change). The cost of fixing it later is large (every component that hardcodes its accent must be revisited). Doing it now also **unlocks several Tier 2 / Tier 3 arcs** without bespoke plumbing each time.

Portfolio framing: the difference between a site where every page looks the same and a site where Jinx's page is faintly pink-magenta while Ahri's is rose-violet is the difference between "templated" and "alive." This is the cheapest move to convey "designed by someone who cares."

---

## What this is NOT

- **Not a redesign of the existing champion theme palette.** The extraction algorithm in `champion-theme.ts` stays as-is (until a separate audit says otherwise).
- **Not a multi-brand theming system.** Single accent per entity; no white-labeling or per-user theme.
- **Not dark-mode work.** Dark mode is already settled. The accent cascade composes with the existing dark theme — `--accent` shifts; `--background` and `--foreground` don't.

---

## Token shape

Tier rules per [02-design-systems.md §Token tiers](~/.claude/knowledge/frontend-2026/02-design-systems.md):

1. **Primitive (extracted)**: `--accent-base: oklch(0.72 0.18 18deg);` — the raw extracted color for the current entity. Written by the JS hook; consumed only by tier 2.
2. **Semantic (derived)**: declared in CSS, derived from `--accent-base` via OKLCH relative-color syntax:
   ```css
   :root {
     --accent: var(--accent-base, oklch(0.72 0.18 230deg));            /* fallback = sky blue */
     --accent-fg: oklch(from var(--accent) max(l, 0.97) c h);          /* high-contrast text on accent */
     --accent-muted: oklch(from var(--accent) l c h / 0.18);           /* soft fills */
     --accent-strong: oklch(from var(--accent) calc(l - 0.1) c h);     /* hover state */
     --accent-ring: oklch(from var(--accent) l calc(c + 0.04) h / 0.6); /* focus rings */
   }
   ```
3. **Component**: Tailwind v4 `@theme` maps these to utility classes:
   ```css
   @theme {
     --color-accent: var(--accent);
     --color-accent-fg: var(--accent-fg);
     --color-accent-muted: var(--accent-muted);
     --color-accent-strong: var(--accent-strong);
   }
   ```
   Components then use `text-accent`, `bg-accent-muted`, `ring-accent-ring/50`, etc.

Relative color syntax (`oklch(from var(--x) ...)`) is supported in Chrome 119+, Safari 16.4+, Firefox 128+ per [01-css-and-styling.md](~/.claude/knowledge/frontend-2026/01-css-and-styling.md). The fallback (`var(--accent-base, oklch(...))`) covers the case where the JS hook hasn't yet written `--accent-base` for an unthemed route.

---

## How accent gets written

A small hook `useAccentColor()` in `apps/web/src/lib/use-accent-color.ts`:

```ts
export function useAccentColor() {
  return (color: string | undefined) => {
    useEffect(() => {
      if (!color) {
        document.documentElement.style.removeProperty("--accent-base");
        document.documentElement.style.removeProperty("--meta-theme-color");
        return;
      }
      document.documentElement.style.setProperty("--accent-base", color);
      // Update <meta name="theme-color"> in the same write
      const meta = document.querySelector('meta[name="theme-color"]');
      meta?.setAttribute("content", color);
      return () => { /* don't clear on unmount — next route's hook will overwrite */ };
    }, [color]);
  };
}
```

Per-route consumers:
- Champion detail page: `useAccentColor()(champ.themeColor)`.
- Match detail page: `useAccentColor()(activeChampionTheme)` — derived from the player's pick.
- Steam game detail: derived from the game's primary art color (Steam exposes one).
- Default routes (Profile, Trends, Home): clear the accent so the fallback (sky blue) applies.

Hooks scope to route boundaries via `useEffect` cleanup; route-change cleanup is handled by the next route's hook firing and overwriting.

---

## Consumers

After the token cascade lands, these consumers switch from hardcoded sky-blue / foreground to `var(--accent)`:

| Consumer | File | Change |
|---|---|---|
| Focus ring | `apps/web/src/components/ui/*` shadcn primitives | `--ring: var(--accent-ring)` in the theme block |
| Scrollbar thumb | `apps/web/src/styles/globals.css` (verify selector) | `scrollbar-color: var(--accent-muted) transparent;` |
| Recharts strokes | feature-level chart components | Pass `stroke="var(--accent)"` into `<Line>`, `<Area>`, `<ReferenceLine>` |
| Section progress bar | from [scroll-driven-shell.md](scroll-driven-shell.md) Chunk 4 | `background: var(--accent)` |
| Sparklines | from [data-viz-densification.md](data-viz-densification.md) | `stroke="var(--accent)"` |
| Hover sheen end-color | Steam library tile sheen | The registered `--sheen-extent` already drives extent; tint the end-color with `var(--accent)` |
| Card-breathe glow | `apps/web/src/lol/_shared/ui/themed-card.tsx` (verify) | Replace hardcoded shadow color with `var(--accent-muted)` |
| `<meta name="theme-color">` | mobile browser chrome | Written by `useAccentColor` hook |
| OG image accent | from [og-image-pipeline.md](og-image-pipeline.md) | Read `--accent-base` at gen time |

---

## Chunked plan

### Chunk 1 — Token cascade in CSS

- Add the `--accent-*` declarations to `apps/web/src/styles/globals.css` (or equivalent root stylesheet).
- Extend Tailwind `@theme` block to expose `accent`, `accent-fg`, `accent-muted`, `accent-strong`, `accent-ring`.
- Default accent = sky blue (verify the current hardcoded value being replaced first; match it so untheme routes look identical).
- Test: snapshot computed style on root element returns the expected fallback chain.

### Chunk 2 — `useAccentColor` hook + tests

- New file `apps/web/src/lib/use-accent-color.ts` + test.
- Test: setting / clearing the color updates `--accent-base` and the meta tag; calling with `undefined` clears both.
- Test: rapid setting (route flip) doesn't leak listeners.

### Chunk 3 — Wire to champion detail

- Champion detail page calls the hook with the champion's `themeColor` from `champion-theme.ts`.
- Visual verification: navigating between two champions visibly shifts the accent on focus rings + scrollbar + section progress (when those land).

### Chunk 4 — Wire to match detail

- Match detail page derives accent from the player's pick (the existing `splash-backdrop` already does this — extract the same logic into the hook).
- Test: navigating between two matches with different player picks shifts the accent.

### Chunk 5 — Replace hardcoded sky-blue / foreground consumers

Sweep `apps/web/src/` for hardcoded color values that should now be accent-driven. Per the consumer table above. Probably ~20–30 sites; many are small.

Use `ugrep -l 'sky-400|sky-500|stroke="#'` to find candidates. Categorise:
- Genuinely accent-tinted in spirit → replace.
- Intentionally fixed (foreground text, muted) → leave.

Document any "intentionally fixed" call site with a one-line comment so the next sweep doesn't revisit it.

### Chunk 6 — Steam side wiring

- Steam game detail extracts a primary color from the game's hero art (Steam CDN exposes capsule colors via `library_hero.json` per app — or fall back to a sampled palette extraction).
- Wire `useAccentColor`.
- Visual verification: Cyberpunk = yellow-magenta, Hades = orange-red, etc.

### Chunk 7 — `<meta name="theme-color">` polish

- Verify the initial `<meta name="theme-color">` in [index.html](../../../apps/web/index.html) — per [frontend-2026-gaps.md Gap 1](frontend-2026-gaps.md), it may not exist yet.
- Add a default that matches the un-themed accent (sky blue).
- The hook overwrites on route change; restoring on cleanup is not needed because the next route's hook either sets a new color or clears it.
- Verify on real iOS Safari (mobile chrome adopts theme-color) — this is the visible payoff that's specifically mobile.

---

## Files in scope

New:
- `apps/web/src/lib/use-accent-color.ts` + test

Modified:
- `apps/web/src/styles/globals.css` (token cascade + Tailwind theme extension)
- `apps/web/index.html` (default theme-color meta)
- `apps/web/src/routes/lol/$accountSlug/champions/$championKey.tsx`
- `apps/web/src/routes/lol/$accountSlug/matches/$matchId.tsx`
- Steam game detail route (when it exists)
- ~20–30 sweep sites with hardcoded accent colors

---

## Risks / open questions

- **OKLCH relative color in Tailwind v4 build output.** Verify Tailwind doesn't pre-compute the relative-color and lose the cascade. The point is that `--accent-fg` derives from `--accent` at runtime, not at build time.
- **Color extraction for unusual champions/games.** Some splash arts are dominated by neutral tones (Vex's purple is faint; some Steam games have B&W key art). Fallback strategy: if extracted color has chroma below a threshold (`oklch(... c < 0.04 ...)`), use the previous-route accent or default rather than producing a gray accent that washes out everything.
- **Focus ring contrast in light mode.** Whatever palette extraction gives might fail APCA/WCAG 2.2 against a light background. The `--accent-ring` derivation already adds chroma + reduces opacity; verify against the worst-case champion theme.
- **Recharts default colors.** Recharts ships `fill`/`stroke` defaults at the component level. Replacing them per-instance is fine but verbose; consider a shared `<ChartTheme>` wrapper that sets CSS vars Recharts can pick up via `currentColor`-style indirection.

---

## Reduced motion

Color is not motion; no `prefers-reduced-motion` interaction. The hook writes its variable in either case.

`prefers-contrast: more` is an open question — for high-contrast users, the accent ring opacity should bump from `0.6` to `1.0`. Handle in a small media block at the bottom of the token cascade:

```css
@media (prefers-contrast: more) {
  :root {
    --accent-ring: oklch(from var(--accent) l c h);
    --accent-muted: oklch(from var(--accent) l c h / 0.3);
  }
}
```
