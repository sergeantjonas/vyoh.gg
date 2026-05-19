# When the Web API can't help — dropping a layer to Steam's PICS for asset hashes

> Every Steam library tile renders a game capsule, a hero banner, and — for newer titles — a wordmark logo on top. The logo path is the only one of those that the Steam Web API does not expose. The Steam *desktop client* renders it just fine. That gap forced a one-time drop from HTTPS-and-JSON down to Steam's PICS protocol — TCP to a content-server, protobuf payload, anonymous logon — to recover a single string per appid.

## TL;DR

- **The Web API doesn't carry the logo hash.** Confirmed against every speculative `data_request` flag on `IStoreBrowseService/GetItems` plus every adjacent endpoint. The `StoreItem.Assets` proto block has no `logo` field; SteamDB and the desktop client get the hash from PICS.
- **PICS = Product Info Cache Service.** Steam's internal product-info protocol, accessed via the Steam network protocol (TCP to a CM, protobuf framing, not HTTPS+JSON). Anonymous logon is sufficient — no user session token required.
- **One added dependency, one service, one column.** `steam-user@5.x` for the protocol client; a thin `SteamPicsService` wrapping `logOn → getProductInfo → logOff` with timeouts; a `logoPath` column on `SteamGameEnrichment`. The rest of the enrichment pipeline is unchanged.
- **The response shape didn't match the docs.** First boot backfill landed 0/173 logo paths. The flat `library_assets.library_logo` field is a locale marker (`"en,ja,ko"`), not a hash — the actual hashes live nested under `library_assets_full.library_logo.image.<locale>`. One smoke test would have caught it earlier than a deploy + DB check did.
- **Failure is non-fatal.** PICS errors log and the enrichment row still lands with `logoPath: null`. The frontend keeps its title-text fallback for those rows. The Web-API-only enrichment path stays the contract; PICS is a strict augment.

## The setup

The Steam section's library page renders each owned game as a 2:3 portrait tile, with a hero banner + logo overlay on the per-game detail page. Hero, capsule, and header all come from `IStoreBrowseService/GetItems` with `data_request.include_assets: true` — a hashed CDN path per asset, content-addressed and stable.

The logo overlay should be the same shape — a `logo.png` rendered on top of the hero, positioned per metadata. The Steam desktop client does exactly this for every modern title (Resident Evil Requiem, Pragmata, Stellar Blade — anything post-2019). Our page didn't, for the same titles. The unhashed legacy path `…/apps/<appid>/logo.png` returned 404 for them.

The first hypothesis was "GetItems must carry the logo somewhere we missed." It didn't, and proving it took more digging than expected.

## What the Web API doesn't carry

Re-probed `IStoreBrowseService/GetItems` against appid `3764200` (RE Requiem) with every speculative `data_request` flag — `include_assets`, `include_release`, `include_platforms`, `include_all_purchase_options`, `include_screenshots`, `include_categories`, `include_tag_count`, and several undocumented ones from SteamDatabase's [Protobufs repo](https://github.com/SteamDatabase/Protobufs). The response asset block returned the same fixed 17-key shape every time:

```
assets {
  asset_url_format, main_capsule, small_capsule, header,
  package_header, page_background, hero_capsule, hero_capsule_2x,
  library_capsule, library_capsule_2x, library_hero, library_hero_2x,
  community_icon, clan_avatar, page_background_path, raw_page_background,
  // ... no `logo`, no `library_logo`, no `wordmark`.
}
```

Grep through every proto in `SteamDatabase/Protobufs` for `logo`: zero matches in `StoreItem.Assets` or any of its parents. Confirmed in `steammessages_storebrowse.steamclient.proto` directly — `library_logo` is genuinely not in the message.

Other public-API endpoints checked: `ICommunityService/GetApps`, `IStoreService/GetAppInfo`, `store.steampowered.com/api/appdetails`, `IClientUI/*`, `IClient/GetClientLibraryAssets`. Either no logo field, or auth-gated behind a user session token (not just the Web API key). SteamDB and SteamGridDB are JS SPAs with auth-gated internal APIs — not callable from a server.

The asset *exists* publicly: `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/3764200/c0cb6f0c5702fdb43a1ff89cee79ffbe4d990b47/logo.png` returns a 200 (69688-byte PNG). RE Requiem's hero has intentional left-side negative space designed for the wordmark overlay — Capcom *did* upload one. The missing piece is the per-app hash; everything else (URL template, file convention, CDN base) is already known.

## Where the hash actually lives

The Steam desktop client populates its `librarycache/<appid>/<hash>/logo.png` folder by querying **PICS — Product Info Cache Service** over the Steam network protocol. PICS is not HTTPS+JSON; it's the same protobuf-framed TCP protocol the Steam client uses for everything else (logon, achievements, friend list). The cm-server pool serves it, anonymous logon is sufficient, and the relevant payload field is `common.library_assets.logo` per the [proto definitions](https://github.com/SteamDatabase/Protobufs).

`steam-user@5.x` (a community-maintained Node.js client) wraps the whole thing — TCP connect, encrypted handshake, anonymous logon, `getProductInfo([appids])`, response parsing. Adding it as a dep was the smallest possible drop-down: same Node process, one TCP socket per call, lifecycle bounded by the enrichment refresh tick.

## The shape

```
   enrichmentService.enrichApps([appids])
        │
        ├─► fetchLogoMap(appids) ─────► SteamPicsService.getLogoAssets(appids)
        │                                    │
        │                                    │  new SteamUser()           ──TCP/CM──┐
        │                                    │  logOn({ anonymous: true })          │
        │                                    │  getProductInfo(appids)              │
        │                                    │  logOff()                            │
        │                                    │                                      │
        │                                    └─► [{ appid, logoPath, … }]   ◄───────┘
        │                                         (locale-keyed image.english)
        │
        ├─► getStoreItemsFull(appids)  ──HTTPS──► IStoreBrowseService/GetItems
        │                                         (everything else: hero, capsule,
        │                                          header, type, release, tags …)
        │
        └─► projectEnrichment(raw, logoPath)
                │
                ▼
            upsert SteamGameEnrichment
                { …, logoPath, enrichedAt }
```

Two upstream calls — PICS for the logo hash, GetItems for everything else — joined per-appid in JS, persisted to one Postgres row. Identical to the cross-stream-synthesis tile pattern: `Promise.all` the per-source queries, merge in memory, write once.

The PICS path is opt-in at the boundary: a failure logs and `fetchLogoMap` returns an empty map. The GetItems-derived enrichment still upserts with `logoPath: null` and the frontend renders the title-text fallback for those rows. **The Web-API-only path stays the contract**; PICS augments it, never gates it.

## The drop-down, end to end

[`pics.service.ts`](../../apps/api/src/steam/pics.service.ts) is 162 lines. The public method is one function:

```ts
async getLogoAssets(appids: number[]): Promise<SteamPicsLogoAsset[]> {
  if (appids.length === 0) return [];
  const client = this.createClient();
  try {
    await this.logOnAnonymous(client);
    const response = await withTimeout(
      client.getProductInfo(appids, [], false),
      PICS_PRODUCT_INFO_TIMEOUT_MS,
      "PICS getProductInfo"
    );
    return appids.map((appid) =>
      this.extractLogoAsset(appid, response.apps[String(appid)])
    );
  } finally {
    try { client.logOff(); }
    catch (err) { this.logger.warn(`Steam PICS logOff failed: ${describeError(err)}`); }
  }
}
```

Four discipline points worth keeping:

1. **Promise-wrap the event-based logon.** `steam-user` emits `'loggedOn'` and `'error'` as Node events. Wrap them in a single Promise that registers both listeners, settles on whichever fires first, and removes both listeners in `cleanup()` ([pics.service.ts:55-83](../../apps/api/src/steam/pics.service.ts#L55-L83)). Without the explicit cleanup, a slow logon followed by an error leaks listeners across calls.

2. **Two independent timeouts.** 20s for logon (TCP+handshake+auth), 30s for `getProductInfo` (varies with appid count). Bundling them into one timeout would obscure which step actually wedged. `withTimeout()` ([pics.service.ts:136-156](../../apps/api/src/steam/pics.service.ts#L136-L156)) rejects with a labelled error so logs read clean.

3. **`logOff()` in `finally`, swallowed errors.** A `logOff()` that throws is best-effort cleanup; rethrowing from `finally` would clobber the original error. Log and move on.

4. **`createClient()` is a protected method, not a DI factory.** Nest's DI tries to resolve constructor-injected factory types at module init, which trips on `steam-user`'s JS-only export. A `protected createClient()` overridden in `pics.service.spec.ts` is a 4-line test seam ([pics.service.spec.ts](../../apps/api/src/steam/pics.service.spec.ts)) that beats fighting DI metadata.

The downstream side ([`enrichment.service.ts`](../../apps/api/src/steam/enrichment.service.ts#L145-L159)) is the simpler half — call `getLogoAssets`, build a `Map<appid, logoPath>`, pass it through `projectEnrichment(raw, logoByAppid.get(raw.appid) ?? null)`. The merge is a single optional argument; the projection function has no idea PICS exists.

## What didn't (the response-shape surprise)

S5.5.A (network-protocol de-risk) and S5.5.B (schema + boot backfill) both shipped clean. S5.5.C's first deploy populated 0/173 rows. The logger said:

```
PICS resolved 0/173 logo hashes
```

The protobuf docs and the SteamDB blog posts had suggested the field is `common.library_assets.library_logo`. Live response, captured via `JSON.stringify(response.apps['3764200'].appinfo.common.library_assets, null, 2)`:

```json
{ "library_logo": "en,ja,ko" }
```

Not a hash. A comma-separated locale list. The actual hashed paths live one level deeper, in a *separate* sibling block — `library_assets_full`:

```json
"library_assets_full": {
  "library_logo": {
    "image": {
      "english": "c0cb6f0c5702fdb43a1ff89cee79ffbe4d990b47/logo.png",
      "japanese": "c0cb6f0c.../logo_japanese.png",
      "koreana":  "c0cb6f0c.../logo_koreana.png"
    },
    "image2x": { "english": "...logo_2x.png", ... },
    "logo_position": { "pinned_position", "width_pct", "height_pct" }
  }
}
```

So the flat field is a *marker* indicating which locales have a logo; the hash + filename live in the `_full` block as a locale-keyed map. The fix ([pics.service.ts:111-130](../../apps/api/src/steam/pics.service.ts#L111-L130)) prefers `image.english`, falls through to the first available locale, and defensively handles an older bare-string shape:

```ts
function extractLogoPath(appinfo: unknown): string | null {
  // … navigate common → library_assets_full → library_logo → image …
  if (typeof image.english === "string") return image.english;
  for (const value of Object.values(image)) {
    if (typeof value === "string") return value;
  }
  return null;
}
```

After the fix: 159/173 owned titles resolved a hash. The remaining 14 are older titles where PICS doesn't carry a `library_assets_full` block at all (rendered with the title-text fallback, same as if PICS had been offline).

The cost: one deploy + one DB check to discover. A smoke test against a single live appid before shipping S5.5.C would have caught it in seconds. Worth doing for the next PICS expansion — this protocol's documentation lags reality often enough that "log the first response, eyeball it, then ship" is cheap insurance.

## What's load-bearing about the design

### PICS failure is strictly additive

A PICS outage, a Steam CM rejecting anonymous logons, a slow tick that times out at 30s — none of those break enrichment. They drop `logoPath` to null for that refresh cycle, frontend renders title-text on those rows, next refresh tries again. The S5.5.B boot backfill predicate widens to `OR: [{ enrichment: null }, { enrichment: { is: { logoPath: null } } }]` so previously-failed rows self-heal on the next deploy without manual intervention.

### One PICS logon per `enrichApps` call

`getProductInfo` accepts an array, so all appids in a single `enrichApps` invocation share one logon → request → logoff cycle. Per-app PICS calls would have meant 173 TCP connects on a full boot backfill; one connect handles them all. The cost is bounded by `PICS_PRODUCT_INFO_TIMEOUT_MS`; on a normal run the whole call returns in under a second.

### No new rate limiter

The Web API side uses Bottleneck reservoirs ([Riot rate-limits case study](./riot-rate-limits.md)) because GET `/IStoreBrowseService/GetItems` shares budget with every other Steam Web API call. PICS does not — it's a separate protocol against a different infrastructure pool, used cooperatively (Steam's own client uses the same endpoints, with the same anonymous-logon shape, at orders of magnitude higher volume than we do). One call per enrichment cycle (monthly cron + on-add for new games) doesn't need rate-limiter bookkeeping.

### Hosting implication: outbound TCP

This is the project's first outbound dependency that *isn't* HTTPS-to-port-443. Captured in [`hosting.md`](../working-notes/ops/hosting.md#steam-network-protocol-outbound-tcp): the production firewall must not lock egress to 80/443, and managed-PaaS hosts that ship a default-deny outbound policy on non-HTTPS ports would silently break the enrichment path. Cheap to know in advance, expensive to discover post-deploy.

## Why the underlying choice generalises

PICS-for-logos is a specific instance of a general pattern: **when the public API doesn't carry a field that the vendor's own client clearly has, the field exists at some other layer of the vendor's stack — drop a layer.** Steam happens to publish its internal protocol (via protobufs), maintain a community client (`steam-user`), and accept anonymous logons. Most vendors that "have an API gap" also have an undocumented-but-accessible layer underneath; the cost is the protocol switch + the maintenance of the lower-level dep.

The framing question is "what's the smallest layer I can drop to, and how do I keep the contract HTTPS-only for the rest of the system?" Two answers fall out:

- **Smallest layer:** in this case, one TCP protocol switch + one community-maintained client. The Web API path stays intact; PICS is wrapped in one service that is strictly additive.
- **Keep the contract HTTPS-only:** the enrichment pipeline's *callers* never know PICS exists. The DTO carries `logoPath: string | null`; null is a normal value. The only code path that touches `steam-user` is `pics.service.ts`. Replacing it in the future (Valve adds the field to GetItems, or someone writes a more battle-tested wrapper) is one file's worth of churn.

## Open questions

**PICS proto evolution.** The `library_assets_full` shape changed at least once between SteamDB's docs and the live response. There's no published changelog. A planned `image` field becoming an `image_v2` field on a future PICS revision would silently break extraction; the defensive fallback (any-locale string) limits the blast radius but doesn't eliminate it. A live-response smoke test in the spec suite would catch this — currently the spec mocks the response shape rather than asserting against a real one.

**Refresh cadence.** PICS exposes `changenumber` per app — an opaque integer that increments whenever metadata changes. We persist it but don't use it for selective refresh; the monthly enrichment cron just re-hits every owned appid. Cheaper would be: read changenumber + compare-against-stored, only re-fetch on bumps. Premature optimization at 173 appids; revisit at 10× or if PICS rate-limits.

**Multi-source assets.** Hero + capsule + header come from GetItems. Logo comes from PICS. If a future asset arrives via a third source (e.g. logo position metadata that the wiki carries but neither GetItems nor PICS does), the merge pattern (`projectEnrichment(raw, logoPath)`) grows another optional argument. At three sources the optional-args pattern is uncomfortable; at four it should refactor to a named struct. Not a problem today.

## Why this earns its place in the portfolio

- **Drop-a-layer is a transferable instinct.** Most freelance integration work runs into "the public API doesn't carry X." Knowing how to identify the right next layer (and how to keep that drop-down strictly additive to the rest of the system) is the load-bearing skill.
- **The protocol switch is wrapped in one service.** 162 lines. Two timeouts. One test seam. A failure path that doesn't touch the rest of the pipeline. No "PICS-aware" code anywhere outside the service file.
- **A real surprise, fixed quickly.** The 0/173 boot backfill was a real bug, with a real diagnostic (log line + JSON dump of one live response), with a real fix (`image.english` instead of `image`). The post-mortem fits in two paragraphs; the lesson ("smoke-test the response shape before shipping the migration") fits in one sentence.
- **The hosting implication is captured upstream.** First outbound non-HTTPS dep on the project; documented in `hosting.md` so the deploy plan never has to discover the firewall rule the hard way.

## Connections

- [Steam presence as signal](./steam-presence-as-signal.md) — the other Steam-internals case study. Both lean on `GetPlayerSummaries` + `getProductInfo` as the cheap-but-load-bearing endpoints; both keep the integration's failure path strictly additive.
- [Patch-notes pipeline](./patch-notes-pipeline.md) — the LoL parallel for "the vendor doesn't carry what we need, find a structured source that does." There it's the wiki's wikitext; here it's PICS over the Steam network protocol.
- [Bundling the bounded CDN](./bundling-the-bounded-cdn.md) — the asset-side companion. Once PICS hands over the hash, the resulting URL is a hashed-CDN path that survives publisher refreshes — same "stable URL is a design choice" thread that the bundled-CDN piece runs on.
- [Cross-stream synthesis](./cross-stream-synthesis.md) — same merge pattern (`Promise.all` two upstream sources, join in memory, persist once), applied to a different problem shape.
