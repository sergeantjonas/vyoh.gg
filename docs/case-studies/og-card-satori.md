# Server-rendering OG share cards without a headless browser

## TL;DR

When a match URL is pasted into Slack, Discord, Twitter, or Telegram, the platform fetches an Open Graph image. Each match deserves its own card — champion splash, KDA, win/loss color, queue, account name — and the canonical way to do this in 2026 is "spin up Puppeteer, screenshot a page." That's three orders of magnitude of complexity (a Chromium binary, a worker pool, GPU acceleration concerns, font fingerprinting) for a 1200×400 PNG. The shape that works: chain two narrow tools. [satori](https://github.com/vercel/satori) layouts a JSX-like tree into SVG with a flexbox-only subset. [@resvg/resvg-js](https://github.com/yisibl/resvg-js) renders that SVG to PNG via Rust bindings. Total runtime cost is a fetch (the splash), one font load (at module init), one SVG synthesis, one rasterization. No browser. The interesting engineering is in the *constraints* — Satori's narrow CSS subset, the TTF-not-woff2 font requirement, and the SWC build-output path quirk that bit us in production.

## Setup

The endpoint:

```ts
@Get("match/:slug/:matchId.png")
@Header("Content-Type", "image/png")
@Header("Cache-Control", "public, max-age=86400, s-maxage=2592000")
async matchCard(
  @Param("slug") slug: string,
  @Param("matchId") matchId: string,
  @Res() res: Response
): Promise<void> {
  const png = await this.og.generateMatchCard(slug, matchId);
  res.send(png);
}
```

A match URL is immutable post-game (the kills, the build, the win/loss never change), so the response is aggressively cached: 1 day at the browser, 30 days at any shared cache. The expensive work happens once per match-ever, not once per share.

The endpoint resolves the slug to an account via `IdentityService`, fetches the match detail through `LolService` (same path as the rest of the API), finds the user's participant in the participant list, and hands the relevant fields to `renderMatchCard`.

## The pipeline — two libraries chained

```
fetch splash → base64 data URL  ─┐
                                 ├─→ satori(card, {fonts}) → SVG → resvg.render() → PNG buffer
build JSX-like tree of <div>s ───┘
```

Three primitives in sequence:

1. **Fetch the champion splash and encode as a data URL.** Satori needs the image inline — it doesn't fetch network resources during layout. The splash arrives as a JPEG buffer, gets base64-encoded into a `data:image/jpeg;base64,…` URL, and is referenced by the `<img>` in the tree.
2. **Build the tree and pass it to `satori`.** The tree is a JSX-like object structure with `type`, `props`, and `children`. A tiny `e(type, props, ...children)` helper avoids a JSX/runtime dependency in a file that has no other reason to use JSX. Satori applies flexbox layout via Yoga, shapes text with ufo, and outputs SVG.
3. **Rasterize the SVG with resvg.** `new Resvg(svg).render().asPng()` returns a PNG buffer. resvg's Rust bindings are deterministic across platforms — important for an image that needs to look identical when re-rendered on different deploy machines.

The full `renderMatchCard` lives at [apps/api/src/og/og-card.ts](../../apps/api/src/og/og-card.ts).

## Constraint 1 — Satori is flexbox-only

Every `<div>` with more than one child must declare `display: flex`, `display: contents`, or `display: none`. Block layout doesn't exist:

```ts
e("div", {
  style: {
    display: "flex",        // required
    position: "relative",
    width: 1200,
    height: 400,
    backgroundColor: "#0a0a0a",
    color: "#f4f4f5",
    fontFamily: "Geist",
  },
}, ...)
```

The validator errors loudly on missing `display: flex` ("Expected display: flex on …"), which is the right failure mode — silent block-layout rendering would produce subtly wrong output. The constraint composes cleanly once internalized: every container is a flex parent, every child is laid out by main/cross axis, no float/positioning headaches except absolute-positioned decorations.

The card uses `position: absolute` for the splash image, the gradient overlay, and the bottom accent bar — these are decorative layers stacked over a flex column that carries the actual content. Mixing flex and absolute positioning is fine; only the *children of the same flex parent* need to declare `display: flex`.

## Constraint 2 — TTF / OTF only, not woff2

Satori needs raw font tables (the binary tables a font reader walks: `head`, `cmap`, `glyf`, etc.). The web app uses `@fontsource-variable/geist`, which ships only `.woff2` files — a compressed wrapper that Satori's loader doesn't decode.

The workaround is to fetch the TTF from Google Fonts via the legacy CSS endpoint:

```
GET https://fonts.googleapis.com/css2?family=Geist:wght@400;600
User-Agent: Mozilla/4.0
```

Modern browsers get `format('woff2')` URLs back. The legacy User-Agent triggers Google's fallback that returns `format('truetype')` URLs — TTF binaries you can save once and check in. The fonts live at [apps/api/src/og/fonts/](../../apps/api/src/og/fonts/) and are loaded synchronously at module init:

```ts
const fontsDir = join(__dirname, "fonts");

export const fonts = [
  {
    name: "Geist",
    data: readFileSync(join(fontsDir, "Geist-Regular.ttf")),
    weight: 400,
    style: "normal",
  },
  {
    name: "Geist",
    data: readFileSync(join(fontsDir, "Geist-SemiBold.ttf")),
    weight: 600,
    style: "normal",
  },
] as const;
```

`readFileSync` at module load is fine here — Nest boot is synchronous, the fonts are small (~80 KB each), and the alternative (async-loaded fonts shared via a service) would put state machinery on top of two byte arrays that never change.

The Mozilla/4.0 trick is brittle (Google could remove it tomorrow) but the fonts are checked in, so a future Google policy change doesn't break production — it only breaks the *re-download path*, which would only matter if we wanted to switch font weights.

## Constraint 3 — SWC's `outDir` is verbatim

This one bit production. NestJS uses SWC as its TypeScript builder in this project; SWC's `outDir` semantics differ from `tsc`'s — it doesn't strip the `rootDir` prefix the way `tsc` would. So `src/og/og-fonts.ts` lands at `dist/src/og/og-fonts.js`, not `dist/og/og-fonts.js`. Which means `__dirname` at runtime resolves to `dist/src/og/`, not `dist/og/`.

`nest-cli.json`'s `assets` config has to mirror this:

```json
{
  "compilerOptions": {
    "assets": [
      { "include": "og/fonts/*.ttf", "outDir": "dist/src/og/fonts" }
    ]
  }
}
```

`dist/og/fonts/` (the intuitive path) doesn't work. The first version of this used the intuitive path and worked fine in dev (where the fonts loaded from `src/og/fonts/` directly), failed in production with `ENOENT`. The diagnostic was confusing: "the fonts are checked in, why is `readFileSync` failing." The answer was that the asset copy and the `__dirname` resolution had diverged by one path segment.

The lesson generalizes: any time `__dirname`-relative file loads are involved in a NestJS service, the asset-copy paths in `nest-cli.json` must match the actual `outDir` shape SWC produces — not the intuitive shape `tsc` would have produced.

## Why this beats a headless browser

Three points where Satori + resvg is structurally better than Puppeteer / Playwright for this job:

- **No Chromium binary.** A typical Puppeteer Docker image is 300+ MB. The `satori` + `@resvg/resvg-js` dependencies are a few MB total. Deploy size matters for cold-start latency and image-pull cost.
- **Deterministic across platforms.** resvg's Rust renderer produces byte-identical output on different machines for the same SVG input. Chromium's renderer drifts subtly across versions and OS font-stack quirks — a CI machine on Linux can produce a different PNG than a deploy machine on Linux ARM. Determinism matters for cache invalidation: if the PNG bytes change on every redeploy, the cache is useless.
- **No worker pool.** Each request runs the pipeline synchronously inside the request lifecycle (~100 ms typical, depending on splash fetch). Puppeteer needs a pool of pre-warmed browser contexts to keep latency reasonable, which adds a "warm a browser on boot" startup tax.

The downside is the constraint surface. Satori can't do everything CSS can do; complex effects (filters, custom clip paths beyond rectangles, SVG masks beyond basic alpha) either aren't supported or produce subtly different output than the spec. For a card whose entire visual budget is "splash background, KDA text, accent bar," those limits don't bite. For a card that wants animated gradients and CSS `backdrop-filter: blur`, they would.

The shape of the trade is "narrow tool that does this one thing well" vs. "general-purpose tool that does everything but at 100× the cost." For OG cards, narrow wins.

## What's open — bot-visible meta tags

The PNG endpoint works. The other half of OG sharing — declaring `<meta property="og:image" content="…">` in the served HTML — does not yet work in this app's deploy shape.

vyoh.gg is a SPA without server-side rendering. The match route declares OG meta tags via TanStack Router's `head` config, which populates them client-side after JS executes. Slack, Twitter, and Discord crawlers don't run JS — they parse static HTML, find no `og:image` tag, and fall back to whatever generic site card they can scrape.

Two ways to close this loop, both deferred:

1. **Bot-detection middleware.** Detect known crawler User-Agents on the request to `/` and serve pre-baked HTML with the right OG tags, fetched from the API. Lower deploy commitment; works on any host. The downside is the User-Agent list needs maintenance.
2. **Full SSR via TanStack Start.** Convert the SPA into a server-rendered app. Higher commitment (rewrites the routing layer, changes the deploy shape), but fixes the OG problem for free and earns several other wins (faster first paint, real meta tags for every route).

Both are deployment-shape decisions that don't get made until there's a target deploy. The durable artifact — the PNG endpoint — is hosted independently of either decision, so it isn't blocked by either.

## What this earns

- **An OG card pipeline that runs in the API process, with no browser.** ~100 ms per generation, deterministic output, ~30-day shared cache so the work happens once per match.
- **A pattern for "do this in a narrow tool, not a general one."** The satori/resvg chain is two libraries doing one thing each — layout SVG, rasterize SVG. Composing narrow tools instead of reaching for the general-purpose browser is the load-bearing decision.
- **A working asset-copy template for SWC-built NestJS.** The `dist/src/og/fonts/` path is documented for the next time `__dirname`-relative file loads need to ship.

## Looking back

The first instinct on "render a custom image per route" is to spin up a headless browser, because that's what every "OG image" tutorial assumes. The second instinct, on noticing the deploy cost, is to find a hosted service like Vercel's `@vercel/og`. The third instinct, on realizing `@vercel/og` is *also* satori + resvg under the hood, is to chain the same two libraries directly and stay vendor-neutral. We landed on the third. The work was 200 lines including the asset-copy fix.
