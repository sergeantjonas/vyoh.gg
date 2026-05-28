# Quick wins punch list

**Status:** Standing backlog of small, atomic improvements surfaced during the elevation-arcs sweep (2026-05-23). Each item is one-shot — file scope hint, short why, no chunk plan needed. Pick one off when you want a 10–30 minute pickup between bigger arcs.

If an item grows past "one PR" once you start it, move it into its own arc note in this directory and remove the entry here.

---

## Fully atomic (pure CSS/HTML, no design call)

✅ **Per-tab favicon dot** — shipped 2026-05-28 (`7c5d6eb` + `9b65efb`); canvas-composited orb + presence badge via `use-favicon-dot.ts`, mounted in `__root.tsx`. Global presence wired via `PresenceMounts` (root-mounted render-null subscribers that keep `useSteamPlayerState` + per-`LolAccount` `useLiveGame`/`useLiveGameEvents` warm regardless of viewed section) so the dot reflects any account in-game, anywhere in the app.
✅ **iOS PWA polish** — shipped 2026-05-28 (`519e440`); `apple-touch-icon`, `apple-mobile-web-app-capable/status-bar-style/title`, manifest link, maskable icon. Per-route `theme-color` already driven by `useThemeColor`.

- **Remaining percent call-sites not swept on 2026-05-27** — the editorial-typography arc swept ~25 clean-display percent sites + all KDA + LP-delta sites, but left ~15 sites that each need per-site judgment: dual numeric+display use (`Math.abs(pct) < 4`, `weight: pct + 5`), CSS-width dependencies (`style={{ width: ${pct}% }}` progress bars), `pp` percentage-point integers (not 0–1 ratios — `formatPercent` doesn't fit), CountUp-wrapped numbers, and stored numeric `pct` fields used downstream. Files: `recap-top-insight.tsx`, `recap-most-improved.tsx`, `recap-patch-verdict.tsx`, `trend-first-blood-conversion.tsx`, `trend-session-fatigue.tsx`, `trend-weekly-review.tsx`, `trend-game-length.tsx`, `profile-stats-bar.tsx`, `profile-post-game.tsx`, `match-damage-profile.tsx`, `narrativeTemplates.ts`, `pregame-replay.ts`. Each is a small judgment call (sometimes two variables: one numeric for math/CSS, one formatted for display; sometimes leave inline). Reference: [editorial-typography.md §Chunk 7](editorial-typography.md).
- **Percent call-sites missed by the 2026-05-27 audit** — survey on 2026-05-27 (during champion-detail DeltaTile investigation) found additional sites that weren't enumerated in the bullet above. **Steam + Home tiles** were entirely out of scope of the LoL-framed sweep: clean 0–1 → display percents at `steam/platform-mix-chip.tsx:14`, `steam/game/completion-verdict-card.tsx:41`, `steam/achievements/completionist-axis-card.tsx:70,83`, `home/tile-day-split.tsx:118`, `home/tile-session-lengths.tsx:128` (sibling CSS-width usages in the same home files are correctly inline). **Additional LoL display sites** at `profile-pregame-ritual.tsx:137,138,196,255,419`, `trend-time-heatmap.tsx:42,171`, `trend-dow-wr.tsx:27,121,125`, `trend-role-performance.tsx:59,158`, `champion-table.tsx:126` (`:459` is CountUp-wrapped — deferred category). **Prose-with-verb pp-deltas** at `trend-tilt-indicator.tsx`, `trend-comeback-resilience.tsx`, `trend-damage-role-consistency.tsx`, `trend-wr-trajectory.tsx`, `trend-lane-phase-prognosis.tsx`, `trend-kda.tsx` — direction is in the verb so sign-stripping is fine, but `Math.round(Math.abs(deltaPp) * 100)` wasn't consolidated (same pp-not-0-1-ratio reason these are deferred).
## Build / tooling (one-line config wins)

✅ `build.target: 'baseline-widely-available'` and `"sideEffects": false` on `packages/shared` — shipped 2026-05-25.

## SEO hygiene (one-line config wins, no library adds)

✅ AI crawler opt-in (`robots.txt`), sitemap `lastmod` cleanup, and `max-image-preview:large` meta — shipped 2026-05-25.

## Testing hygiene (one-line config wins, no library adds)

✅ Vitest include pattern unified, coverage thresholds set at floor-minus-1 across all four metrics, `@testing-library/user-event` added — shipped 2026-05-26.

## Steam library-card chips (from GetItems harvest 2026-05-24) — ✅ all shipped 2026-05-25

All five rows shipped in the 2026-05-25 session — see [library-card-enrichment.md](../steam/library-card-enrichment.md) for the chunk-level shipping markers. Kept here for trail-of-evidence; nothing left to do in this section.

- ~~**Steam Deck compat chip on game tile + detail header**~~ — Chunk 2 shipped.
- ~~**Platform pills (Windows / Mac / Linux / VR) on game detail**~~ — Chunk 3 shipped.
- ~~**Review summary chip ("Very Positive · 56k") on game detail**~~ — Chunk 4 shipped.
- ~~**ESRB / PEGI rating chip on game detail**~~ — Chunk 5 shipped.
- ~~**Short description as library-tile + game-detail subtitle**~~ — Chunk 1 shipped.

## Small feature (~30–60 min, no notes needed)

✅ **`interpolate-size: allow-keywords`** — shipped 2026-05-28 in `html, body {}` block.
✅ **`field-sizing: content` on command palette input** — shipped 2026-05-28 via `[cmdk-input]` selector.
✅ **`<link rel="modulepreload">` for route chunks** — shipped in a prior session via eager `router.preloadRoute()` calls in `__root.tsx`.
✅ **Print stylesheet** — shipped 2026-05-28; `@media print` block in `index.css` resets dark-mode vars, unfreezes `h-dvh` layout, hides `[data-vt-nav]`/scroll-progress/sticky strips/tab lists.

- **HTML `popover` attribute where it fits** — light tooltips, simple disclosure menus that aren't already Radix. Native top-layer, ESC-to-dismiss, light-dismiss for free. Don't replace existing Radix overlays — those have richer behavior.
- **`<picture>` art-direction for splash backdrop on mobile** — blocked: the splash proxy (`/img/lol/champion/${slug}/backdrop/${patch}.webp`) has no size parameter; needs API work to add a `?w=960` variant before art-direction is useful.

## Tier-2-ish (small but design-touching — drop a paragraph in a new note before picking up)

- **Calendar heatmap** — GitHub-style year-of-games grid on profile. Needs grid sizing/color-scale decision; small note, then implement.
- **SVG `<feTurbulence>` noise overlay** — film-grain texture on splash backdrops at 3% opacity. Needs to be tested per-champion (busy splashes overcrowd); small visual call.
- **WebShare API** — share button on match/profile pages. Decide what the share payload looks like (title, text, url, OG image link).
- **Generative visitor identity glyph** — small SVG that hashes the visitor's IP/UA into a unique 4-shape mark, shown in the corner. Anti-cliché twist on "Hello, you". Needs design direction.

## Engineering-trust (worth doing, no UX surface)

- **Trusted Types + CSP nonces** — `Content-Security-Policy` with `require-trusted-types-for 'script'`. Signals security awareness on a public site. Vite + Nest both support it; mostly a config + script-source audit.
- **Sigstore signing on the deployment artifact** — `cosign sign` in CI. Reviewer who clicks "verify" sees a real signature. Niche but unmissable signal.

## Bolder bets (need their own arc note before pickup)

These were surfaced in the sweep but are big enough that a chunked working-note is required first. Listed here so they don't get forgotten:

- **Houdini PaintWorklet** — custom paint for repeating textures (could replace `<feTurbulence>` noise with a worklet). Research-y.
- **Public status page** — `/status` route showing Riot rate-limit headroom, last successful sync, queue depth. Engineering-trust signal.
- **Service Worker offline cache** — view last-fetched match-detail when offline. Coordinates with PWA polish above.
- **RSS/Atom feed for matches** — `/lol/$accountSlug/matches.atom`. Niche but characterful.
- **iCal feed for Steam wishlist release dates** — `/steam/wishlist.ics`. Adds release dates to the owner's (and visitor's) calendar.
- **Daily snapshot auto-generated image** — once-a-day OG image of "today's session" pushed to a discoverable URL. Pairs with [og-image-pipeline.md](og-image-pipeline.md).

---

## How to use this list

- Pick the smallest item that catches your eye when you have ≤30 min of focus.
- Items in "Fully atomic" should be one commit each. No notes, no audit, just the change + a non-mutating verification.
- Items in "Small feature" can be one commit too; if scope balloons, write a working-note and remove from this list.
- "Tier-2-ish" and "Bolder bets" REQUIRE a note before code — they exist here only to keep the ideas alive.
- When you ship an item, delete it from this list. The file stays small; if it ever empties, the sweep has fully landed.
