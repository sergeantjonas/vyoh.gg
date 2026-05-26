# Steam description image rendering

**Status:** Active — A1–A5 shipped 2026-05-26 end-to-end (lazy-fetched `about_the_game` HTML → sanitiser-allowed `<video>`/`<source>` → range-streaming description-asset proxy → consumer rendering with `prefers-reduced-motion` swap + media render cap). Tests landed alongside each chunk per project policy, so the original A6 (dedicated test sweep) folded into A1–A5. Only A7 (eager backfill probe to skip the first-view lazy-fetch wait) remains, optional.

## Today's behaviour

Steam game-detail descriptions (`SteamGameEnrichment.fullDescriptionBbcode`) render via the chain:

1. [packages/shared/src/steam/bbcode-to-html.ts](../../../packages/shared/src/steam/bbcode-to-html.ts) — BBCode → HTML
2. [packages/shared/src/lol/sanitize-rich-html.ts](../../../packages/shared/src/lol/sanitize-rich-html.ts) — trust boundary
3. [apps/web/src/steam/game/game-about-block.tsx](../../../apps/web/src/steam/game/game-about-block.tsx) — `dangerouslySetInnerHTML`

The parser now correctly converts both `[img]URL[/img]` and `[img=URL ...]label[/img]` to `<img src="…">`. The consumer then **drops every image** by passing `rewriteImgSrc: rewriteImgSrcDrop` ([game-about-block.tsx:12](../../../apps/web/src/steam/game/game-about-block.tsx#L12)) to the sanitiser. The drop is intentional and the comment at the call site says why: there's no generic Steam-description image proxy yet, and rendering raw `steamcdn-a.akamaihd.net` URLs would leak the upstream, skip caching/transcode, and bypass the rest of the project's image-pipeline discipline.

So the visual gap on the game-detail "About this game" block (no gameplay gifs, no publisher-curated highlights) is a deliberate floor we set in [`game-about-block.tsx`](../../../apps/web/src/steam/game/game-about-block.tsx), not a parser bug.

## The source shape

Verified live for Elden Ring (`appid 1245620`) on 2026-05-26 via two independent probes:

**1. BBCode (what our DB stores).** `GET /steam/game/1245620/description` returns:

```
[img=http://STEAM_APP_IMAGE}/extras/er_steam_gif_01_-_wide fromclient=1]{STEAM_APP_IMAGE}/extras/er_steam_gif_01_-_wide[/img]
```

Three quirks to handle at the parser layer (all addressed in chunk 1):
1. **Token, not URL.** `{STEAM_APP_IMAGE}` is Steam's template placeholder. Canonical substitution is `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/<appid>`.
2. **No extension.** `er_steam_gif_01_-_wide` is path-only. The `_gif_` substring is a publisher-supplied naming hint, not a contract.
3. **Attribute URL is malformed.** `http://STEAM_APP_IMAGE}` is missing `{` and uses `http` not `https`. Inner-text token is the trustworthy one.

**2. Rendered HTML (what Steam's storefront serves to users).** `GET https://store.steampowered.com/api/appdetails?appids=1245620&l=en` returns an `about_the_game` field with each inline image fully rendered as:

```html
<video class="bb_img" autoplay muted loop playsinline crossorigin="anonymous"
       poster="https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1245620/extras/b2d503549e33e6603c86b6bd7babdb38.poster.avif?t=1767883716"
       width=780 height=320>
  <source src="https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1245620/extras/b2d503549e33e6603c86b6bd7babdb38.webm?t=1767883716" type="video/webm">
</video>
```

**Critical finding (2026-05-26):** the bbcode slug `er_steam_gif_01_-_wide` is an editorial label, not a CDN path. The actual stored assets are content-hashed `<md5>.poster.avif` (still) + `<md5>.webm` (animation), and the slug→hash mapping lives only in Steam's backend — exposed exclusively through `about_the_game`. Direct fetches of `/extras/<slug>.gif` (any host, any ext) return 404. This invalidated the original chunks 2–4.

The same token (`{STEAM_CLAN_IMAGE}` for community-image references) may appear in some descriptions; treat as a follow-up family — Elden Ring doesn't use it.

## What rendering this unlocks

- Animated gameplay clips in-place via `<video>` autoplay (WebM), matching Steam's own storefront output.
- A new description-asset proxy family in `apps/api/src/img` — covers WebM (video) + AVIF (poster). Closes the last unproxied Steam image surface AND adds a new video-mime branch to the proxy (range/streaming).
- A video-aware sanitiser policy (current LoL sanitiser is `<img>`-only).
- Reusable shape for future Steam HTML surfaces (community posts, news, workshop) if those ever land.

## Framing decision

**Decided 2026-05-26: ship as a proxy-engineering chapter (Option A pivot).**

Original framing (proxy + bbcode token resolution) was invalidated when we discovered the slug-form CDN path doesn't exist. Rather than build a slug→hash resolver service on top of bbcode (Option B), we pivoted to consuming Steam's pre-rendered `about_the_game` HTML directly. Case-study value shifts from "bbcode token parser" to "video-capable sanitiser + range-streaming proxy for a new media class" — equally rich, more current.

Recorded tradeoffs for reference:

- **For Option A:** Steam does slug→hash resolution server-side. We render in the modern formats Steam itself ships (WebM + AVIF), not gif transcode. Range-streaming the proxy is a substantive new chapter. Single source of truth (`about_the_game` column).
- **Against Option A:** Bbcode parser work (chunk 1) becomes mostly cosmetic for the extras case — still useful for any non-extras `{STEAM_APP_IMAGE}` references. Sanitiser needs `<video>`/`<source>` support, not just `<img>`. Range/206 handling is new for the proxy.
- **Against the publisher-marketing concern:** editorial cap + `prefers-reduced-motion` gate (chunk A5) keeps the about-block from drifting into "publisher promo loop" framing.

---

## Chunk plan (post-pivot, 2026-05-26)

Sized so each row is independently committable and verifiable. Total estimate: ~6–7 focused chunks plus tests.

| # | Title | Lands in | Notes |
|---|---|---|---|
| 1 ✅ | `bbcodeToHtml` token substitution | `packages/shared` | Shipped 2026-05-26 (678dbf2). Optional `appid` arg; `{STEAM_APP_IMAGE}` substituted via canonical CDN base; inner-text preferred over malformed attribute for token-shaped sources. Retained post-pivot because the parser still backs the BBCode fallback branch when `aboutTheGameHtml` is null. |
| ~~2~~ | ~~Passthrough proxy for `extras/<slug>.<ext>`~~ | `apps/api/src/img` | **Attempted + reverted 2026-05-26 (43667a0 → revert 3689c93).** Slug-form CDN path doesn't exist; see "The source shape" finding above. |
| A1.1 ✅ | Storage column | Prisma + migration | Shipped 2026-05-26 (e32ab13). `aboutTheGameHtml String?` on `SteamGameEnrichment`. Three-state column: `null` = never fetched (retry), `""` = terminal (delisted / Steam reports empty), HTML = cached. |
| A1.2 ✅ | Lazy fetcher + persistence | `apps/api/src/steam` | Shipped 2026-05-26 (8415219). `SteamClientService.getAboutTheGameHtml(appid)` routes through the shared limiter under an `appdetails` family. `getGameDescription` returns `{ appid, bbcode, html }` and lazy-populates on cold reads. Lazy chosen over eager backfill because the legacy `appdetails` endpoint doesn't batch (~25 min serialised for a 500-game library). |
| A2 ✅ | Sanitiser extensions | `packages/shared/src/lol/sanitize-rich-html.ts` | Shipped 2026-05-26 (848afa9). `allowVideo: true` opt-in (LoL path stays restrictive). Strict allowlists: `<video>` keeps playback directives + `width`/`height`; `<source>` keeps `src` + `type`. `rewriteVideoUrl` callback handles both `<video poster>` and `<source src>`. Steam's `class="bb_*"` noise stripped automatically (no `class` in either allowlist). |
| A3 ✅ | Description-asset proxy | `apps/api/src/img` | Shipped 2026-05-26 (c1ea65a). Route `/img/steam/desc/:appid/extras/:asset`; 32-hex hash + optional `.poster` subext validated client-side and server-side. New `streamUpstream` helper in `upstream.ts` pipes upstream via `Readable.fromWeb` instead of buffering — forwards `Range` and surfaces 206/`Content-Range`. Cache-Control 7 days (the hash is the cache key). |
| A4 ✅ | Consumer flip | `apps/web/src/steam/game` | Shipped 2026-05-26 (7dc9a8f). `useRenderedDescription` prefers `html` over `bbcode`; `rewriteSteamDescriptionAssetUrl` helper added to `steam-image.ts` (validates upstream URL shape, strips `?t=` cache-buster, routes to proxy). BBCode renders as fallback for cold-window, transient failures, and `html === ""` delisted-sentinel. |
| A5 ✅ | Editorial polish | `apps/web/src/steam/game` | Shipped 2026-05-26 (b3eeb7d). Post-sanitiser DOM pass via `DOMParser`: under `prefers-reduced-motion`, `<video>` swaps to `<img src="<poster>">` (WebM never downloads); otherwise `<video preload="metadata">` keeps the bytes off the wire until play; `<img loading="lazy" decoding="async">` everywhere. Combined media-count cap of 5. |
| A7 *(optional, pending)* | Backfill probe | `apps/api/src/steam` | One-off script to populate `aboutTheGameHtml` for already-synced games so the first render isn't blocked on a lazy-fetch round-trip. Makes the rollout feel instant. Not started — defer until a marquee surface shows a visible cold-window. |

## Risks / decisions, resolved during the arc

- **Sync extension shape** — discovered existing sync uses `IStoreBrowseService/GetStoreItemsFull` which does NOT return rendered HTML. A1.2 added a new `SteamClientService.getAboutTheGameHtml(appid)` against the legacy storefront endpoint at `store.steampowered.com/api/appdetails`. Different host; the `fetchJson` helper was extended to accept either a path under `STEAM_API_BASE` or an absolute URL.
- **Range-streaming pattern** — A3 added `streamUpstream` alongside `fetchUpstream` rather than refactoring the existing buffered helper. The buffered path stays as-is for image transcode (Sharp needs a `Buffer` anyway); only the description-asset route uses streaming.
- **`prefers-reduced-motion` policy** — chose poster-swap over pause-and-strip-autoplay. Saves the WebM download entirely under reduce-motion; the AVIF poster reads the same editorial intent without the motion cost.
- **Sanitiser scope** — opted for a single shared sanitiser with `{ allowVideo: true }` opt-in (no Steam fork). LoL callers don't pass the flag, so the LoL tooltip path stays restrictive.
- **DLC / bundle empty `about_the_game`** — handled via the three-state column. Steam's `success: true` + missing `about_the_game` resolves to `""`, persisted as the terminal don't-retry sentinel. `GameAboutBlock` falls back to BBCode when html is empty/null.

## Pointer hygiene

A1–A5 are now shipped. Once A7 lands (or is parked indefinitely), promote this note's headline arc into [project-history.md](../project-history.md) and flip `**Status:**` to Shipped.
