# Per-route OG image pipeline

**Status:** ✅ Shipped 2026-06-07. All four remaining templates (champion, profile, home, Steam game) landed in one session after C0's match-card retrofit. Owner share affordance (originally Chunk 6) stays out of scope. Part of [elevation-arcs.md](elevation-arcs.md) Tier 3. Generates per-entity Open Graph images for shareable deep-links. Returns SEO + share-delight + AI-crawler payoff.

Read this when scoping or extending the OG arc; relates to [frontend-2026-gaps.md Gap 1](frontend-2026-gaps.md) (static head baseline) which Chunk 3 closes.

KB anchors: [13-seo.md](~/.claude/knowledge/frontend-2026/13-seo.md), [05-frameworks.md](~/.claude/knowledge/frontend-2026/05-frameworks.md) (Satori in Next.js stays the reference pattern even for non-Next stacks).

---

## Decisions (locked 2026-06-07)

1. **Aspect ratio: `1200×630` everywhere.** OG standard. Match card retrofitted from its initial 1200×400 to match. No per-endpoint aspect-ratio overrides.
2. **All endpoints render dynamically per request — no committed PNGs, no build-time pregeneration.** Owner constraint: adding a new champion to Riot's roster, a new game to the Steam library, etc., must not require a redeploy. Each endpoint takes its identifier as a URL param and renders on demand. Perf strategy is the existing HTTP cache layer + CDN — same `Cache-Control: public, max-age=86400, s-maxage=2592000` the match endpoint already uses. Home OG follows the same pattern for shape-uniformity, even though its content is fully static.
3. **All upstream asset fetches go through the image proxy.** Splash art, champion icons, Steam hero images — every external asset URL the Satori template references resolves through the API's own `/lol/image/...` (or Steam equivalent) proxy. Single-call latency between OG service and image proxy is negligible (co-located), and the proxy's cache headers still apply downstream. No template references upstream CDNs directly.
4. **Profile display name: always `gameName#tagLine`.** Read from `accounts.json` via the identity service; never the slug, never a shortened form.

---

## Why

Today, sharing a vyoh.gg URL on Twitter/Discord/Slack gets the default site-wide OG image (which per [frontend-2026-gaps.md Gap 1](frontend-2026-gaps.md) doesn't even exist yet outside the match route). The shared link reads as "generic site." A per-entity OG card that shows the actual content of the linked page makes the share itself the marketing — and the recipient sees "oh this is a thing about *that specific match*," not "another link."

Why before launch:
- AI crawlers (per [13-seo.md §8](~/.claude/knowledge/frontend-2026/13-seo.md)) prioritise OG content for ranking and indexing snippets. Shipping OG before launch gets the site indexed correctly on the first crawl.
- It's a portfolio bullet ("dynamic edge OG generation") that costs ~one session per surface.

---

## What this is NOT

- **Not a screenshot of the live page.** Headless-browser screenshotting is heavy, fragile, and slow. Use a templating approach (Satori) that renders the same data the page uses, in a layout designed for the 1200×630 OG aspect ratio.
- **Not per-tab-state OG.** The OG for `/lol/$accountSlug` is for the account, not for the currently-active tab.
- **Not animated OG.** Twitter/Discord/Slack don't render animated OG. Static PNG.

---

## Approach

NestJS endpoint at `apps/api/src/og/og.controller.ts` per template. [Satori](https://github.com/vercel/satori) (JSX → SVG) + [`@resvg/resvg-js`](https://github.com/yisibl/resvg-js) (SVG → PNG) renders server-side. Templates live in `og-card.ts` as JSX-shaped objects (no JSX compilation; the `e(...)` helper in `og-card.ts` already wraps Satori's expected shape).

Asset fetching for splash / icons / Steam hero goes through the image proxy (decision #3) — each template `await`s the proxy URL into a `data:` URI before invoking Satori.

Caching: per-route stable URL + HTTP cache headers (`max-age=86400, s-maxage=2592000`) — the same shape the existing match endpoint uses. No filesystem write, no S3, no committed PNGs.

Build-time pregeneration option from the earlier draft (champion OGs committed under `apps/web/public/og/champion/`) is **dropped** per decision #2.

Edge-function variant (Cloudflare Workers) stays out of scope until the project migrates to TanStack Start + edge runtime.

---

## Template designs

### Match OG (`/og/match/:slug/:matchId.png`) — shipped, retrofitted to 1200×630

Current layout: left splash (740×630, dimmed + edge-faded) + right content panel (540×630, padded). Headline shows champion name + KDA + win/loss + queue + duration; accent strip at the bottom edge takes per-route win/loss color. Refer to `apps/api/src/og/og-card.ts` for the source of truth.

### Champion OG (`/og/lol/champion/{key}.png`) — Chunk 1

```
┌────────────────────────────────────────────────┐
│  [Splash background, full-bleed, dimmed]       │
│                                                │
│   JINX                                         │
│   The Loose Cannon                             │
│   Marksman                                     │
│                                                │
│  vyoh.gg                                       │
└────────────────────────────────────────────────┘
```

Splash via image proxy (`/lol/image/splash/:alias` or whichever family the proxy already exposes). Sub-header line ("Marksman") sourced from the bundle endpoint.

### Profile OG (`/og/lol/:slug.png`) — Chunk 2

```
┌────────────────────────────────────────────────┐
│  gameName#tagLine                              │
│  Platinum III · 47 LP                          │
│                                                │
│   58% WR    3.4 KDA    214 GAMES               │
│                                                │
│  vyoh.gg                                       │
└────────────────────────────────────────────────┘
```

Account identity from `accounts.json` (gameName#tagLine, never the slug). Rank from the existing profile-rank service. KPI strip from the existing summary aggregator.

### Home OG (`/og/home.png`) — Chunk 3

```
┌────────────────────────────────────────────────┐
│  vyoh.gg                                       │
│                                                │
│  [OrbMark glyph, large, centered]              │
│                                                │
│  A personal cross-stream gaming dashboard      │
└────────────────────────────────────────────────┘
```

Dynamic endpoint (per decision #2) even though content is static. Same render path as the others — uniform shape across all OG surfaces.

### Steam game OG (`/og/steam/game/:appid.png`) — Chunk 4

```
┌────────────────────────────────────────────────┐
│  [Steam hero art, full-bleed, dimmed]          │
│                                                │
│   GAME NAME                                    │
│   Developer · Genre                            │
│   Playtime · Achievement %                     │
│                                                │
│  vyoh.gg                                       │
└────────────────────────────────────────────────┘
```

Hero art via Steam image proxy (SGDB-fallback chain already wired). Stats from the existing Steam game-detail aggregator.

---

## Chunked plan

### Chunk 0 — Doc refresh + retrofit match to 1200×630 (2026-06-07)

- ✅ Bump `apps/api/src/og/og-card.ts` from 1200×400 to 1200×630 (all 3 hard-coded width/height pairs + Satori dims).
- ✅ Adjust right-panel padding so the layout breathes at the new aspect ratio (`56px 64px` → `88px 64px`).
- ✅ Update `apps/web/src/routes/lol/$accountSlug/matches/$matchId.tsx` `head()`: `og:image:height: "400"` → `"630"`.
- ✅ Refresh this note + elevation-arcs.md row.

### Chunk 1 — Champion OG ✅ shipped

- `renderChampionCard(data: ChampionCardData)` in `apps/api/src/og/og-card.ts`. Full-bleed splash + bottom-anchored champion name + class sub-label (modernClasses with roles fallback).
- `GET /og/champion/:alias.png` in `og.controller.ts`. Champion identity resolved via `prisma.lolChampion.findFirst({ alias: { equals, mode: insensitive } })` so URL casing doesn't matter; splash URLs come from `LolImageService.champion(alias, "hd")`.
- Champion-detail route head() (`apps/web/src/routes/lol/$accountSlug/champions/$championKey.tsx`) emits the OG meta tags.
- Tests: `og-card.spec.ts` (PNG header + canonical 1200×630 dims), `og.service.spec.ts` (404 path + sub-label composition), `og.controller.spec.ts` (delegation + alias DTO).

### Chunk 2 — Profile OG ✅ shipped (revised same day to splash-backed)

- `renderProfileCard(data: ProfileCardData)`. Splash-backed layout: signature champion as full-bleed backdrop with bottom-darken gradient + bottom-anchored editorial block (gameName#tagLine, rank line, three KPI tiles, region). Falls back to a typographic-only layout when `splashUrls` is empty (no non-remake matches yet).
- `GET /og/profile/:slug.png`. Identity via `IdentityService.findBySlug` → `gameName#tagLine` (decision #5). Rank from `LolService.getSummonerProfile` (solo preferred, apex tiers drop the division). KPIs + signature champion computed from a 500-row cached-match window via `excludeRemakes` + `selectChampionOfYear`.
- `selectChampionOfYear` lifted from `apps/web/src/lol/recap/recap-champion.tsx` into `packages/shared/src/lol/champion-of-year.ts` so the OG card and the profile page's hero backdrop agree on the subject — a viewer who clicks through sees the same champion that was in the share preview.
- Profile route head() (`apps/web/src/routes/lol/$accountSlug/index.tsx`) ships a static "Profile · vyoh.gg" fallback; a `useEffect` in `ProfilePage` enriches `document.title` with `${gameName}#${tagLine} · vyoh.gg` once the account resolves. The slug is an opaque URL identifier; LoL identity is always gameName#tagLine. Same pattern the Steam game-detail route uses.
- Tests: rank composition (Platinum III · 47 LP), apex-tier division drop, null-rank path, KPI computation, signature-champion splash composition, empty-match-window fallback to empty splashUrls.

### Chunk 3 — Home OG ✅ shipped (closes [frontend-2026-gaps.md Gap 1](frontend-2026-gaps.md))

- `renderHomeCard()`. Centered editorial composition: the actual OrbMark glyph (copied from `apps/web/public/vyoh-orb-mark.svg` into `apps/api/src/og/assets/`) wrapped in a soft radial halo, large wordmark, owner-curated tagline. The orb SVG is a PNG-in-SVG wrapper; `og-assets.ts` extracts the inner base64 PNG once at module load and embeds it as a Satori `<img>` data URL.
- Web-side OrbGlyph uses CSS masks to retint with `--theme-color`. Satori has no mask-source equivalent, so the OG renders the orb with its native 3D shading — the loss of theme-color tinting is acceptable for a static home surface (no per-route accent to convey).
- Build wiring: `apps/api/nest-cli.json` extends `assets` to include `og/assets/*.svg` alongside `og/fonts/*.ttf` so the SVG ships into `dist/` next to the compiled JS.
- `GET /og/home.png`. No upstream calls — fully self-contained; rendered per request (decision #2) for endpoint-shape uniformity.
- `apps/web/index.html` adds `<meta property="og:image">` + Twitter image referencing the home endpoint; `<meta name="twitter:card">` lifted from `summary` to `summary_large_image`.

### Chunk 4 — Steam game OG ✅ shipped

- `renderSteamGameCard(data: SteamGameCardData)`. Left hero (with Steam-blue accent strip) + right content panel: game name, short description (auto-hidden when null), three KPI tiles (Playtime / Completion / Recent).
- `GET /og/steam-game/:appid.png`. Recap data from `SteamGameRecapService.getGameRecap(appid)` — the same aggregator the in-app game-detail page uses. Hero URLs from `SteamImageService.heroLarge(appid)` (SGDB + legacy fallback chain).
- Steam game-detail route head() (`apps/web/src/routes/steam/game.$appid.tsx`) emits the meta tags.
- Tests: hero URL composition, completion-pct fallback to em-dash for schema-less titles, NotFoundException propagation.

### Owner share affordance — out of scope for this arc

A "share" button on match-detail / champion-detail / profile that copies the URL with rich-text fallback. Pure UX work; tracked separately whenever it gets picked.

---

## Files in scope

All shipped 2026-06-07:
- `apps/api/src/og/og-card.ts` — extracted shared `fetchAsDataUrl(urls[])` + `wordmark()` + `svgToPng()`; added `renderChampionCard`, `renderProfileCard`, `renderHomeCard`, `renderSteamGameCard`. Match card consumes resolver-sourced `splashUrls` list.
- `apps/api/src/og/og.controller.ts` — endpoints `/og/champion/:alias.png`, `/og/profile/:slug.png`, `/og/home.png`, `/og/steam-game/:appid.png`. Single `OG_CACHE_HEADER` constant.
- `apps/api/src/og/og.service.ts` — DI for `LolImageService`, `SteamImageService`, `PrismaService`, `SteamGameRecapService`; one generator per template.
- `apps/api/src/og/og-params.dto.ts` — `OgChampionAliasDto`, `OgSlugDto`, `OgSteamAppidDto` (existing `OgParamsDto` aliased to `OgMatchParamsDto`).
- `apps/api/src/og/og.module.ts` — imports `ImgModule`, `PrismaModule`, `SteamModule`.
- `apps/api/src/img/img.module.ts` — exports `LolImageService` + `SteamImageService`.
- `apps/api/src/steam/steam.module.ts` — exports `SteamGameRecapService`.
- `apps/web/src/routes/lol/$accountSlug/champions/$championKey.tsx` — `head()` meta.
- `apps/web/src/routes/lol/$accountSlug/index.tsx` — `head()` meta (profile).
- `apps/web/src/routes/steam/game.$appid.tsx` — `head()` meta.
- `apps/web/index.html` — default OG meta + Twitter image; `twitter:card` lifted to `summary_large_image`.

No new committed assets — every OG renders dynamically per request.

---

## Risks / open questions

- **Font loading in Satori.** Already solved for the match card via `apps/api/src/og/og-fonts.ts` (Geist Regular + SemiBold buffers). New templates reuse the same fonts module.
- **Cache invalidation for Profile OG.** Profile data changes when rank changes. `Cache-Control: public, max-age=86400` means up to 24h staleness on the shared cache — acceptable for now; if it becomes noisy, drop `max-age` to `3600` (1h) when Profile ships.
- **OG image dimensions.** Locked at 1200×630 per decision #1.
- **Privacy.** Data shown in any OG is public. Owner accounts only — no anon-shared-link scenarios on the roadmap.
- **Image-proxy startup ordering.** OG endpoints depend on the image-proxy controller. Already in the same Nest app; no module-init race expected. Verify per-chunk.

---

## Reduced motion

Static images; no motion concerns.
