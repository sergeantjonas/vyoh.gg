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

✅ **404/not-found art direction** — shipped 2026-06-14. `NotFound` ([not-found.tsx](../../../apps/web/src/components/not-found.tsx)) is now editorial: oversized theme-tinted orb, "Error 404" eyebrow, two-line `EditorialHeading` masthead (`<h1>`), body + "Back home". From the 2026-06-12 visual audit (V11) → [visual-excellence-audit-2026-06-12.md](visual-excellence-audit-2026-06-12.md).
✅ **`routeMeta()` on remaining leaves** — shipped 2026-08-12, and the audit's guess was wrong: the entry's own "verify first" instruction is what caught it. Steam layout, Steam index, and all four match-detail subtabs already had `routeMeta`; coverage was 26 of 31 route files. Of the 5 without it, 4 are correct to leave alone — `__root.tsx` hand-rolls the site-wide defaults (charset, viewport, `apple-mobile-web-app-title`) that `routeMeta` deliberately doesn't model, and `matches/index.tsx`, `champions/index.tsx`, `matches/$matchId/index.tsx` never render (two are `component: () => null` with the list living on the parent layout, one is a `beforeLoad` redirect). The single real gap was [lol/$accountSlug.tsx](../../../apps/web/src/routes/lol/$accountSlug.tsx), the LoL section layout, which lacked what its `steam.tsx` counterpart has; it now carries a floor title. Dynamic routes already thread `params` into `head()`, and `$championKey`'s raw-alias title is a documented static fallback that the component enriches to the display name via `document.title` once `useChampionName` resolves — not a violation of the `useChampionName()` convention. From the 2026-06-12 visual audit (V5).
✅ **Focus-visible ring contrast pass** — shipped 2026-06-14. The global `*:focus-visible` path (already reworked off `outline-ring/50` to `outline: 2px solid var(--theme-ring)`) is now a **two-tone ring**: the themed outline carries identity and reads against dark splash regions, and a new `--ring-casing` box-shadow (`0 0 0 4px`, dark) lays a thin line just outside it so the indicator stays legible when the themed hue matches a bright splash — at least one edge always contrasts, on any backdrop. Themed-ring alpha bumped 0.6→0.7 (light) / 0.7→0.8 (dark); casing strengthened under `prefers-contrast: more` alongside the existing ring bump. Components with their own `ring-*` box-shadow (Button, checkbox, match-pips, profile-synergy) override the casing via the utilities layer → no double-rings. Verified over splash + champion-detail HD splash with a Playwright focus probe (logo, tab links, role buttons, icon buttons). From the 2026-06-12 visual audit (V6). The top nav links (`NavLink` in [nav.tsx](../../../apps/web/src/components/nav.tsx)) carry no explicit focus class, so they inherit this same global two-tone ring — confirmed visible on real keyboard focus. (An earlier probe reported `outline: none` for them, but that was a false negative: the probe used programmatic `el.focus()`, and `:focus-visible` only matches keyboard-originated focus.)
✅ **Descriptive `aria-label` on the 7 Recharts charts** — shipped 2026-06-14. `aria-label` added to each chart root (`match-lane-phase`, `match-gold-lead`, `match-map-overlay` scrubber, `profile-lp-history`, `trend-kda`, champion-detail win-rate trend, `live` team-comp radar); recharts' `svgPropertiesNoEvents` allowlist passes it through onto the `<svg role="application">` the `accessibilityLayer` already renders, so the SR now announces a *named* interactive region instead of an unlabelled one. From the 2026-06-14 data-viz audit (Round 9, Gap 34 / bundle BC). Does **not** close the table-fallback gap (#35) — that needs the shared primitive.

- **`<picture>` art-direction for splash backdrop on mobile** — blocked: the splash proxy (`/img/lol/champion/${slug}/backdrop/${patch}.webp`) has no size parameter; needs API work to add a `?w=960` variant before art-direction is useful.

## Tier-2-ish (small but design-touching — drop a paragraph in a new note before picking up)

✅ **Calendar heatmap** — already shipped as `ProfileActivityCalendar` ([profile-activity-calendar.tsx](../../../apps/web/src/lol/profile/profile-activity-calendar.tsx)); 365-day window, 5-tier emerald scale, per-cell tooltips, Riot 1000-match-cap handling. Entry was stale.
- **SVG `<feTurbulence>` noise overlay on splash backdrops** — global body-level noise exists at 6% ([index.css:460](../../../apps/web/src/index.css#L460)) and home orb uses feTurbulence ([orb-mark.tsx:213](../../../apps/web/src/home/orb-mark.tsx#L213)); what's still open is the per-champion splash-backdrop 3% overlay. Needs per-champion test (busy splashes overcrowd); small visual call.
- **WebShare API** — share button on match/profile pages. Decide what the share payload looks like (title, text, url, OG image link).
- **Generative visitor identity glyph** — small SVG that hashes the visitor's IP/UA into a unique 4-shape mark, shown in the corner. Anti-cliché twist on "Hello, you". Needs design direction.

## Engineering-trust (worth doing, no UX surface)

**Lazy-load the owner-only root controls** — `auth/owner-badge.tsx`, `auth/logout-button.tsx`, `steam/curation/review-dot.tsx`, `admin/use-admin-steam-games.ts` and the TanStack Query mutation cache they pull in ride in the initial JS for every visitor: ~3 kB gzip, measured 2026-09-01 in [perf-baseline.md](perf-baseline.md). The viewer query already gates the render, so a `React.lazy` split behind `isOwner` makes the public payload stop paying for owner UI. Verify with `pnpm --filter @vyoh/web size` before and after.

- **Trusted Types + CSP nonces** — `Content-Security-Policy` with `require-trusted-types-for 'script'`. Signals security awareness on a public site. Vite + Nest both support it; mostly a config + script-source audit. **Deferred until hosting target is picked** (2026-05-28) — CSP delivery layer is hosting-specific (`_headers` for Cloudflare, `vercel.json` for Vercel, reverse-proxy config for self-host), so a speculative shipment would either need rework or rot. Two `dangerouslySetInnerHTML` sites (`steam/game/game-about-block.tsx:157`, `lol/_shared/static/rich-description.ts`) will need a `trusted-types` policy if HTML sinks are gated; `require-trusted-types-for 'script'` alone is fine.
- **Sigstore signing on the deployment artifact** — `cosign sign` in CI. Reviewer who clicks "verify" sees a real signature. Niche but unmissable signal.

## Code hygiene (DRY consolidation, no UX surface)

✅ **Consolidate `TOOLTIP_CONTENT_CLASS`** — shipped 2026-06-11. [apps/web/src/lib/tooltip.ts](../../../apps/web/src/lib/tooltip.ts) exports `TOOLTIP_CONTENT_COMPACT` + `TOOLTIP_CONTENT_RICH` composed from shared `SHELL` + `ANIMATION` primitives. Migrated 17 named local `const`s (compact: refresh-account-button, trend-time-heatmap, serious-queues-settings, steam-preferences, status-page, champion-table, routes/lol/champions, plus `TOOLTIP_CLASS` in trend-death-matchup-heatmap, champion-build-path, champion-position-heatmap; compact + `max-w-xs`: rarity-percent, profile-lp-history-constants→profile-lp-history, profile-season-history, completion-verdict-card, rarity-signature-card; rich: sample-size-badge, match-pips, steam-chronotype-tile, rhythm-band, plus `RICH_TOOLTIP_CLASS` in match-spell-casts) and ~20 inline className strings (nav, this-patch-badge, keystone-icon, summoner-spell-icon, champion-patch-history, match-build-order/event-timelines/list-row-popover/review-view/skill-order/detail-recap-tab, profile-activity-calendar, trend-death-timing, routes/championKey/live, game-rating-badge, platform-icon-row, review-summary-chip, game-unlock-timeline) to use `cn(TOOLTIP_CONTENT_…, "overrides…")` for bespoke width / `bg-popover/90` / `shadow-md` / `rounded`. Sparkline kept its own const, now composed from `TOOLTIP_CONTENT_COMPACT`.

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
