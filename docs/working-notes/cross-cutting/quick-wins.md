# Quick wins punch list

**Status:** Standing backlog of small, atomic improvements surfaced during the elevation-arcs sweep (2026-05-23). Each item is one-shot — file scope hint, short why, no chunk plan needed. Pick one off when you want a 10–30 minute pickup between bigger arcs.

If an item grows past "one PR" once you start it, move it into its own arc note in this directory and remove the entry here.

---

## Fully atomic (pure CSS/HTML, no design call)

✅ **Per-tab favicon dot** — shipped 2026-05-28 (`7c5d6eb` + `9b65efb`); canvas-composited orb + presence badge via `use-favicon-dot.ts`, mounted in `__root.tsx`. Global presence wired via `PresenceMounts` (root-mounted render-null subscribers that keep `useSteamPlayerState` + per-`LolAccount` `useLiveGame`/`useLiveGameEvents` warm regardless of viewed section) so the dot reflects any account in-game, anywhere in the app.
✅ **iOS PWA polish** — shipped 2026-05-28 (`519e440`); `apple-touch-icon`, `apple-mobile-web-app-capable/status-bar-style/title`, manifest link, maskable icon. Per-route `theme-color` already driven by `useThemeColor`.

✅ **Percent call-site sweep** — shipped 2026-05-28. Clean 0–1 → display sites across LoL (recap, trends, profile, pregame), Steam (platform-mix, completion-verdict, completionist-axis), and Home (day-split, session-lengths) tiles now route through `formatPercent` from `@vyoh/shared`. The `style={{ width: pct }}` precedent from `trend-dow-wr.tsx` lets a single `formatPercent` value serve both CSS width and display. Intentionally left inline: pp percentage-point integers (`Math.round(deltaPp * 100)` — not 0–1 ratios), CountUp-wrapped numbers, dual numeric+display patterns (`Math.abs(pct) < 4`), and CSS widths driven by non-ratio scales (game-count bars in `trend-game-length.tsx`).
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

✅ **HTML `popover` attribute where it fits** — dropped 2026-05-28; audit found nothing to convert. Tooltips/overlays are governed by Radix (`TooltipPrimitive`, `react-popover`, `react-hover-card`), and the remaining `aria-expanded` sites are inline accordions where native `popover` doesn't apply.

- **`<picture>` art-direction for splash backdrop on mobile** — blocked: the splash proxy (`/img/lol/champion/${slug}/backdrop/${patch}.webp`) has no size parameter; needs API work to add a `?w=960` variant before art-direction is useful.

## Tier-2-ish (small but design-touching — drop a paragraph in a new note before picking up)

✅ **Calendar heatmap** — already shipped as `ProfileActivityCalendar` ([profile-activity-calendar.tsx](../../../apps/web/src/lol/profile/profile-activity-calendar.tsx)); 365-day window, 5-tier emerald scale, per-cell tooltips, Riot 1000-match-cap handling. Entry was stale.
- **SVG `<feTurbulence>` noise overlay on splash backdrops** — global body-level noise exists at 6% ([index.css:460](../../../apps/web/src/index.css#L460)) and home orb uses feTurbulence ([orb-mark.tsx:213](../../../apps/web/src/home/orb-mark.tsx#L213)); what's still open is the per-champion splash-backdrop 3% overlay. Needs per-champion test (busy splashes overcrowd); small visual call.
- **WebShare API** — share button on match/profile pages. Decide what the share payload looks like (title, text, url, OG image link).
- **Generative visitor identity glyph** — small SVG that hashes the visitor's IP/UA into a unique 4-shape mark, shown in the corner. Anti-cliché twist on "Hello, you". Needs design direction.

## Engineering-trust (worth doing, no UX surface)

- **Trusted Types + CSP nonces** — `Content-Security-Policy` with `require-trusted-types-for 'script'`. Signals security awareness on a public site. Vite + Nest both support it; mostly a config + script-source audit. **Deferred until hosting target is picked** (2026-05-28) — CSP delivery layer is hosting-specific (`_headers` for Cloudflare, `vercel.json` for Vercel, reverse-proxy config for self-host), so a speculative shipment would either need rework or rot. Two `dangerouslySetInnerHTML` sites (`steam/game/game-about-block.tsx:157`, `lol/_shared/static/rich-description.ts`) will need a `trusted-types` policy if HTML sinks are gated; `require-trusted-types-for 'script'` alone is fine.
- **Sigstore signing on the deployment artifact** — `cosign sign` in CI. Reviewer who clicks "verify" sees a real signature. Niche but unmissable signal.

## Code hygiene (DRY consolidation, no UX surface)

- **Consolidate `TOOLTIP_CONTENT_CLASS`** (surfaced 2026-05-30 during the strip-action-icon parity pass). The Radix tooltip `Content` className is copy-pasted across ~26 sites in **two families**: a **compact** label variant (`px-2 py-1 text-xs`, ~18 local `const`s + ~8 inline — refresh/settings icon buttons, chips) and a **rich** variant (`p-3`, custom `max-w`/width — `match-pips.tsx`, the three `home/tile-*.tsx`, `lol/trends/_shared/sample-size-badge.tsx`, `steam/achievements/steam-chronotype-tile.tsx`). Plan: export two constants (e.g. `TOOLTIP_CONTENT_COMPACT` / `TOOLTIP_CONTENT_RICH`) from a web-level `lib/tooltip.ts` (web-only for now — only move to `packages/shared` if the api ever needs them), migrate every call site, delete the locals. **Not a blind find-replace:** each *rich* site needs a glance to confirm it can take the shared class or genuinely needs a bespoke `max-w`/width (keep those overriding locally via `cn(TOOLTIP_CONTENT_RICH, "max-w-…")`). One focused commit; ~25+ files but mechanical once the two exports exist. ≈45–60 min with the audit.

## Bolder bets (need their own arc note before pickup)

These were surfaced in the sweep but are big enough that a chunked working-note is required first. Listed here so they don't get forgotten:

- **Houdini PaintWorklet** — custom paint for repeating textures (could replace `<feTurbulence>` noise with a worklet). Research-y.
✅ **Public status page** — shipped: `/status` route is a full match-sync + Riot rate-limiter view with sync history ([apps/web/src/status/status-page.tsx](../../../apps/web/src/status/status-page.tsx)). Entry was stale.
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
