# Steam description image rendering

**Status:** Active — chunk 1 (parser token substitution) shipped 2026-05-26; chunk 2 attempted 2026-05-26 and **reverted same-day** (the slug-form `extras/<name>.<ext>` URL it proxied doesn't exist on Steam's CDN — Steam stores extras as content-hashed `<hash>.poster.avif` + `<hash>.webm` exposed via `<video>` in the storefront's pre-rendered `about_the_game` HTML). Arc pivoted to **Option A: consume the rendered HTML directly**. Chunk A1 (storage + sync) is the next entry point.

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
| 1 ✅ | `bbcodeToHtml` token substitution | `packages/shared` | Shipped 2026-05-26. Optional `appid` arg; `{STEAM_APP_IMAGE}` substituted via canonical CDN base; inner-text preferred over malformed attribute for token-shaped sources. Retained post-pivot because the parser is still on the critical path for any non-extras `{STEAM_APP_IMAGE}` reference and for parser-level case-study writeups. |
| ~~2~~ | ~~Passthrough proxy for `extras/<slug>.<ext>`~~ | `apps/api/src/img` | **Attempted + reverted 2026-05-26 (commit 43667a0 → revert 3689c93).** Built a content-type passthrough route at `/img/steam/desc/<appid>/extras/<assetName>.<ext>`. Upstream returns 404 across all three CDN hosts and all extension probes — the slug path simply doesn't exist on the CDN. See "The source shape" finding above. |
| A1 | Storage + sync | `apps/api/src/steam` + Prisma | Add `aboutTheGameHtml` column to `SteamGameEnrichment` (or equivalent). Populate from `storefront/api/appdetails?appids=<appid>&l=en` during existing game-enrichment sync. Verify whether the sync already hits `appdetails` (likely — that's where `fullDescriptionBbcode` comes from) and extend it rather than introducing a second call. Migration + sync extension + backfill script. |
| A2 | Sanitiser extensions | `packages/shared/src/lol/sanitize-rich-html.ts` (or split per-domain) | Allow `<video>` + `<source>` + `<br>` with strict per-tag attribute allowlists. Allowed video attrs: `autoplay muted loop playsinline poster preload width height`. Source attrs: `src type`. Rewrite `src` and `poster` via callback. Strip Steam's `class="bb_*"` noise (we re-style via Tailwind anyway). Confirm `<br>` survives — `bb_tag` heading classes already get stripped. |
| A3 | Description-asset proxy | `apps/api/src/img` | Route shape `/img/steam/desc/<appid>/extras/<hash>.<ext>` with `ext ∈ {webm, avif, png, jpg, jpeg}`. Image branch (avif/png/jpg) uses the existing buffer-and-send shape. **Video branch (`webm`) streams with `Range` / `206 Partial Content`** — new pattern for the proxy. Cache-Control immutable for content-hashed paths. |
| A4 | Consumer flip | `apps/web/src/steam/game` | Switch `useGameDescription` source from bbcode to `aboutTheGameHtml`. Replace `rewriteImgSrcDrop` with rewriters for `<img src>`, `<video poster>`, `<source src>` that route hashed `extras/...` URLs through the proxy. Render `<video>` via `dangerouslySetInnerHTML` (sanitiser now allows it). Update the policy comment block. |
| A5 | Editorial polish | `apps/web/src/steam/game` | Cap rendered media count per description (first 3–5). Add `loading="lazy"` + `decoding="async"` to `<img>`. Add `preload="metadata"` to `<video>` so the WebM isn't eagerly downloaded. Honor `prefers-reduced-motion` (replace `<video>` with the AVIF poster as `<img>`, or pause + remove `autoplay`). Width-cap CSS. |
| A6 | Tests | all layers | API: range-request shape (200 vs 206, `Content-Range`, partial bytes), MIME branching, validation guards. Sanitiser: `<video>`/`<source>` allowlist + strip of disallowed attributes + class scrubbing. Web: snapshot of Elden Ring's about-block with media on, `prefers-reduced-motion` fallback. |
| A7 *(optional)* | Backfill probe | `apps/api/src/steam` | One-off script to populate `aboutTheGameHtml` for already-synced games so the first render isn't blocked on enrichment. Makes the rollout feel instant. |

## Risks / decisions to revisit at start

- **Sync extension shape** — confirm whether existing Steam-game-enrichment code already calls `appdetails` for bbcode. If so, A1 is a column-add + extend-existing-mapper. If not, A1 needs a new API client surface + rate-limit considerations.
- **Range-streaming pattern** — current `fetchUpstream` buffers the whole response into a `Buffer` and `res.send`s it. WebM clips can be 1–10 MB each × 5 per page; buffer-then-send wastes memory and breaks `Range` requests. A3 likely needs a streaming variant (`fetch` body → `ReadableStream` → pipe to `res`) that honours upstream `Content-Range`/`Accept-Ranges`. This is the meatiest chunk.
- **`prefers-reduced-motion` policy** — pause + remove `autoplay`, or swap `<video>` for the AVIF poster as `<img>`? The latter avoids loading the WebM entirely (bandwidth + battery). Probably worth the asymmetry.
- **Sanitiser scope** — does the LoL sanitiser become Steam-aware (`<video>` allowed only under a Steam opt-in), or do we split a Steam-specific sanitiser? The LoL shape doesn't need `<video>` and arguably shouldn't allow it. Lean toward an opt-in flag (`{ allowVideo: true }`) rather than a fork.
- **DLC / bundle empty `about_the_game`** — many DLC entries have empty or trivial `about_the_game`. The existing `null`-return branch in `GameAboutBlock` handles this, but confirm A1's sync sets the column to `null` (not empty string) for those rows.

## Pointer hygiene

When this arc starts, add `**Steam surfaces:**` subsection to [open-work.md](../open-work.md) and link this note. When it ships, move the rendered-images entry into [project-history.md](../project-history.md) and mark this note `**Status:** Shipped` (or archive).
