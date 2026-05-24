# Quick wins punch list

**Status:** Standing backlog of small, atomic improvements surfaced during the elevation-arcs sweep (2026-05-23). Each item is one-shot — file scope hint, short why, no chunk plan needed. Pick one off when you want a 10–30 minute pickup between bigger arcs.

If an item grows past "one PR" once you start it, move it into its own arc note in this directory and remove the entry here.

---

## Fully atomic (pure CSS/HTML, no design call)

- **`accent-color: var(--accent)` on form controls** — globals. Native checkboxes, radios, range sliders pick up the route accent. Free polish once [accent-color-system.md](accent-color-system.md) Chunk 1 lands.
- **Audit other horizontal scrollers for `mask-image` fade edges** — [trophy-case-strip.tsx](../../../apps/web/src/lol/_shared/ui/trophy-case-strip.tsx) already uses one; grep other horizontal-overflow regions (match-pip rows, champion icon strips, item rows in match-detail) and add the same `linear-gradient` mask where the strip reads as a hard-cut today. `mask-image: linear-gradient(to right, transparent, black 12px, black calc(100% - 12px), transparent)`.
- **`::selection` per route** — `::selection { background: color-mix(in oklch, var(--accent) 40%, transparent); }` in globals. Highlight color matches the route accent. Tiny touch, surprisingly noticeable on text-heavy pages.
- **Per-tab favicon dot** — `<link rel="icon">` swap based on presence state (live game → green dot, just-finished → blue, idle → default). Drop-in hook; pairs with [live-presence-chip.md](live-presence-chip.md) but doesn't need it.
- **iOS PWA polish** — `apple-touch-icon`, `apple-mobile-web-app-status-bar-style`, `theme-color` per route accent, `manifest.json` review. Owner uses iOS; the app currently looks like a generic web bookmark on the home screen.

## Build / tooling (one-line config wins)

- **`build.target: 'baseline-widely-available'` in vite.config** — [apps/web/vite.config.ts](../../../apps/web/vite.config.ts). Today the project relies on Vite 8's default target without naming it. Setting it explicitly to `'baseline-widely-available'` (Vite 8's name for Baseline 2023 = Widely available in 2026) documents intent, produces measurably smaller output by skipping down-leveling of async/await/classes (5-15% bundle reduction on a typical React app per KB §9.3), and gives the next maintainer a one-line answer to "what browsers do we target?". Full context in [frontend-2026-gaps.md § Round 6 non-gaps](frontend-2026-gaps.md). ~5 min, atomic.
- **`"sideEffects": false` on `packages/shared/package.json`** — pure re-export barrel today; absence of the annotation forces Rolldown to conservatively walk every leaf module on every import from `@vyoh/shared`. One-line fix. Full context in [frontend-2026-gaps.md § Gap 19](frontend-2026-gaps.md). ~5 min, atomic.

## SEO hygiene (one-line config wins, no library adds)

- **AI crawler tokens in `robots.txt`** — [apps/web/public/robots.txt](../../../apps/web/public/robots.txt) is `Allow: /` only. Add explicit `User-agent:` groups for `Google-Extended`, `GPTBot`, `OAI-SearchBot`, `ChatGPT-User`, `ClaudeBot`, `anthropic-ai`, `Claude-User`, `PerplexityBot`, `Perplexity-User`, `CCBot`, `Applebot-Extended`, `Meta-ExternalAgent`, `Bytespider`. The portfolio's positioning logic *wants* training crawlers to ingest — record that decision in a comment so the next reviewer doesn't reflexively block them. Full context in [frontend-2026-gaps.md § Gap 28](frontend-2026-gaps.md). ~10 min, atomic.
- **Sitemap `lastmod` + drop `changefreq`/`priority`** — [apps/web/public/sitemap.xml](../../../apps/web/public/sitemap.xml) ships fields Google explicitly ignores and lacks the only field Google honors. Replace with `<lastmod>YYYY-MM-DD</lastmod>` (truthful — git mtime or last redesign date, not build date). Full context in [frontend-2026-gaps.md § Gap 30](frontend-2026-gaps.md). ~5 min, atomic.
- **`max-image-preview:large` robots meta** — one line in [apps/web/index.html](../../../apps/web/index.html): `<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />`. Discover eligibility, zero risk. Full context in [frontend-2026-gaps.md § Gap 33](frontend-2026-gaps.md). ~2 min, atomic.

## Testing hygiene (one-line config wins, no library adds)

- **Unify vitest include patterns to `*.{test,spec}.ts` across all three workspaces** — [apps/api/vitest.config.ts:12](../../../apps/api/vitest.config.ts#L12) includes only `*.spec.ts` while web/shared include both. Today 0 api files match `.test.ts` so this is latent, but the next session copying a test pattern from web into api would silently un-run the file with zero failure signal. One-line broadening: change api include to `["src/**/*.{test,spec}.ts"]`. Full context in [frontend-2026-gaps.md § Gap 27](frontend-2026-gaps.md). ~5 min, atomic.
- **Add `branches`/`functions`/`statements` coverage thresholds at current floors** — all three vitest configs gate `lines` only ([apps/web/vite.config.ts:77](../../../apps/web/vite.config.ts#L77), [apps/api/vitest.config.ts:19](../../../apps/api/vitest.config.ts#L19), [packages/shared/vitest.config.ts:14](../../../packages/shared/vitest.config.ts#L14)). Run `pnpm coverage:cc` to read current actual, set thresholds at floor-minus-1 across all four metrics. Branch coverage is the load-bearing metric for catching under-asserted conditionals — the only metric that would catch a test running a branch without asserting its outcome. Full context in [frontend-2026-gaps.md § Gap 24](frontend-2026-gaps.md). ~20 min including the coverage read.
- **Add `@testing-library/user-event` to apps/web devDeps** — currently the project uses `fireEvent` (lower-level) because user-event isn't installed. user-event dispatches the full event sequence (keydown → beforeinput → input → keyup) that a real browser produces; `fireEvent` skips intermediate steps. Most relevant to the command-palette keyboard flow. `pnpm --filter @vyoh/web add -D @testing-library/user-event`. Migration is opportunistic per-test. Full context in [frontend-2026-gaps.md § Gap 26](frontend-2026-gaps.md). ~5 min for the dep add.

## Small feature (~30–60 min, no notes needed)

- **`interpolate-size: allow-keywords`** — globals. Enables `height: auto` ⇄ `height: 0` transitions (currently impossible). Replaces 5+ Motion AnimatePresence height animations with pure CSS. Safari 26+ / Chrome 129+.
- **`field-sizing: content` on inputs that need it** — command palette input, any single-line filter input. Input grows with content; no JS measurement. Chrome 123+.
- **HTML `popover` attribute where it fits** — light tooltips, simple disclosure menus that aren't already Radix. Native top-layer, ESC-to-dismiss, light-dismiss for free. Don't replace existing Radix overlays — those have richer behavior.
- **`<link rel="modulepreload">` for likely-next route chunks** — `__root.tsx`. Preload `/lol/$accountSlug` and `/steam` route bundles. Pair with [speculation-rules-prefetch.md](speculation-rules-prefetch.md) but cheaper.
- **`<picture>` art-direction for splash backdrop on mobile** — currently the same 1920×1080 splash is served everywhere. Mobile can take the 960×540 variant. Save real KB on first paint.
- **Print stylesheet** — `@media print { ... }` to render a clean match-detail or champion-detail page as a printable summary. Niche but signals craft — and reviewers do print things.

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
