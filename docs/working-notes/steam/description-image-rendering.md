# Steam description image rendering

**Status:** Active — chunks 1 (parser token substitution) + 2 (API proxy passthrough family `store_item_assets/extras`) shipped 2026-05-26; inline images still dropped wholesale at the consumer until chunk 5. Chunk 3 (extension resolution via HEAD-probe + Postgres cache) is the next entry point.

## Today's behaviour

Steam game-detail descriptions (`SteamGameEnrichment.fullDescriptionBbcode`) render via the chain:

1. [packages/shared/src/steam/bbcode-to-html.ts](../../../packages/shared/src/steam/bbcode-to-html.ts) — BBCode → HTML
2. [packages/shared/src/lol/sanitize-rich-html.ts](../../../packages/shared/src/lol/sanitize-rich-html.ts) — trust boundary
3. [apps/web/src/steam/game/game-about-block.tsx](../../../apps/web/src/steam/game/game-about-block.tsx) — `dangerouslySetInnerHTML`

The parser now correctly converts both `[img]URL[/img]` and `[img=URL ...]label[/img]` to `<img src="…">`. The consumer then **drops every image** by passing `rewriteImgSrc: rewriteImgSrcDrop` ([game-about-block.tsx:12](../../../apps/web/src/steam/game/game-about-block.tsx#L12)) to the sanitiser. The drop is intentional and the comment at the call site says why: there's no generic Steam-description image proxy yet, and rendering raw `steamcdn-a.akamaihd.net` URLs would leak the upstream, skip caching/transcode, and bypass the rest of the project's image-pipeline discipline.

So the visual gap on the game-detail "About this game" block (no gameplay gifs, no publisher-curated highlights) is a deliberate floor we set in [`game-about-block.tsx`](../../../apps/web/src/steam/game/game-about-block.tsx), not a parser bug.

## The source shape

Verified live for Elden Ring (`appid 1245620`) via `GET /steam/game/1245620/description` on 2026-05-25. Each inline image is emitted as:

```
[img=http://STEAM_APP_IMAGE}/extras/er_steam_gif_01_-_wide fromclient=1]{STEAM_APP_IMAGE}/extras/er_steam_gif_01_-_wide[/img]
```

Three quirks to handle:

1. **Token, not URL.** `{STEAM_APP_IMAGE}` is Steam's template placeholder. Canonical substitution is `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/<appid>` (also reachable through `cdn.cloudflare.steamstatic.com` and `shared.steamstatic.com`).
2. **No extension.** `er_steam_gif_01_-_wide` is path-only. The `_gif_` substring is a naming hint, not a contract — Steam's own renderer resolves the extension via storefront metadata we don't fetch. Real-world set seen on Elden Ring: all `.gif`. Other publishers ship `.png`/`.jpg`.
3. **Attribute URL is malformed.** Note `http://STEAM_APP_IMAGE}` (missing `{`, `http` not `https`). The inner-text token is the trustworthy one. Our 2026-05-25 fix prefers the attribute URL but falls back to inner-text — for these we'd want the opposite preference or skip the attribute entirely once we recognise the token.

The same token (`{STEAM_CLAN_IMAGE}` for community-image references) may appear in some descriptions; treat them as a follow-up family — Elden Ring doesn't use it.

## What rendering this unlocks

- Animated gameplay gifs in-place on the game-detail page, matching Steam's storefront editorial intent.
- A new Steam image-proxy family (description assets) — symmetric with the existing LoL 12-family proxy, closes the last unproxied Steam image surface.
- Reusable shape for future bbcode surfaces (community posts, news, workshop) if those ever land.

## Framing decision

**Decided 2026-05-26: ship as a proxy-engineering chapter.** The case-study value (token parsing, extension probing, animated-gif transcode, cache layering, closing the last unproxied Steam image family) is the headline. Visual enrichment of the about-block is a side effect, not the goal — so scope the editorial polish (chunk 6: per-description cap, reduced-motion handling, width-cap) to keep the surface from drifting toward "Steam storefront clone."

Recorded tradeoff for reference:

- **For:** Symmetric with the LoL 12-family proxy. Concrete depth on top of the existing image pipeline. The malformed-attribute / token-substitution / no-extension trio is unusual enough to write up.
- **Against (mitigated by chunk 6):** Publisher marketing gifs aren't self-portrait content. The editorial cap + reduced-motion gate keeps the visual footprint bounded so the page still reads as "what this player thinks about this game" rather than "publisher promo loop."

---

## Chunk plan

Sized so each row is independently committable and verifiable. Total estimate: ~6–9 focused chunks. The first four are the technical core; the last three are productisation.

| # | Title | Lands in | Notes |
|---|---|---|---|
| 1 ✅ | `bbcodeToHtml` token substitution | `packages/shared` | Shipped 2026-05-26. Optional `appid` arg; `{STEAM_APP_IMAGE}` substituted via `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/<appid>`; inner-text preferred over the malformed attribute when it begins with a recognised template token; `{STEAM_CLAN_IMAGE}` deferred to chunk 9. |
| 2 ✅ | API proxy family: `store_item_assets/extras` | `apps/api/src/img` | Shipped 2026-05-26. New route `GET /img/steam/desc/:appid/extras/:assetName.:ext` (ext ∈ `gif|png|jpg|jpeg`, assetName `[a-zA-Z0-9_-]+`). Content-type passthrough (no WebP transcode — chunk 4 will revisit `.gif`). `SteamImageService.descriptionAsset` is pure URL composition (no DB lookup). `proxyPassThrough` helper added to controller; week-long cache (`max-age=604800`) since publishers update extras. Tests cover validation guards, ext allowlist, 502 fallthrough, lowercase-ext delegation. |
| 3 | Extension resolution | `apps/api/src/img` | First miss: HEAD-probe `.gif`, `.png`, `.jpg` in that order against the upstream CDN; cache the winning ext per `(appid, asset)` in Postgres (`SteamDescriptionAssetExt` row or column on existing enrichment). Falls back to 404 if all three miss. |
| 4 | Animated GIF transcode policy | `apps/api/src/img` | Decide: pass-through `.gif`, transcode to `.webp` (smaller, single-pass), or `.mp4`/`.webm` (smallest, but adds `<video>` rendering on the consumer side). Lean WebP — keeps `<img>` tag, ~70-80% size reduction vs gif. Validate animation preservation. |
| 5 | Consumer flip: route via proxy | `apps/web/src/steam/game` | Replace `rewriteImgSrcDrop` in [game-about-block.tsx](../../../apps/web/src/steam/game/game-about-block.tsx) with a rewriter that recognises `{STEAM_APP_IMAGE}`-substituted URLs and rewrites them to the `/img/steam/desc/...` proxy path. Update the comment block at [game-about-block.tsx:5-13](../../../apps/web/src/steam/game/game-about-block.tsx#L5) describing the new policy. |
| 6 | Editorial polish | `apps/web/src/steam/game` | Cap image count per description (e.g. first 3) to keep scroll length sane. Add `loading="lazy"` + `decoding="async"`. Width-cap CSS so wide promo banners don't blow out the card. Honor `prefers-reduced-motion` for animated assets (pause to first frame, or skip rendering). |
| 7 | Tests | both layers | Parser: token-substitution variants, malformed attribute form, both `{STEAM_APP_IMAGE}` and `{STEAM_CLAN_IMAGE}`. API: extension-probe cache, 404 fallthrough, transcode output. Web: snapshot of Elden Ring's about-block with images on. |
| 8 *(optional)* | Backfill probe | `apps/api/src/steam` | One-off script: parse every stored `fullDescriptionBbcode`, extract `(appid, asset)` pairs, pre-warm the extension cache so the first browser request isn't a probe miss. Cheap, makes the rollout feel instant. |
| 9 *(optional)* | `{STEAM_CLAN_IMAGE}` family | both layers | Only if a real game in the library uses it. Same shape as chunks 2–3, different upstream root (`steamcommunity/public/images/clans/<clanid>/`). |

## Risks / decisions to revisit at start

- **Sanitizer img policy** — confirm [sanitize-rich-html.ts](../../../packages/shared/src/lol/sanitize-rich-html.ts) actually preserves `<img>` tags through to `rewriteImgSrc`. If it strips `<img>` outright, the LoL-shared sanitiser needs an opt-in, or Steam needs its own sanitiser variant.
- **Animated GIF cost** — Elden Ring ships 5 wide gifs; some publishers (early access, demo storefronts) ship 10+. Decide on a per-page cap *before* enabling rendering — easier than retrofitting.
- **HEAD-probe latency** — three sequential HEADs on first miss is ~600ms-1s on cold cache. Either parallelise probes or accept the cold-fetch latency since it only happens once per asset. Chunk 8 (backfill) makes this moot in production.
- **Transcode worker shape** — chunk 4 introduces ffmpeg/sharp in the request path. Decide whether to do it inline (simple, blocks request) or via a background BullMQ job (matches the planned LoL backfill worker shape — see CLAUDE.md note on Redis/BullMQ).

## Pointer hygiene

When this arc starts, add `**Steam surfaces:**` subsection to [open-work.md](../open-work.md) and link this note. When it ships, move the rendered-images entry into [project-history.md](../project-history.md) and mark this note `**Status:** Shipped` (or archive).
