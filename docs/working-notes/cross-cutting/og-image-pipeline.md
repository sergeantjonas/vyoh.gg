# Per-route OG image pipeline

**Status:** Planned. Part of [elevation-arcs.md](elevation-arcs.md) Tier 3. Generate per-entity Open Graph images for shareable deep-links (match detail, champion detail, Steam game detail, Profile, /). Returns SEO + share-delight + AI-crawler payoff. Pairs naturally with [self-portrait-surfaces.md](self-portrait-surfaces.md).

Read this when scoping the OG arc; relates to [frontend-2026-gaps.md Gap 1](frontend-2026-gaps.md) (static head baseline) which should land first.

KB anchors: [13-seo.md](~/.claude/knowledge/frontend-2026/13-seo.md), [05-frameworks.md](~/.claude/knowledge/frontend-2026/05-frameworks.md) (Satori in Next.js stays the reference pattern even for non-Next stacks).

---

## Why

Today, sharing a match URL on Twitter/Discord/Slack gets the default site-wide OG image (which per [frontend-2026-gaps.md Gap 1](frontend-2026-gaps.md) doesn't even exist yet). The shared link reads as "generic site." A per-entity OG card that shows the actual content of the linked page makes the share itself the marketing — and the recipient sees "oh this is a thing about *that specific match*," not "another link."

Why now (not after launch):
- AI crawlers (per [13-seo.md §8](~/.claude/knowledge/frontend-2026/13-seo.md)) prioritise OG content for ranking and indexing snippets. Shipping OG before launch gets the site indexed correctly on the first crawl.
- It's a portfolio bullet ("dynamic edge OG generation") that costs ~one session.

---

## What this is NOT

- **Not a screenshot of the live page.** Headless-browser screenshotting is heavy, fragile, and slow. Use a templating approach (Satori or Canvas) that renders the same data the page uses, in a layout designed for the 1200×630 OG aspect ratio.
- **Not per-tab-state OG.** The OG for `/lol/$accountSlug` is for the account, not for the currently-active tab.
- **Not animated OG.** Twitter/Discord/Slack don't render animated OG. Static PNG/JPEG.

---

## Approach options

### Option 1 — NestJS endpoint with Satori (recommended)

- Add an endpoint at `apps/api/src/og/og.controller.ts`: `GET /og/lol/match/:matchId.png`, `GET /og/lol/champion/:championKey.png`, etc.
- Use [Satori](https://github.com/vercel/satori) (JSX → SVG) + [`@resvg/resvg-js`](https://github.com/yisibl/resvg-js) (SVG → PNG) to render server-side.
- Templates are JSX; reuse design tokens via shared CSS variables (the same per-route accent color from [accent-color-system.md](accent-color-system.md)).
- Cache aggressively: each per-entity OG has a stable URL; cache headers `public, max-age=86400, stale-while-revalidate=604800`.
- Storage: write to filesystem or S3-equivalent; serve through Nest static-serve or upstream CDN.

### Option 2 — Build-time generation for static entities (champions, items)

- Champions are a closed set per patch. Generate champion OGs at build time, write to `apps/web/public/og/champion/{key}.png`.
- Items same. Even Steam games could be pre-generated for the owner's library.
- Saves runtime cost for static entities; the dynamic option remains for matches.

### Option 3 — Edge function (deferred)

- If the project ever moves to Cloudflare Workers (per `~/.claude/knowledge/frontend-2026/17-cross-platform-edge-auth.md`), per-request OG generation at the edge with Satori is the default 2026 stack. Out of scope until that migration.

**Default: combine Option 1 (matches, profile, dynamic) + Option 2 (champions, items, static entities).** Build-time for things that don't change between patches; runtime for everything else.

---

## Template designs

### Match OG (`/og/lol/match/:matchId.png`)

```
┌────────────────────────────────────────────────┐
│  vyoh.gg                                       │
│                                                │
│   [Champion splash, dimmed, edge-faded]        │
│                                                │
│   3.42 KDA          Jinx                       │
│   8/2/9             Ranked Solo · 28m          │
│   ─────             ──────────                 │
│   WIN               Mar 18 2026                │
│                                                │
│  via vyoh.gg/lol/jonas/matches/{id}            │
└────────────────────────────────────────────────┘
```

Color: per-champion accent from [accent-color-system.md](accent-color-system.md) tints the right-edge gradient.

### Champion OG (`/og/lol/champion/{key}.png`)

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

### Profile OG (`/og/lol/{accountSlug}.png`)

```
┌────────────────────────────────────────────────┐
│  jonas#EUW                                     │
│  Platinum III · 47 LP                          │
│                                                │
│   58% WR    3.4 KDA    214 GAMES               │
│   ──        ──         ──                      │
│                                                │
│  vyoh.gg                                       │
└────────────────────────────────────────────────┘
```

### Home OG (`/og/home.png`)

```
┌────────────────────────────────────────────────┐
│  vyoh.gg                                       │
│                                                │
│  [OrbMark glyph, large, centered]              │
│                                                │
│  A personal cross-stream gaming dashboard      │
└────────────────────────────────────────────────┘
```

---

## Chunked plan

### Chunk 1 — NestJS OG endpoint skeleton with one template (match)

- Add `apps/api/src/og/og.module.ts` + `og.controller.ts`.
- Install `satori` + `@resvg/resvg-js`.
- Wire `GET /og/lol/match/:matchId.png` to fetch the match summary + render the JSX template + return PNG bytes.
- Per-request cache header.
- Test: endpoint returns a valid PNG.

### Chunk 2 — Per-route `<head>` `<meta property="og:image">` for matches

- Match-detail route's TanStack `head()` function adds `<meta property="og:image" content="..." />` pointing to the endpoint.
- Same for `og:title`, `og:description`.
- Verify with a Twitter Card Validator or Discord embed preview.

### Chunk 3 — Champion + Profile templates

- Repeat for champion-detail and profile routes.
- Champion gets the splash background; Profile gets the rank icon + KPI strip.
- Build-time pregeneration for all champions (Option 2): script in `apps/api/scripts/build-champion-ogs.ts` writes 170+ PNGs to `apps/web/public/og/champion/`. Run as part of the patch-refresh pipeline ([lol-image-pipeline.md](../lol/lol-image-pipeline.md)).

### Chunk 4 — Home + default site OG

- Static. Generate once, commit to `apps/web/public/og/home.png`.
- Wire to root `<head>` per [frontend-2026-gaps.md Gap 1](frontend-2026-gaps.md).

### Chunk 5 — Steam game OG (when Steam detail ships)

- Per-game-detail OG using Steam's hero art as the background.
- Same pattern, different data source.

### Chunk 6 — Owner share affordance

- Optional follow-up: a "share" button on match-detail / champion-detail / profile that copies the URL with rich-text fallback. UX flair, ties into the social-share motivation for the OG work in the first place.

---

## Files in scope

New:
- `apps/api/src/og/og.module.ts`
- `apps/api/src/og/og.controller.ts`
- `apps/api/src/og/templates/{match,champion,profile}.tsx`
- `apps/api/scripts/build-champion-ogs.ts` (for build-time generation)
- `apps/web/public/og/home.png` (committed asset)
- `apps/web/public/og/champion/*.png` (committed assets; large set — verify gitignore policy)

Modified:
- `apps/api/package.json` (`satori` + `@resvg/resvg-js`)
- `apps/web/src/routes/lol/$accountSlug/matches/$matchId.tsx` (head meta)
- `apps/web/src/routes/lol/$accountSlug/champions/$championKey.tsx` (head meta)
- `apps/web/src/routes/lol/$accountSlug.tsx` (head meta)
- `apps/web/index.html` (default OG meta per [frontend-2026-gaps.md Gap 1](frontend-2026-gaps.md))

---

## Risks / open questions

- **Font loading in Satori.** Satori needs the rendering font as a `Buffer`. Geist Variable must be loaded from the API's filesystem. Verify the variable axis Satori can access — likely needs separate weight files for editorial-typography parity.
- **Champion OG storage size.** 170+ champions × ~80kB PNG = ~14MB of static assets. Committing them inflates repo. Two options: (a) build-time generation at CI, (b) committed because they change at patch refresh and the diff-as-audit-log argument applies (per [repo-conventions.md §Committed generated files](../../repo-conventions.md)). Decide and document in repo-conventions.
- **Stale OGs after data changes.** A match OG generated when a match was fresh stays valid forever (match data doesn't change). Profile OG changes whenever rank changes — cache with `stale-while-revalidate` and accept some staleness.
- **OG image dimensions.** 1200×630 is the OG standard; Twitter accepts 1200×600 / 2:1; Discord accepts both. Use 1200×630.
- **Privacy.** Any data shown in the OG is public. The owner's match-detail OGs are fine because the owner intentionally shares. For future "multi-account portfolio" or shared-link-anyone-can-access scenarios, consider what's appropriate to leak in OG.

---

## Reduced motion

Static images; no motion concerns.
