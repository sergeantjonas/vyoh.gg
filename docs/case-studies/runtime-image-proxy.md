# Runtime image proxy — replacing a working build-time bundle with a server-side proxy when content cadence outgrew deploy cadence

## TL;DR

A few weeks after [bundling the bounded CDN](bundling-the-bounded-cdn.md) shipped, the second content stream (Steam) ran the bundled architecture into a constraint the first stream (LoL) had hidden: **deploy cadence is now driven by content events.** A new champion, a wishlist add, a price drop — each one needed a refresh PR and a redeploy. Patches every three weeks made that tolerable for LoL; wishlist adds every few days made it obviously wrong for Steam. The fix was to delete the bundle and put a thin NestJS proxy at `/img/*` that fetches upstream on demand, transcodes to WebP via Sharp, and returns with `Cache-Control: public, max-age=31536000, immutable`. Browser HTTP cache covers repeat views today; Nginx `proxy_cache` at the deployment layer will cover shared users at the hosting sweep. Three chunks: build the substrate, switch Steam + delete its bundled tree, switch LoL + delete its bundled tree (and absorb a deferred folder reorg in the same commit). The deletion was bigger than the addition — net **−11,553 lines** across the LoL switch chunk. This is the case study for *why* the pivot happened and what the second architecture buys.

## Setup — what changed since the bundled write-up

The [bundled approach](bundling-the-bounded-cdn.md) shipped on 2026-05-13 and solved its stated problem: a free runtime proxy was no longer in our render path, the cold-load waterfall hit zero external image requests on the LoL set, and the worst-case hung-probe time stayed bounded by the Phase 0 timeout. Phases 0–2 were the right shape for *that* problem.

Three things changed in the following two weeks that didn't fit the bundled shape:

1. **Steam shipped as a second content stream.** Steam capsule + library-hero + logo + achievement images entered the visual budget. They have their own CDN topology (`steamcdn-a.akamaihd.net/steam/apps/<appid>/<asset>.jpg` — content-hashed in the steamcommunity branch, legacy in the cdn branch).
2. **Steam content updates are user-driven, not patch-driven.** A wishlist add, a recently-played title, a new achievement unlock — every one of those is a content event that the bundle didn't know about until the next refresh PR ran. Riot ships a patch every three weeks; Steam ships *me* every few days.
3. **One specific incident: Steam S3 chunk 3 (2026-05-14).** The wishlist drill-in shipped with bundled capsules, three live wishlist titles came back blank because Steam's content-hashed URL scheme broke the unversioned-CDN assumption, and we spent a session adding a versioned-`appdetails` fallback to the script. The fallback chain worked. But the fact that there *was* a fallback chain, and that it lived in N URL helpers across the codebase, was the smell.

The bundled architecture didn't have a bug. It had a constraint that mattered for LoL and not for Steam: **the bundle assumes content changes are infrequent enough that "wait for the next refresh PR" is acceptable.** That assumption holds for biweekly patches; it doesn't hold for a wishlist.

## The trigger event, restated

The right way to recognize when an architecture outgrows its problem: pick a *single* concrete event that broke under it. For us it was Steam S3 chunk 3.

- **What the user did:** added three games to their Steam wishlist.
- **What we wanted to show:** the wishlist drill-in page, with capsules and library-heroes for each title.
- **What happened:** three blank cards. Bundled Steam manifest only knew about appids it had seen at the last refresh.
- **What we did in the moment:** added a versioned `appdetails` fallback to the refresh script (papers over the gap until the next nightly cron).
- **What we should have done:** noticed the fallback was the smell.

A papered-over smell is a deferral, not a fix. The bundle was about to grow a vendor-URL-knowledge surface in every URL helper for a *second* stream, with a different fallback chain than LoL's, with its own retry semantics, with its own manifest schema. That's two architectures of asset handling in the same monorepo, and the cost of keeping them aligned would only grow.

## The pivoted shape

Move both streams onto a server-side proxy. Same shape for both.

```
/img/lol/champion/:alias/:variant/:patch.webp     # variant ∈ {square, card, backdrop}
/img/lol/item/:itemId/:patch.webp
/img/lol/rune/:keystoneId/:patch.webp
/img/lol/spell/:spellKey/:patch.webp
/img/lol/role/:position.svg                       # static, no version

/img/steam/capsule/:appid/:assetTimestamp.webp
/img/steam/library-capsule/:appid/:assetTimestamp.webp
/img/steam/hero/:appid/:assetTimestamp.webp
/img/steam/logo/:appid/:assetTimestamp.webp
/img/steam/backdrop/:appid/:assetTimestamp.webp
/img/steam/achievement/:appid/:apiName/:schemaVersion.webp
/img/steam/achievement-gray/:appid/:apiName/:schemaVersion.webp
```

Five properties are load-bearing:

- **Fixed variants in path segments, not query params.** `?w=72` is CDN-poison: cache-key cardinality explodes, some CDNs strip query params from cache keys, the URL doesn't change when content does. Path segments keep the cache key bounded and stable.
- **Version segments bake the upstream version into the URL** (`:patch`, `:assetTimestamp`, `:schemaVersion`). Riot ships a new patch → the URL changes → the cache key rotates → no purge needed. Steam updates a capsule hash → the URL changes. The browser HTTP cache treats every URL as immutable forever; the URL itself is the freshness signal.
- **No cache code in the API.** Sharp transcodes on every request; caching belongs in the deployment layer (browser HTTP cache today, Nginx `proxy_cache` at hosting sweep). Keeps the proxy small and portable.
- **Server-side fallback chain.** When Steam's content-hashed URL 404s, the proxy walks an internal chain (hashed → versioned `appdetails` → header.jpg). Caller sees one URL and one outcome. The vendor-URL-knowledge that used to live in every URL helper collapses into one resolver per stream.
- **Boot-time prewarm walks the known universe.** `LolImageService` knows the current roster + patch from CDragon's summary endpoint; `SteamImageService` knows owned + wishlist appids from Postgres. Prewarm fetches all known URLs at boot so the first real user always hits a warm cache. The cold fetch cost moves off the user's critical path.

What this collapses, by deletion:

- LoL: refresh script (`scripts/refresh-lol-assets.mts`, 515 LOC), manifest infrastructure, CI workflow, `apps/web/public/lol/` (199 champions × 3 variants + items + runes + spells + role icons + champion-summary.json, ~9.7 MB), and the `splash-resolver` machinery (`splash-resolver.ts` 162 LOC + test).
- Steam: refresh script (`scripts/refresh-steam-assets.mts`), bundled Steam manifest, `apps/web/public/steam/` (apps + manifest).
- Cross-cutting: `.github/workflows/refresh-lol-assets.yml`, `manifest.gen.ts` mirrors in both `_shared/`, the root `sharp` + `tsx` + `blurhash` devDeps that only existed for the build-time scripts.

## Chunk plan and what each one bought

**Chunk 1 — proxy substrate.** `apps/api/src/img/` module: `img.controller.ts`, `lol-image.service.ts`, `steam-image.service.ts`, `upstream.ts`. All routes scaffolded. No frontend wiring. Verified by hand-curating URLs in a browser. Pure backend, independently committable. Shipped `d40b92b`.

**Chunk 2 — Steam switch + bundled cleanup.** Flipped every Steam URL helper to a proxy URL. Generalized the upstream resolver to take `urls: string[]` and a `fetchUpstreamChain` that tries each in order — first 2xx wins. Caller stops needing the two-source `<img onError>` state machine that lived on the backdrop component. Deleted the bundled Steam infrastructure in the same commit. `TranscodeParams` gained `height` + `fit` so the 231×87 capsule can cover-crop from `header.jpg` instead of returning a 600×900 portrait squashed into 231 pixels (this caught a latent bug from chunk 1 — see surprises).

**Chunk 3 — LoL switch + bundled cleanup + folded-in folder reorg.** Flipped every LoL URL helper. Deleted everything bundled. Folded in a deferred `_shared/assets/` bucket split from [folder-structure-cleanup.md](../working-notes/folder-structure-cleanup.md) Chunk 1, because the 13 deferred files were exactly the files this chunk was rewriting or deleting. Result: 10 surviving files moved into `_shared/assets/`, 5 deleted entirely. The split's pre-screen lesson (check both `@/lol/_shared/<X>` *and* relative `../_shared/<X>` import patterns) was carried forward — zero stragglers, single trailing biome-format commit absorbed the path-string wrap diffs. Net diff: +330 / −11,883 lines.

## What worked

**Server-side fallback chain, not client-side.** The brittleness the bundled fallback was trying to absorb (Steam content-hashed vs versioned `appdetails`, CDragon vs DDragon) had been spreading across URL helpers in two languages of vendor knowledge. Collapsing it into `fetchUpstreamChain(urls)` on the server gives one testable, observable, in-one-place location for "if upstream X fails, try Y." A client-side `<img onError>` chain was explicitly discussed and rejected: it would have re-introduced the brittleness the proxy is meant to absorb, and the only scenario where it'd help is "API up, image route specifically broken" — which is a bug to fix, not a fallback to paper.

**Browser cache as the cache layer, not the API.** Sharp re-transcodes per request, but every response has `Cache-Control: public, max-age=31536000, immutable` and the URL itself is the freshness key. Repeat views are free (304 from disk cache). The API stays stateless and small; the actual cache substrate is shifted into deployment config where it belongs (Nginx `proxy_cache` at the hosting sweep). The API never has to think about LRU policy, eviction, or persistence — it just transcodes.

**Path-segment cache keys.** `query-param`-based image proxies routinely get bitten by CDN cache-key collapsing or by long-tail variants polluting the namespace. Putting the version in the path (`:patch`, `:assetTimestamp`) makes the URL itself the cache key. Cardinality is bounded by known content (one variant × one version × N appids/champions); CDN-safe; `immutable` headers safe forever per URL because the URL changes when content does.

**Prewarm on `OnApplicationBootstrap`, env-gated per stream.** `STEAM_PREWARM=1` and `LOL_PREWARM=1` are independent. Off by default in dev (the loop runs but does real upstream work for no caching benefit until Nginx lands at hosting sweep). On in production once the cache layer exists. Letting the boot loop be independently gated meant chunk 2 could ship the Steam prewarm before chunk 3 was even started, without coupling.

**Deletion was the satisfying part.** The bundled approach's strongest property was that every artifact it produced was reviewable in a PR. Its weakest property — discovered in retrospect — was that *all* of those artifacts had to be regenerated on every content event. The pivot's strongest property is exactly the inverse: there is no build artifact for content, content lives in upstream CDNs, and the only thing committed is the resolver code that knows where to find it. Chunk 3 alone deleted 11,883 lines.

## What didn't — surprises from the build log

**1. Chunk 1's `capsule` route had a latent bug, caught only when chunk 2 forced disambiguation.** Chunk 1 wired `capsule` to return `libraryCapsulePath` (the 600×900 portrait) at width 231 with no crop, producing a 231×346 distortion rather than a 231×87 cover. The bug rode through chunk 1's manual browser verification because no surface was actually rendering at 231×87 yet. Chunk 2 added `library-capsule` as a separate route for the 600×900 case, and *that* forced the question of what `capsule` was *for*. The answer was: cover-crop the header.jpg to 231×87. `TranscodeParams` gained `height` + `fit:"cover"` and Sharp gained `withoutEnlargement: fit !== "cover"` to permit upscaling for cover fits. **Lesson:** routes that share a stem (`capsule`/`library-capsule`) but serve different aspect ratios should be specified together, not one at a time — the second forces the first to be honest about its purpose.

**2. `useChampions` was the silent dependency on the bundled tree.** Not in Chunk 3's original scope list. It fetched `/lol/champion-summary.json` from `apps/web/public/lol/` — populated by the refresh script as a side-effect, used by the hook as an unrelated dependency. Typecheck didn't catch it (the JSON is fetched, not imported). Vite would have served 404 at runtime once `public/lol/` was deleted. Caught only by trace-reading what `public/lol/` actually contained before `rm -rf`. Flipped to a live CDragon fetch — same content (~14 KB), React Query-cached `Infinity`, no behavior change. **Lesson:** before deleting a bundled output directory, grep the runtime for every path under it, not just the ones the refresh script declared as outputs. The directory was the de-facto API surface; the script's output declaration was incomplete.

**3. `splashObjectPosition` and the blur=0 escape hatch were removable, because there's only one source of truth now.** The bundled implementation had to deal with two image-framing conventions: Data Dragon's portrait crop (subject high in frame, needs `object-position: center 30%`) and CDragon's centered crop (`object-position: center`). The function existed to detect which one the URL pointed at. The proxy serves the CDragon centered crop exclusively, so the constant `"center 30%"` is fine and the function evaporates. Same story for `recap-champion.tsx`: it had been calling `championBackdropSplashUrl(name, 800, 0)` — width 800, blur 0 — because it needed an unblurred large splash in one specific place. The proxy backdrop is `blur=1` hard-coded; the recap surface switched to `championCardSplashUrl` (centered, no blur) which renders identically at 0.6 opacity behind a mask gradient. **Lesson:** every "escape hatch parameter" in a build-time API exists because the API is serving two callers with conflicting needs. Collapsing onto one server-side path means each caller specifies its surface intent, not its transform knobs.

**4. Asset-bucket import-pattern lessons from a prior folder reorg held up.** The split done as part of folder cleanup chunk 1 hit a sed-pass landmine: alias-only rewrites missed one relative-path import (`../_shared/<name>`) that typecheck only caught after the bucket commit landed. The lesson recorded then ("pre-screen *both* `@/lol/_shared/<name>` and `../_shared/<name>` before each bucket from now on") paid off on this chunk: zero stragglers across 10 file moves, single biome-format commit absorbed the trailing path-string wrap diffs. **Lesson:** the *literal* yield of writing a build-log surprise down is the next reorg costing one less commit. Worth the time every time.

**5. CDragon's `/perk/<id>/icon` and `/spell/<id>/icon` URLs don't exist — chunk 3's assumption was wrong, caught post-ship by curl.** The original Phase 4 plan baked a URL shape directly into [lol-image.service.ts](../../apps/api/src/img/lol-image.service.ts) (chunk 1) based on what the *bundled* refresh script used. The bundled refresh script worked because it had `perks.json` and `summoner-spells.json` in its prefetch loop and was rewriting `iconPath` fields client-side. The proxy didn't replicate that knowledge — it just asked CDragon for `/perk/8005/icon` and got a 404, which the proxy correctly translated to 502. Caught post-restart by `curl /img/lol/rune/8005` returning the wrong status. Fix: lazy in-memory id→iconPath maps populated from `perks.json` / `summoner-spells.json` on first miss, with pending-promise dedupe so concurrent first-misses don't double-fetch. `rune()` and `spell()` resolvers became async; the controller awaits. **Lesson:** when porting URL knowledge from a build-time script to a runtime resolver, treat the script's URLs as a hypothesis to verify against the live CDN, not as documented truth. A bundled refresh script can be wrong about CDN shape and still produce the right files (because it has additional knowledge embedded in its prefetch loop); a runtime resolver has to be right about CDN shape every time.

## Open questions and deferrals

**Nginx `proxy_cache`, stale-while-revalidate, and the LRU ceiling** are all deferred to the [pre-launch hosting sweep](../working-notes/hosting.md). The proxy ships fine without them; browser HTTP cache covers repeat views by the same user, and the working set is small (~200 MB across both streams at full coverage). `proxy_cache_use_stale error timeout updating` is the right shape — serve stale bytes when upstream is flaky, refresh in the background. The 2 GB ceiling is 10× headroom over working set, low monitoring burden. Adding these is pure deployment config, not a code change.

**CDN fronting (Cloudflare or similar).** Decide alongside the hosting commitment. If the topology supports it, an edge cache in front of the proxy moves the cache-hit boundary global. Today's leaning is single-host Hetzner with Nginx in front; whether to add a CDN layer depends on whether portfolio traffic ever shows up.

**Achievement icons use a static `:schemaVersion=1`** as the cache-buster segment. Achievement icons are essentially content-addressed by `apiName`, so a cache-buster is rarely needed. Keeping the segment leaves a knob to bump globally without redeploying the proxy — costs nothing to retain, would cost a route signature change to add later.

**`tools/champion-assets/` (theme/blurhash extraction) stays.** It's owner-rendered theming, not user-fetchable content, and it's not on the deploy-cadence smell path the pivot fixes. Build-time-derivable from splash bytes is still correct for that surface. Confirm at hosting sweep.

## Cost / benefit vs the bundled approach

| | Bundled (Phase 1–2) | Proxy (Phase 4) |
|---|---|---|
| LoL deploy cadence forced by content | every Riot patch (~3 weeks) | none — content lives upstream |
| Steam deploy cadence forced by content | every wishlist add (~days) | none — content lives upstream |
| Build artifacts committed to repo | ~9.7 MB LoL + Steam bundle + 244 KB manifest + slim mirror | zero |
| Fallback chain location | client-side, per-helper | server-side, one resolver per stream |
| CI workflows for content refresh | 1 (`refresh-lol-assets.yml`) + 1 planned for Steam | zero |
| First-load image latency (warm cache) | bundled paths from `public/lol/**` | proxy URL, ~0ms after first prewarm pass |
| First-load image latency (cold) | bundled-or-fallback through wsrv.nl | proxy fetches upstream, ~hundreds of ms |
| Worst-case render wait | Phase 0 timeout (~6s on fallback) | proxy 502 on upstream failure (no client retry) |
| Lines deleted, chunk 3 alone | — | 11,883 |
| Number of separate "asset handling architectures" in the codebase | 2 (LoL bundled, Steam bundled — diverging) | 1 (shared `/img/*` shape) |

Two trades worth naming directly:

- **Cold first-fetch is now on the API, not on the build.** Trade is real — the very first viewer of a new wishlist game pays a cold-fetch round-trip the bundle wouldn't have charged them. Mitigated by boot-time prewarm walking the known universe, so "the very first viewer" is in practice an internal one. At hosting sweep, Nginx `proxy_cache` makes "first viewer" mean *globally* first.
- **Failure semantics shifted from "bounded timeout, eventually shows fallback" to "502 with no body, browser shows broken image."** This is intentional. The bundled fallback chain hid upstream brittleness; the proxy surfaces it cleanly. A broken image in dev is a bug to investigate, not a state to design around.

## Why this is a portfolio-relevant story, not just an architecture story

The bundled write-up was the right shape for "here's the fix we shipped." This write-up is the shape for "here's why we replaced a fix that was working." Three things make the second story freelance-relevant in ways the first doesn't:

1. **Recognizing when an architecture outgrows its problem is harder than picking the right architecture once.** The bundle was technically correct for LoL throughout its lifetime. It became wrong for the *system* the moment a second stream entered with a different cadence. Naming the trigger event (Steam S3 chunk 3) makes the recognition reproducible, not vibes.
2. **The pivot was lossy on purpose.** Deleting working code is harder than writing it. The bundle had nine months of detail (manifest schema, hash-keyed diffing, additive-vs-rework labels, auto-merge guardrails, missing-aware fallback) — every line of it was earned. Choosing to walk away from earned detail because it's no longer load-bearing is a senior call, and showing it in writing is the senior signal.
3. **Same shape for both streams.** A common failure mode of solo-built portfolio projects is N-architectures-for-N-features. The proxy normalizes Steam and LoL onto one route family, one resolver pattern, one prewarm loop. The architectural payoff isn't the proxy itself — it's the *shared* proxy.

## Connections

- [bundling-the-bounded-cdn.md](./bundling-the-bounded-cdn.md) — the prior architecture this supersedes. Read for the original three-phase arc; the assumptions that earned it ("biweekly patches, bounded asset universe") are the same ones that aged out when Steam landed.
- [lol-image-pipeline.md](../working-notes/lol-image-pipeline.md) — working note, Phase 4 section + build log. Raw material for this write-up; chunk-level decisions and surprises live there in higher detail.
- [folder-structure-cleanup.md](../working-notes/folder-structure-cleanup.md) — the deferred asset-bucket split folded into chunk 3 of this arc. Shows up here because deletion-driven reorgs are cheaper than introduction-driven ones.
- [hosting.md](../working-notes/hosting.md) — where Nginx `proxy_cache`, CDN fronting, and the LRU ceiling decisions land at the pre-launch sweep.
- [frontend-perf.md](./frontend-perf.md) — broader frontend perf arc this fits into.
