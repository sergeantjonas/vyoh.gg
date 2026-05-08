# Server-rendered OG share cards: Satori → SVG → resvg → PNG

Pasting a match URL into Slack, Discord, Twitter, or Telegram triggers a fetch for an Open Graph image. Each match URL gets a unique 1200×400 card showing champion splash + KDA + win/loss + queue + account name — pure server-rendered PNG, no headless browser, no Vercel dependency.

## The pipeline

Two libraries chained:

1. **[satori](https://github.com/vercel/satori)** turns a JSX-like tree into SVG, applying flexbox layout in pure JS. No DOM, no Chromium, no fonts-via-system-call — fonts are passed in as `Buffer`s and applied through Satori's own text-shaping (Yoga + ufo).
2. **[@resvg/resvg-js](https://github.com/yisibl/resvg-js)** converts the SVG to PNG via Rust bindings. Satori's SVG output is intentionally narrow in feature scope (no filters, no clip paths beyond rectangles) so resvg can render it deterministically across platforms.

Sequenced in [apps/api/src/og/og-card.ts](../../apps/api/src/og/og-card.ts):

```
fetch splash → base64 data URL  ─┐
                                 ├─→ satori(card, {fonts}) → SVG → resvg.render() → PNG buffer
build JSX-like tree of <div>s ───┘
```

The endpoint (`GET /og/match/:slug/:matchId.png`) resolves the slug via `IdentityService`, fetches match detail from `LolService`, finds the user's participant, and pipes the result to `renderMatchCard`. PNG returned with `Cache-Control: public, max-age=86400, s-maxage=2592000` — match data is immutable post-game, cache aggressively.

## Constraints worth flagging

**Satori is flexbox-only.** Every `<div>` with more than one child must declare `display: flex`, `display: contents`, or `display: none` — it errors loudly otherwise. Block layout doesn't exist. Once you internalize this it composes cleanly, but the first time the validator fires it's startling.

**Fonts must be TTF / OTF (not woff2).** The web app uses `@fontsource-variable/geist` which ships only woff2. Satori needs raw font tables. Solution: hit Google Fonts' CSS endpoint with an old User-Agent (`Mozilla/4.0`) — Google detects the legacy UA and returns `format('truetype')` URLs in the @font-face rules. Download the TTFs once, commit them to [apps/api/src/og/fonts/](../../apps/api/src/og/fonts/), load via `readFileSync` at module init.

**SWC's `outDir` is verbatim.** NestJS' SWC builder doesn't strip `rootDir` like `tsc` would, so `src/og/og-fonts.ts` lands at `dist/src/og/og-fonts.js` — and `__dirname` resolves to `dist/src/og/`. The `nest-cli.json` `assets` config has to copy fonts to `dist/src/og/fonts/` (not `dist/og/fonts/`) for the file lookups to succeed at runtime.

## Open: bot-visible meta tags

The endpoint produces a real PNG and the route declares the OG meta tags via TanStack Router's `head` config — but vyoh.gg is a SPA without SSR, so the meta tags only populate client-side after JS executes. Slack, Twitter, and Discord don't run JS; they parse static HTML. To close this loop, the deployed setup needs either (a) a bot-detection middleware that returns pre-baked HTML for known crawler UAs, or (b) full SSR via TanStack Start. Both are deployment-shape decisions that are premature without a target — the durable artifact (the PNG endpoint) is hosted independently.
