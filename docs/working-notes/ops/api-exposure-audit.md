# API exposure audit — what an anonymous caller can do

**Status:** Active — audit complete 2026-08-03, remediation underway the same day.

Opened after the owner asked what protects the backend from unauthorized access; a ten-lane sweep followed, producing 22 findings all code-verified against `main`. One reported finding was refuted by probe and is recorded as such rather than dropped.

**17 of 22 are now fixed** (F-1 through F-5, F-7 partly, F-8, F-9, F-10, F-13 through F-20, plus half of F-21), **each verified against the running api or a real nginx rather than the test suite alone**. Remaining: `alias`/`patch` reaching their upstreams the way `tier` did, F-11's response-size caps and sharp limits, F-12's pool sizing plus `statement_timeout`, and the two deferrals recorded in F-2 and F-21.

Remediation is a launch gate, mirrored in [pre-launch-sweep.md](pre-launch-sweep.md). Nothing here was ever reachable in the wild — the api is not public — but every item becomes live the moment `api.vyoh.gg` resolves, and F-5 was leaking into local logs before it was fixed.

[owner-auth.md](owner-auth.md) covers the *identity* question (who may call the mutating routes). This note covers the rest of the exposure surface: what an anonymous caller can make the api **do** — upstream quota, database growth, CPU, memory — regardless of whether they can log in. The two are complementary, and owner-auth alone does not close what is listed here.

## Threat model

The api ships as a separate vhost at `api.vyoh.gg` with no authentication of any kind: no guards, no API keys, no sessions, and no inbound rate limiting at either the NestJS or the nginx layer. Assume an anonymous attacker with `curl` and a shell loop. The whole stack — api, web, Postgres, nginx — shares one small VPS, so exhausting any one resource degrades all of it.

The assets worth protecting, in order: the **Riot API key** (leaked or rate-limited keys get the app cut off, and Riot DevRel has already been in contact about display rules), the **Postgres volume** (LP history and Steam playtime snapshots are irreplaceable — see [pre-launch-sweep.md](pre-launch-sweep.md)), and **uptime**.

## What actually protects the api today

Worth stating plainly, because it is more than nothing and it shapes which findings matter:

- **Deploy topology.** [compose.prod.yaml](../../../compose.prod.yaml) binds api (2010), web (2009) and Postgres (5432) to `127.0.0.1`; only nginx holds 80/443. Postgres is not reachable from the internet.
- **An owner allowlist on the LoL account routes.** `IdentityService.isLolAccountAllowed()` ([identity.service.ts:170](../../../apps/api/src/identity/identity.service.ts#L170)) is checked at **27 call sites** across `lol.service.ts`, `lol-analytics.service.ts` and `lol-champion-analytics.service.ts`, each throwing `ForbiddenException` before any upstream call. This is the single most valuable control in the api, and it is genuinely broadly applied. F-1 below is about the three places that miss it.
- **Strict global validation.** `ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true })` in [main.ts](../../../apps/api/src/main.ts), with real class-validator DTOs on the account params (region against a 22-value whitelist, unicode-bounded gameName, alphanumeric tagLine).
- **A CORS allowlist** from `WEB_ORIGIN`, required at bootstrap in production. Note the limit: **CORS constrains browsers, not `curl`.** It is not access control and must never be counted as such.
- **Secrets hygiene.** Upstream keys are never echoed in responses; secret scanning + push protection are on ([security.md](security.md)).

## Confirmed findings

Severity is "once public", not today.

### F-1 — Three LoL routes bypass the owner allowlist and fetch arbitrary Riot accounts · HIGH · **fixed 2026-08-03**

`LolService.resolveSummoner()` ([lol.service.ts:746](../../../apps/api/src/lol/lol.service.ts#L746)) resolves *any* `gameName#tagLine` through Riot Account-V1 on a cache miss and **upserts a `Summoner` row**. It has 8 callers. Five sit behind an `isLolAccountAllowed()` check; three do not:

| Route | Handler | Reaches `resolveSummoner` via |
|---|---|---|
| `GET …/baselines/:championAlias/:role` | [lol.controller.ts:294](../../../apps/api/src/lol/lol.controller.ts#L294) | [match-baseline.service.ts:34](../../../apps/api/src/lol/match-baseline.service.ts#L34) |
| `POST …/narrative` | [lol.controller.ts:301](../../../apps/api/src/lol/lol.controller.ts#L301) | [match-narrative.service.ts:63](../../../apps/api/src/lol/match-narrative.service.ts#L63) |
| `GET …/narrative/lifetime` | [lol.controller.ts:310](../../../apps/api/src/lol/lol.controller.ts#L310) | [match-narrative.service.ts:134](../../../apps/api/src/lol/match-narrative.service.ts#L134) |

Neither service imports `IdentityService` at all. An attacker walks a list of real summoner names against one of these three routes and the api dutifully resolves each against Riot and writes a row per account — burning the dev-tier key's budget and growing the table without bound.

**This is the exact failure mode [repo-conventions.md § "Centralise domain invariants"](../../repo-conventions.md) already describes for `excludeRemakes`:** an invariant that must hold for every route, enforced by 27 hand-written call sites, silently omitted when two newer services were added. The durable fix is structural, not another inlined check.

**Fixed** by moving the check **inside `resolveSummoner` itself** rather than adding a route guard, which the original note proposed. The choke point turned out to be the better boundary for three reasons: it is the only path to Account-V1 *and* the only writer of a `Summoner` row, so nothing can reach either without passing it; it fixes both offending services without touching their constructors, neither of which injects `IdentityService`; and the cron path is unaffected because `syncAccountMatches` passes accounts read from the same `accounts.json` the allowlist is built from. A route guard would have covered the three known routes while leaving the next direct caller exposed.

The existing 27 call-site checks stay. They are not redundant — several gate analytics that read the database by puuid without resolving anything, so removing them would open a different hole. The duplicate check on the paths that do both is an in-memory string compare.

**Lint added**, and this is the part that outlasts the fix: `conventions.spec.ts` now asserts `resolveSummoner`'s own body contains `isLolAccountAllowed`, scoped via a `methodBody` helper so the guard living in a *neighbouring* method cannot satisfy it — that being the exact shape of the original defect, a lint accepting it would pass against the bug it exists to catch. Verified by deleting the guard and confirming the lint goes red, then restoring; a structural lint that has never been seen to fail is not evidence of anything.

Four tests cover the choke point, including the one that matters most: a rejected account triggers **no Riot call and no row write**, not merely an exception.

Confirmed live on all three routes, with the owner's own account unaffected:

```
GET  …/euw1/Stranger/EUW1/baselines/Ahri/MIDDLE  → 403
GET  …/euw1/Stranger/EUW1/narrative/lifetime     → 403
POST …/euw1/Stranger/EUW1/narrative              → 403
GET  …/euw1/Vyoh/Ahri/narrative/lifetime         → 200
GET  …/euw1/Vyoh/Ahri/baselines/Ahri/MIDDLE      → 200
```

### F-2 — The match endpoints are an open, unauthenticated Riot proxy · HIGH · **fixed 2026-08-03**

`GET /lol/matches/:matchId` and `GET /lol/matches/:matchId/timeline` ([match.controller.ts:10,15](../../../apps/api/src/lol/match.controller.ts#L10)) carry no allowlist check of any kind. On a cache miss, [lol.service.ts:704-744](../../../apps/api/src/lol/lol.service.ts#L704-L744) derives the region from the matchId string, fetches from Riot, and **permanently inserts a `matchDetailCache` / `matchTimelineCache` row**.

Match IDs are structured and enumerable (`EUW1_<counter>`), so the cache never helps: every request is a miss, a live Riot call, and a new row. One loop is simultaneously a Riot-quota attack, an unbounded disk-growth attack, and a way to use `api.vyoh.gg` as a free public Riot API — which is squarely a Riot ToS problem given the DevRel contact already on record.

**Fix:** clamp the miss path to owner data. Serve any cached row (cheap, harmless, keeps the public read story), but only fetch upstream for a matchId that appears in a tracked account's history. An unknown ID gets 404, not a Riot call.

**Fixed** by gating the *miss* path on `Match.matchId` existing — a row that is written only for matches a tracked account actually played, which makes it the right thing to gate on. A cached row still serves to anyone, because it is the same data the site renders and costs nothing upstream; an uncached unknown id now 404s instead of reaching Riot.

Checking the internal callers first is what made this safe rather than a guess: the sync path never comes through here — it calls `riot.getMatchTimelineById` directly — so a genuinely new match is still fetched and stored by the match-list flow before anyone can open its detail page. Only the two public routes and the OG match card reach these methods.

Confirmed live after a dev-server restart: `GET /lol/matches/ZZ1_123` answers **404**, where before the clamp it was a 500.

**There is also no retention policy of any kind**, which is what makes the disk side of this permanent rather than merely large. A sweep for cleanup/prune/evict/TTL logic across all 13 `matchDetailCache`/`matchTimelineCache` call sites found zero deletes, no cron sweep and no row cap; both `matchId` columns are uncapped `text` and both payload columns are unbounded `Json`. Every row an attacker causes is kept forever. An eviction job is worth having regardless of the clamp, and it is already anticipated — the match-cache tiering work in [match-cache-storage.md](../lol/match-cache-storage.md) is the natural home, with the caveat from [pre-launch-sweep.md](pre-launch-sweep.md) that destructive cache transforms gate on verified backups.

### F-3 — `/og` renders a PNG per request with no cache in front of it · MEDIUM · **fixed 2026-08-03**

Every `/og` route ([og.controller.ts](../../../apps/api/src/og/og.controller.ts)) runs a Satori SVG→PNG render per request. The handlers set `s-maxage=2592000` ([og.controller.ts:16](../../../apps/api/src/og/og.controller.ts#L16)) — but that header is addressed to a shared cache that does not exist. nginx has a `proxy_cache` block for `/img/` only ([api.vyoh.gg.conf:60-76](../../../deploy/nginx/api.vyoh.gg.conf#L60-L76)); `/og/` falls through to the catch-all `location /` with `proxy_buffering off`. The cache-control header is therefore load-bearing for nobody, and reads as protection while providing none.

`/og/match/:slug/:matchId.png` additionally inherits F-2: the slug is correctly clamped to a tracked account via `findBySlug` (404 otherwise), but the matchId flows into the same unguarded live-fetch path.

**Fixed** with a `location /og/` block sharing the `vyoh_img` zone — both are immutable-per-URL bytes, and one zone is easier to reason about than two. `proxy_cache_lock` keeps a cold key from admitting a stampede of identical renders when a link is first shared. Validity is **1 day rather than `/img/`'s 30**, because a card embeds profile state that legitimately moves (rank, recent form) where an image-proxy URL resolves to bytes that never change. Verified through nginx against the real config: `MISS`, then `HIT`, `HIT`.

### F-4 — No inbound rate limiting at any layer · HIGH (as an amplifier) · **fixed 2026-08-03**

No `@nestjs/throttler` in the api, and no `limit_req` / `limit_conn` in either vhost ([api.vyoh.gg.conf](../../../deploy/nginx/api.vyoh.gg.conf)). The Bottleneck limiter in `riot/` and the Steam rate limiter are **outbound** quota managers for upstream calls — they shape our traffic to Riot, they do nothing about traffic arriving at us, and they must not be counted as inbound protection.

On its own this is a modest finding for a low-traffic personal site. It matters because it is the multiplier on every other finding here: each of F-1, F-2 and F-3 is "one cheap request causes expensive work", and rate limiting is what bounds the number of those requests. [security.md](security.md) currently lists rate limiting under "explicitly out of scope … not justified at portfolio-site scale" — **that line was written before this exposure surface was mapped and should be revised**, not silently contradicted.

Note also `proxy_read_timeout 1h` with `proxy_buffering off` applied to the *whole* api vhost (necessary for the SSE routes) — that is a generous connection-holding budget for every route, not just the streams.

**Fixed.** `limit_req_zone`/`limit_conn_zone` now live in [vyoh-cache.conf](../../../deploy/nginx/vyoh-cache.conf) (http context, same reason `proxy_cache_path` does), applied per-location in [api.vyoh.gg.conf](../../../deploy/nginx/api.vyoh.gg.conf): 10 r/s with `burst=30 nodelay` plus `limit_conn 20` on `location /`, and 20 r/s with `burst=100` plus `limit_conn 40` on `/img/`, which one image-heavy document legitimately needs. `limit_conn` — not `limit_req` — is what answers the hour-long read timeout, since it caps how many such connections one address may hold. Status is 429 rather than nginx's 503 default, because it is the client's rate and a crawler backs off correctly on 429.

Verified behaviourally against the real config, not just parsed: nginx 1.27 running the actual files with `--network host` in front of the dev api.

```
25 rapid requests (a page-load fan-out) →  25× 200      ← not throttled
150 rapid requests (a script)           →  10× 200, 140× 429
```

That is the property that matters in both directions: a genuine visitor's burst passes untouched, a loop does not.

### F-5 — The Steam API key is written to our own logs in cleartext on any fetch error · MEDIUM · **fixed 2026-08-03**

`SteamClientService.fetchJson` builds every request path with the key as a query parameter, because that is Valve's Web API contract and there is no header alternative: `?key=${encodeURIComponent(this.apiKey)}` ([steam-client.service.ts:56](../../../apps/api/src/steam/steam-client.service.ts#L56), and 11 further call sites).

The success-path log strips it correctly — `path.split("?")[0]` at [steam-client.service.ts:330](../../../apps/api/src/steam/steam-client.service.ts#L330). **The error path directly above it does not:** [steam-client.service.ts:316](../../../apps/api/src/steam/steam-client.service.ts#L316) logs the whole `path`, key included, on any timeout, DNS failure, abort, or connection reset. The same unredacted `path` is then stored as a public field on every `SteamClientError` thrown at [:321](../../../apps/api/src/steam/steam-client.service.ts#L321) and [:336](../../../apps/api/src/steam/steam-client.service.ts#L336).

Unlike everything else in this note, **this one is not gated on going public** — it writes the key to the log stream of whatever machine runs the api, right now, whenever Steam is briefly unreachable. It also arms a future landmine: once that error object reaches any `logger.error(err)`, `JSON.stringify(err)`, or an error-reporting integration, the key goes with it. Client-facing exposure is ruled out — Nest's default handler emits a fixed 500 body for non-`HttpException` errors — so the exposure is to logs, not to callers.

Riot is unaffected and shows the right pattern: its key travels in the `X-Riot-Token` header ([riot.service.ts:209](../../../apps/api/src/riot/riot.service.ts#L209)), so the identical "log the path on error" code there leaks nothing.

**Fixed.** `fetchJson` now derives `path` as the always-redacted form (the absolute-URL branch already did this; the relative branch, which is the one carrying the key, did not), so the error log, the success log and both `SteamClientError` constructions inherit it. `url` remains the only unredacted value and is used solely for the `fetch()` call. Five tests in `steam-client.service.spec.ts` pin it, including one asserting the request still *sends* the key — the failure mode of an over-eager redaction would be a silently unauthenticated Steam client.

### F-6 — Two defects in the owner-auth plan, free to fix before it is written · MEDIUM (design)

Reviewed [owner-auth.md](owner-auth.md) as a design rather than waiting to review the implementation. The plan is strong — OAuth `state` is HMAC-signed, cookie flags are explicit (`SameSite=Lax; HttpOnly; Secure`), the `?next=` open-redirect is whitelisted, and the CSRF deferral is reasoned rather than overlooked. Two gaps:

- **Session tokens are planned to be stored raw.** The `Session` model uses the cookie value itself as the primary key ([owner-auth.md:42-50](owner-auth.md)), so the table holds directly usable tokens. Anything that can read it — a backup, a stray Prisma Studio session, a query log — yields working sessions rather than just evidence that sessions existed. Persist a SHA-256 of the token and look up by hashing the incoming cookie. The table does not exist yet, so this costs nothing now and a migration later.
- **"Opaque random" does not pin a generation mechanism.** Name the call explicitly in the note before chunk 1 (`crypto.randomBytes(32).toString("base64url")` or equivalent CSPRNG), so the implementation session cannot reach for `Math.random()` or a UUID.

Also worth closing rather than carrying: the sliding-vs-absolute expiry question left open at [owner-auth.md:199](owner-auth.md) currently defaults to sliding-only, meaning a session used monthly never expires. Recommend sliding 30-day with a hard 90-day ceiling checked in `OwnerGuard`.

## Corrections to earlier readings

Recorded so the wrong version does not get re-derived from conversation history:

- **"The api will fetch any stranger's account across all 22 summoner routes" — wrong.** The allowlist is enforced at 27 call sites and returns `ForbiddenException`. The real defect is narrow and specific: the three routes in F-1. Overstating this once already produced a scarier answer than the code deserved; the allowlist is good work and the finding is that two newer services were added without it.
- **"The image proxy is safe, hardcoded upstream URLs" — asserted from a summary, not verified route by route.** Being re-checked under the systematic sweep below; treat as unverified until that lands.

## Systematic sweep

A ten-lane sweep was run on 2026-08-03 to find what the ad-hoc pass missed, on the assumption that findings clustered where nobody had looked. Lanes: upstream fan-out, unauthenticated DB writes, image-proxy SSRF, compute/memory DoS, input-validation coverage, information disclosure, Prisma/injection, SSE and in-memory state, nginx/container hardening, secrets/CORS/config.

Findings are recorded here only after being re-verified against the source in the main session; a lane's say-so is not enough. Where a claim was checkable empirically it was, and the probe is quoted.

### F-7 — Path traversal through the image proxy's unvalidated `tier` param · HIGH, empirically confirmed

`GET /img/lol/rank/:tier/:year.webp` ([img.controller.ts:271-286](../../../apps/api/src/img/img.controller.ts#L271-L286)) validates `year` (must parse as finite) and **does not validate `tier` at all**. Sibling routes do it right — `role`, `champClass` and `uiIcon` each check a closed `Set` before use — so this one route is the outlier. The raw string flows into two template-string URLs at [wiki-url-helpers.ts:123-126](../../../apps/api/src/img/wiki-url-helpers.ts#L123-L126) and [lol-image.service.ts:356-365](../../../apps/api/src/img/lol-image.service.ts#L356-L365).

Verified as a chain rather than argued, because the interesting part is whether the framework strips the attack before it lands:

```
$ node -e "…express@5.2.1, the version in this repo…"
200 /img/lol/rank/gold/2023.webp                     -> {"tier":"gold"}
200 /img/lol/rank/..%2f..%2f..%2fsome-path/2023.webp -> {"tier":"../../../some-path"}
200 /img/lol/rank/%2e%2e%2f%2e%2e%2fevil/2023.webp   -> {"tier":"../../evil"}
```

Express matches the route against the **raw** path (so `%2f` stays inside one segment and the route still matches), then decodes the captured param — handing the controller a string containing real `../` sequences. The URL parser then does what it is specified to do:

```
interpolated : https://wiki.leagueoflegends.com/en-us/images/Season_2023_-_../../../../some-path.png
fetch resolves: https://wiki.leagueoflegends.com/some-path.png
```

Confirmed against the running api, not just by construction — the traversal reached the fetch layer rather than being rejected at the boundary:

```
$ curl -o /dev/null -w 'HTTP %{http_code}\n' "localhost:2010/img/lol/rank/..%2f..%2f..%2fsome-path/2023.webp"
HTTP 502     ← before the fix
HTTP 400     ← after, verified post-restart
```

502 is `UpstreamError` — the handler accepted the input, built the traversed URL, and actually attempted the upstream fetch (which 404s, since `/some-path.png` does not exist). The 400 is the closed set refusing it before any URL is built, with `EMERALD`, `UNRANKED`, `CHALLENGER` and `IRON` all still serving their real bytes.

So an anonymous caller chooses the **path** fetched from four trusted upstreams (`wiki.leagueoflegends.com`, `cdn.communitydragon.org`, `raw.communitydragon.org`, `ddragon.leagueoflegends.com`). The host is a literal prefix, so this is not internal-network SSRF on its own — it is arbitrary-path selection against third parties, from our IP, uncached and unrated. The same shape reaches CDragon via `champion`'s `alias` (whenever the alias matches no champion, the CDragon URL becomes the only candidate) and DDragon via `item`/`profileIcon`'s `patch`.

**This retracts the "hardcoded upstream URLs, no SSRF possible" claim** that an earlier summary asserted and this note already flagged as unverified. Most routes genuinely are safe — `wiki-file`/`wiki-splash` (charset regex excluding `/`), `rune`/`spell`/`map` (numeric), `ability` and `steam/achievement` (Prisma-gated), the `steam/*` capsule family (numeric appid, literal filenames) — which is why the generalisation held up until someone checked route by route.

**Partly fixed 2026-08-03.** `tier` now validates against `RANK_TIER_SLUGS` in `lol-image.service.ts` — the same closed-set shape its siblings use — and `LolImageService.rankEmblem` takes `RankTierSlug` rather than `string`, so the type system carries the guarantee instead of the controller remembering. Two things the fix had to get right, neither of which is obvious from the vulnerability:

- The web forwards Riot's `rank.tier` verbatim, so the segment arrives **uppercase**; the set is matched case-insensitively via `toUpperCase()`.
- **`UNRANKED` is a live value.** It is not a Riot tier, but both upstreams serve an emblem for it and the profile hero requests it, so a set built from the ten real tiers would have 400'd a working surface. Confirmed by probing every tier against the running api before writing the set.

`alias` and `patch` still reach CDragon and DDragon the same way and are **not yet fixed** — they need the same treatment, and they are less mechanical because both are open-ended by design (a champion alias is not a closed set the api owns, and `patch` is a version string).

### F-8 — Outbound fetches follow redirects to anywhere · HIGH

[upstream.ts:24](../../../apps/api/src/img/upstream.ts#L24) is `fetch(url, { signal: ac.signal })` — no `redirect` option, so undici's default `follow` applies for up to 20 hops, to any host, scheme or port. Nothing validates where it lands.

Alone this is latent. Chained with F-7 it is the escalation path: an attacker who can select an arbitrary path on a trusted host only needs one open redirect anywhere in that host's path space to turn confined path-selection into **full SSRF** against `127.0.0.1:2010`, `127.0.0.1:5432`, or a cloud metadata endpoint. The guard that would have capped F-7's blast radius is the one that is missing.

**Fixed 2026-08-03.** Both `fetchUpstream` and `streamUpstream` now pass `redirect: "manual"` and refuse any 3xx through a shared `isRedirect` helper, raising `UpstreamError`. Every upstream here is a known host serving a known path, so a redirect is never part of a healthy response and refusing outright costs nothing. Tests cover all five redirect statuses on both helpers, plus an assertion that `redirect: "manual"` is actually passed — the failure mode of a silent regression is that the option is dropped and everything still passes.

If following is ever genuinely needed, resolve `Location` explicitly and check it against a host allowlist and a non-private-address rule before re-fetching.

### F-9 — The nginx cache key includes inputs the app ignores, so the cache is free to bust · HIGH

Found independently by two lanes, which is why it is stated with confidence. `api.vyoh.gg.conf` sets no `proxy_cache_key`, so nginx uses the default `$scheme$proxy_host$request_uri` — the full raw URI, query string included. Two consequences:

- **No `/img/` route reads `@Query()` at all** (checked across all of them), so `…/Ahri/default/25.1.webp?x=1`, `?x=2`, `?x=3` are byte-identical responses occupying three separate cache entries.
- Several route segments are captured but never bound as controller params — `:patch` on `champion`, `:assetTimestamp` / `:schemaVersion` on the `steam/*` family. The resolver ignores them; they exist only as cache keys. Varying one is a guaranteed miss.

Either way an attacker forces unlimited full upstream-fetch-plus-sharp-transcode work for content already cached, while evicting genuinely hot entries from the 2 GB store. `proxy_cache_lock` does not help — it collapses concurrent requests for the *same* key, and every request here has a fresh one.

Compounding it, only `200` and `404` are cached ([api.vyoh.gg.conf:68-69](../../../deploy/nginx/api.vyoh.gg.conf#L68-L69)); the `502` returned when an upstream chain fails is never cached, so requests engineered to fail cost full backend work every single time.

**Fixed (the query-string half).** `proxy_cache_key "$scheme$proxy_host$uri"` now drops the query string and nothing else. Proven by A/B against the real config on identical fresh assets:

```
without proxy_cache_key   MISS  MISS  MISS   ← every query string its own entry
with proxy_cache_key      MISS  HIT   HIT
```

A first attempt at that A/B produced a false negative worth recording: both nginx containers ran with `--network host` on the same port, so the second never bound and the "before" requests were silently answered by the still-running "after" container. Port-conflict-as-silent-fallback is easy to miss when the response looks plausible — check the container actually holds the port.

**The ignored path segments are deliberately left in the key.** `:patch`, `:assetTimestamp` and `:schemaVersion` exist so a redeploy can invalidate a browser's copy; folding them out of the cache key would break that invalidation to close a hole the rate limit already covers. A lane recommended stripping them — that would have traded a working feature for redundant protection.

### F-10 — `location /img/` silently loses its security header · MEDIUM

nginx inherits `add_header` from the parent level **only if the current level declares none**. `api.vyoh.gg.conf` sets `X-Content-Type-Options: nosniff` at server level ([:29](../../../deploy/nginx/api.vyoh.gg.conf#L29)) and then declares `X-Cache-Status` inside `location /img/` ([:75](../../../deploy/nginx/api.vyoh.gg.conf#L75)) — which replaces the inherited set entirely. So the one location that serves untrusted third-party bytes through a transcoder is the one location serving them without `nosniff`, while `location /` (declaring no header of its own) correctly inherits it.

Reading the file suggests the opposite; the server-level line looks global.

**Fixed 2026-08-03** by re-stating `nosniff` inside `location /img/`, with a comment at *both* ends explaining the inheritance rule — the server-level one warns that any header added there needs the same treatment in `/img/`, which is the part a future reader would otherwise miss. Confirmed served:

```
$ curl -D - .../img/lol/rank/SILVER/2023.webp
X-Content-Type-Options: nosniff
```

`server_tokens off` landed in the same pass.

### F-11 — No response-size cap and no sharp resource limits · MEDIUM

[upstream.ts:26](../../../apps/api/src/img/upstream.ts#L26) buffers whole responses with `Buffer.from(await res.arrayBuffer())` — no `Content-Length` pre-check, no ceiling. The 5 s timeout bounds wall-clock, not bytes. Nothing sets `sharp.limitInputPixels()`, `sharp.concurrency()` or `sharp.cache()` at bootstrap, so sharp's ~268 Mpx default applies, which still admits images expanding past a gigabyte in memory before its own guard trips. Harmless while every fetched byte comes from a Riot CDN; it is the amplifier that makes F-7 and F-8 expensive rather than merely wrong.

### F-12 — One connection pool, no statement timeout, shared with the cron pollers · MEDIUM

[prisma.service.ts:9](../../../apps/api/src/prisma/prisma.service.ts#L9) constructs `PrismaPg({ connectionString })` with no pool sizing and no `statement_timeout`; neither `DATABASE_URL` nor the Postgres service sets one, so the server default (disabled) stands. `PrismaModule` is app-wide, so every controller **and** every `@Cron` poller share one `pg.Pool` at its default `max: 10`. A burst against the F-2 match endpoints holds connections for the duration of each Riot round-trip plus cache write, which starves unrelated routes and the sync cron on the same ten slots.

### F-13 — `/status` serves raw exception messages publicly, in a 200 body · HIGH · **fixed 2026-08-03**

When a sync step throws, [match-sync.service.ts:127](../../../apps/api/src/lol/match-sync.service.ts#L127) (and :170 for the historical step) stores the message verbatim: `result.head = { error: errMsg(err) }`, where `errMsg` is `err.message` with no mapping ([:196-198](../../../apps/api/src/lol/match-sync.service.ts#L196-L198)). That value is returned by `getStatus()` straight out of `GET /status` ([status.controller.ts:22](../../../apps/api/src/status/status.controller.ts#L22)) and re-emitted to every SSE subscriber every two seconds.

The sync path calls into Prisma with no inner catch, so a database error arrives unmodified. A `P1001` reads `Can't reach database server at \`postgres\`:\`5432\`` — internal hostname and port, published to anyone.

What makes this worse than an ordinary unhandled exception is that it **routes around the protection that already works**. Nest's `BaseExceptionFilter` was verified to emit a fixed `{"statusCode":500,"message":"Internal server error"}` for non-`HttpException` errors regardless of `NODE_ENV`, so genuinely thrown errors are safe. This path captures the message *before* the filter can ever see it and serves it as normal, successful output. And because `POST /status/sync` is unguarded, an attacker can trigger sync ticks on demand to fish for a transient failure to read back.

**Fixed** with a `safeSyncError` classifier at both capture sites; the real message still goes to the logs, which already had it.

**Classified rather than blanked, deliberately.** The status page is the owner's own diagnostic surface, and "sync failed" for every failure would make it useless — so the fixed vocabulary keeps the half that is both useful and safe: `riot <status>` (Riot's key travels in a header, not the path, so its status and path carry nothing private), `database P1001` (the Prisma *code* identifies the failure class without quoting the connection string), `timeout`, `account not whitelisted`, and `sync failed` for anything unrecognised. Unrecognised defaults to the opaque label rather than passing the message through, which is the right way round for a default.

Three tests pin it, and the assertions are about what must *not* appear rather than only what must:

```
Prisma P1001 "Can't reach database server at `postgres`:`5432`"
  → "database P1001",  and not containing "postgres" or "5432"
RiotError(429)                     → "riot 429"
Error("connect ECONNREFUSED 10.0.0.5:5432 …")
  → "sync failed",     and not containing "10.0.0.5"
```

### F-14 — Every `/status/stream` subscriber gets its own 2-second polling timer · HIGH · **fixed 2026-08-03**

[status.controller.ts:47-64](../../../apps/api/src/status/status.controller.ts#L47-L64) builds the stream inside the handler with no multicast operator. RxJS observables are cold, so each connection constructs **its own** `interval(2_000)` and its own `switchMap(() => from(this.snapshot()))` — and `snapshot()` awaits `rateLimiter.getSnapshot()`, which loops every regional and per-method Bottleneck limiter awaiting `currentReservoir()` on each.

One thousand held connections is therefore ~500 full snapshots per second, each fanning out to a dozen-plus awaited limiter calls. The route takes no parameters and has no allowlist check, and nginx's `proxy_read_timeout 1h` means each connection is welcome to stay for an hour. No connection cap exists at any layer.

**Fixed** by building the snapshot and heartbeat pipeline once in the constructor and sharing it with `shareReplay({ bufferSize: 1, refCount: true })`. Cost is now constant in the number of connections rather than linear.

`refCount: true` is doing as much work as the sharing itself, and for two reasons worth stating:

- **It stops the timer when the last client disconnects**, so an idle box polls nothing at all. The previous shape polled for as long as any connection was held, and the naive fix — a module-scope observable without refCount — would have polled forever from boot.
- **It resets the replay buffer on the way down**, so a new connection cannot be handed the snapshot captured for a previous one. `startWith(0)` then gives it a current reading immediately instead of a two-second wait, preserving the behaviour the original `startWith` was there for.

Sync ticks stay per-subscriber deliberately: `forSyncTick()` is already a multicast `Subject`, so subscribing costs an observer entry rather than a timer or a query.

Three tests, and the first is the one that would have failed before:

```
5 concurrent subscribers      → getSnapshot called 1×   (was 5×)
+2s                           → 2×
last subscriber disconnects   → no further calls
reconnect after disconnect    → fresh snapshot, not the replayed one
```

Verified live as well: two concurrent SSE clients each received their events normally.

### F-15 — An unvalidated `queue` param grows an in-memory Map forever · MEDIUM · **fixed 2026-08-03**

`LolService.matchIdsCache` ([lol.service.ts:54](../../../apps/api/src/lol/lol.service.ts#L54)) is keyed `${puuid}:${regional}:${queue}` with a 30-second TTL checked **only on read** — there is no sweep, so an entry never read again is retained for the process lifetime. `queue` arrives from `@Query("queue", new ParseIntPipe({ optional: true }))` with no `@IsIn` against the known queue IDs, so every distinct integer mints a permanent entry. The account still has to be allowlisted, and the shared Riot limiter throttles the fill rate, so this is slow growth rather than a fast OOM — but it is monotonic and has no eviction path.

**Fixed on both halves, but not the way the note first proposed.** An `@IsIn` against a queue-ID allowlist would be wrong: the param filters matches by whatever queue they were played in, and Riot adds queues every season, so a closed set would reject legitimate values the moment one appears. The shared sets that exist (`RANKED_QUEUE_IDS`, `SR_LANE_QUEUE_IDS`, `NON_LANED_QUEUE_IDS`) are purpose-specific, not an inventory of what is valid.

So `queue` gets a range bound instead, which shrinks the key space, and — the part that actually closes it — the cache itself is now bounded and swept. A bound on the key space is not a bound on the map: the 30-second TTL is only consulted on a read of the same key, so an entry nobody asks for again was held for the process lifetime regardless of how small the key space was.

### F-16 — `X-Powered-By: Express` on every response · LOW · **fixed 2026-08-03**

Confirmed live against the running api rather than inferred from a missing call:

```
$ curl -sS -D - -o /dev/null http://localhost:2010/health
HTTP/1.1 200 OK
X-Powered-By: Express
```

**Fixed** with `app.disable("x-powered-by")`, confirmed gone from the live response.

`app.set("trust proxy", 1)` landed in the same change — the item the nginx work left open. It is a no-op today because nothing reads `req.ip`, but Express otherwise resolves every visitor to nginx's loopback address, so a future app-level limiter would bucket the whole internet as one client. It is `1`, not `true`: `true` trusts the entire `X-Forwarded-For` chain, whose client-supplied prefix is attacker-controlled.

### F-17 — `/og/home.png` is the cheapest way to pin the box · HIGH · **fixed 2026-08-03**

Three properties compound on the OG routes:

- **The raster is synchronous.** [og-card.ts:155](../../../apps/api/src/og/og-card.ts#L155) is `new Resvg(svg).render().asPng()`. The package's own typings expose both `render(): RenderedImage` and a separate `renderAsync` — the sync one is what ships, so every request blocks the single Node event loop for the full rasterisation. Nothing else in the process runs during it.
- **Nothing caches it.** The handlers advertise `s-maxage=2592000` to a shared cache that does not exist (F-3).
- **The image fetch has no timeout.** [og-card.ts:97](../../../apps/api/src/og/og-card.ts#L97) is a bare `await fetch(url)` — the only fetch in the api without one, against Riot's 10 s and Steam's 10 s. Combined with nginx's `proxy_read_timeout 1h`, a stalled upstream holds the connection for up to an hour.

`GET /og/home.png` is the sharpest lever because it takes **no parameters, needs no reconnaissance, and makes no upstream call** (its own comment says the home card is fully self-contained) — so its cost is pure, dependency-free, uncacheable CPU that an attacker can invoke in a loop with no rate limiting anywhere. Measured against the running dev api:

```
$ for i in 1 2 3; do curl -o /dev/null -w '%{http_code} %{size_download}B %{time_total}s\n' localhost:2010/og/home.png; done
200 202778B 0.326938s
200 202778B 0.084387s
200 202778B 0.066506s
```

~70 ms of blocking main-thread work per request, repeatable at will. Arrival rate above service rate turns into an unbounded backlog rather than fast failures, because nothing sheds load.

**Fixed**, all three: the `/og/` cache block (F-3) removes the repeat cost, `renderAsync` moves the raster onto the libuv threadpool, and the art fetch now carries `AbortSignal.timeout(10s)` plus `redirect: "manual"` — matching the image proxy, and closing the last fetch in the api that had neither guard.

The concurrency claim is measured rather than assumed, because "it runs off-thread now" is exactly the kind of change that can silently not take effect:

```
one request       0.106s
8 concurrent      0.229s total
```

Eight renders in roughly twice the time of one. Were the raster still occupying the main thread, eight would serialise to half a second at minimum — so the threadpool path is genuinely live. A test also asserts `renderAsync` is the function called, since reverting to `new Resvg(svg).render()` would pass every behavioural test while quietly serialising the process again.

### F-18 — Analytics windows are attacker-sized and recomputed from scratch every call · MEDIUM · **bounds fixed 2026-08-03**

Roughly twenty analytics endpoints take `count` / `start` / `limit` as `ParseIntPipe` with no bounds, feeding `take:` and `skip:` directly. `getCachedMatches` ([lol.service.ts:190-191](../../../apps/api/src/lol/lol.service.ts#L190-L191)) is the clearest: `skip: start, take: count` on a row shape carrying time-series JSON columns — the API counterpart of the 350 kB window the priming convention already refuses to server-render. `loadOwnerMatchCache` then issues a **second** unbounded query pulling full raw-match JSON for every match in the window, and `getChampionBuildFlow` does the same against the timeline cache, the largest blob in the schema. A repo-wide check found **zero** `@Max`/`@Min`/`@IsPositive` decorators in `apps/api/src`; nothing is memoized, so every call recomputes from Postgres.

Two qualifications keep this at MEDIUM rather than higher. The allowlist scopes every one of these to the owner's own accounts, so `count=999999999` returns that account's rows and not a table scan — but **the allowlist is not a real barrier here**, because those account names are exactly what the public profile URLs display. Anyone who has looked at the site once has valid parameters. Negative values are the sharper edge: Prisma reads a negative `take` as "take the last N", silently reversing pagination rather than erroring.

**Fixed** with one shared `BoundedIntPipe` ([bounded-int.pipe.ts](../../../apps/api/src/bounded-int.pipe.ts)) applied at all 24 `count`/`start`/`limit`/`days`/`queue` sites across the LoL, home and Steam controllers.

**It rejects rather than clamps.** These values size aggregation windows, so a silent clamp would answer with a different dataset than was asked for and the wrong number would look like a real result; a 400 is visible the first time it happens.

**Both bounds are pinned by real callers, not chosen for neatness** — and checking that first is what kept this from breaking three live surfaces. The champion table, champion detail and activity window each request **`count=2000`**, so a tidy-looking cap of 500 would not have errored: it would have aggregated a truncated window and reported a confidently wrong win rate. Two web call sites also send **`count=0`**, so the floor is 0 rather than 1. The ceiling is 5000, which clears real use with room to grow.

**A behaviour worth knowing before someone re-derives it.** The global `ValidationPipe({ transform: true })` runs *before* any param-level pipe, so a query param typed `number` is already coerced by the time the pipe sees it. Measured against the running api:

```
?count=abc    → 20 rows   (unparseable → undefined → DefaultValuePipe's 20)
?count=0x10   → 16 rows   (coerced to 16 before the pipe)
?count=-1     → 400
?count=5001   → 400 "count must be between 0 and 5000"
?count=2000   → 200
```

So malformed input resolves to the default rather than a 400, while out-of-range input fails — which is the half that carries the security property. The pipe's strict digit parse is kept as defence in depth for if that global config ever changes, and its unit tests exercise it directly.

Writing the test first paid for itself here: it caught that `Number("")` is `0` and `Number("0x10")` is `16`, so the original `Number.isInteger` check would have accepted both.

Related and uncached: `GET /steam/summary` makes three-to-four live Steam Web API calls per request (one of them dependent, so it cannot parallelise) at the ~900 ms the priming convention already measured, while the same service caches wishlist and name lookups. Hammering it risks Valve rate-limiting our key, which breaks the integration for real visitors — collateral denial rather than local load.

### F-19 — A DTO-valid matchId with an unknown platform prefix returns 500 · LOW

Confirmed live:

```
$ curl -w '\nHTTP %{http_code}\n' localhost:2010/lol/matches/ZZ1_123
{"statusCode":500,"message":"Internal server error"}
HTTP 500
```

`MatchIdParamDto` accepts `^[A-Z0-9]+_\d+$`, so `ZZ1_123` passes validation, and `platformToRegional` then throws a bare `Error` for the unknown prefix. The only registered filter is `@Catch(RiotError)`, so it reaches Nest's default handler. No information leaks — the message is correctly masked — but it is a 500 where a 400 belongs, and it is trivially reachable. Same path via `/og/match/…`.

**Fixed 2026-08-03** alongside F-2 — the shared `regionalForMatch` helper now maps an unrecognised prefix to `BadRequestException` rather than letting a bare `Error` become a 500.

**In practice the 400 branch is nearly unreachable, which is worth knowing before anyone "fixes" it again.** The tracked-match gate runs first, so `ZZ1_123` answers 404 and never reaches the platform parse — verified live. The 400 only fires for a match that *is* in our `Match` table yet carries an unparseable platform prefix, and rows there come from real Riot responses. So this is defensive, not load-bearing; the 500 it was written to remove is already gone by way of F-2's ordering.

### F-20 — `/steam/game/:appid/description` re-fetches from Steam forever for any appid we don't own · HIGH · **fixed 2026-08-03**

[owned-games.service.ts:524-556](../../../apps/api/src/steam/owned-games.service.ts#L524-L556). For an appid with no `steamGameEnrichment` row — i.e. any of the tens of millions of Steam appids the owner does not have — the flow is: lookup misses, live call to Steam's storefront `appdetails`, then `prisma.steamGameEnrichment.update({ where: { appid } })`, which throws P2025 because there is no row to update. The catch swallows it and sets `html = null`.

**The fetched result is therefore discarded, and nothing is ever written**, so the next identical request repeats the whole thing. This is strictly worse than F-2, which at least stops fetching after the first miss. The comment at [:547](../../../apps/api/src/steam/owned-games.service.ts#L547) shows the P2025 case was anticipated as a data-completeness matter; what it misses is that the upstream call has already been paid for by the time the write fails.

Confirmed live — three identical calls, none of which ever drops to cache speed:

```
$ for i in 1 2 3; do curl -o /dev/null -w "call $i: HTTP %{http_code}  %{time_total}s\n" \
    localhost:2010/steam/game/999999999/description; done
call 1: HTTP 200  0.318511s
call 2: HTTP 200  0.249612s
call 3: HTTP 200  0.193731s
```

A DB-cached read is single-digit milliseconds; ~250 ms sustained is the upstream round-trip, every time.

**Fixed 2026-08-03** by refusing outright for appids outside the library rather than switching to `upsert`. The route exists to serve our own game pages, so ownership is the honest constraint, and it closes the exposure and the never-caches bug in one move. The lookup is a primary-key hit on `SteamOwnedGame` rather than the existing `getGameRecap` pattern, which loads the whole 664 kB owned-games payload to answer the same question.

One test had to change intent rather than just gain a stub: it asserted that a missing enrichment row still fetched and swallowed the P2025. That *was* the bug, so it now asserts the refusal happens without calling Steam at all.

Confirmed live, and the latency is the evidence rather than the status code — an unowned appid is refused in single-digit milliseconds where it previously spent a Steam round-trip on every call:

```
unowned 999999999   404 in 0.005s, 404 in 0.003s   (was 200 in ~0.25s, every time)
owned   2622380     200 in 0.002s, 200 in 0.002s
```

### F-21 — `/steam/wishlist/:appid/hero-meta` fans one request into three upstream calls plus a CPU pass · HIGH

[wishlist-hero.service.ts](../../../apps/api/src/steam/wishlist-hero.service.ts), reachable with any integer appid and no ownership check. On a miss it makes a live `IStoreBrowseService/GetItems` call using our API key, then up to two more fetches against `shared.akamai.steamstatic.com`, then a Vibrant colour-extraction pass over the image. The memo is a plain `Map` with no eviction, so it is also unbounded memory keyed on attacker input.

**Half fixed 2026-08-03.** The cache is now bounded (64 entries, expired-then-oldest eviction on write); real use needs exactly one, the single imminent hero. The TTL alone never evicted, because it is only consulted on a read of that same key, so an entry nobody asks for again was retained for the process lifetime.

**The ownership clamp is deliberately still open.** Unlike every other Steam route this cannot gate on library membership — the game is unowned *by design*, that being the entire point of the surface. The obvious substitute is wishlist membership via `SteamWishlistAsset`, and it was not shipped because that table is populated by the wishlist enrichment pass, and it is not established that it is always populated *before* a hero is requested for a newly-added wishlist item. Gating on it could 404 a live surface — the same trap `UNRANKED` set in F-7, where a closed set built from the ten real tiers would have broken the profile hero. That needs a probe of the actual ordering, not an assumption. With F-4's rate limit now in place the residual exposure is bounded, which is why this was acceptable to defer rather than guess.

### F-22 — One shared Steam reservoir turns any of the above into a full-integration outage · HIGH (mechanism)

This is the finding that ties F-20, F-21 and `/steam/summary` together, and it is the reason they rank above their individual costs. [steam/rate-limiter.service.ts](../../../apps/api/src/steam/rate-limiter.service.ts) runs **a single Bottleneck instance for the entire Steam Web API surface** — 100,000 calls per 24 h, 5 req/s, 4 concurrent. The `family` labels (`store-items`, `appdetails`, `player-summaries`) are log tags, not separate reservoirs.

So a sustained attacker running at the limiter's own throttled ceiling drains the **whole daily quota in roughly five and a half hours**, and because the reservoir is shared, that starves every legitimate Steam feature at once — the pollers, wishlist name resolution, achievement-schema sync, and every visitor-facing Steam page. The limiter **queues rather than sheds**: its 15 s abandon deadline is a pileup backstop, not a rejection policy, so requests occupy queue slots rather than being turned away.

The Riot limiter has the same queue-don't-shed shape (dual windows, 20/s fast and 100/120s slow, per-method sub-limiters), which is what makes F-1 and F-2 degrade the owner's own sync pipeline rather than just costing quota.

**The image proxy has no application-layer limiter at all** — [upstream.ts](../../../apps/api/src/img/upstream.ts) has no Bottleneck, no concurrency cap, no breaker. Its only brake is the nginx disk cache, which F-9 shows is trivially bypassed. Worth noting specifically: `/img/lol/wiki-file/:filename` and `wiki-splash/:filename` forward an attacker-chosen filename straight to `wiki.leagueoflegends.com` — format-checked but never checked against real content — so this is the concrete path to getting our server IP rate-limited or banned by a Riot-run host.

### Refuted — the "repeated query param crashes two endpoints" claim

A lane reported that `?queueIds=1&queueIds=2` would arrive as an array, making `queueIdsRaw.split(",")` throw a `TypeError` and reliably 500 two unauthenticated endpoints. **It does not reproduce.** Tested live against both routes:

```
$ curl "…/pregame-calibration?queueIds=420&queueIds=440"   → HTTP 200, valid JSON
$ curl "…/champions/Ahri/stats?queues=420&queues=440"      → HTTP 200
```

The query parser hands the handler a string rather than an array, so `.split` is never called on the wrong type. Recorded here rather than dropped, because it is a plausible-sounding bug that would otherwise be re-derived by the next reader; the answer is that it was checked and the code is fine.

### Verified clean

Recorded because knowing where *not* to spend remediation effort is half the value, and because these are the classic findings a future reviewer will re-derive:

- **No `PUT`, `PATCH` or `DELETE` route exists anywhere in the api.** A decorator sweep across all twelve controllers found only `@Get` and `@Post`, and there are no singular `prisma.*.delete()` calls at all — the two `deleteMany` sites are cron-only. There is no unauthenticated path to destroying data; the exposure is growth and quota, not deletion.
- **Every Steam and LoL-static write path is cron- or poller-only**, confirmed by tracing DI consumers rather than by naming: the enrichment, play-session, unlock, player-state, GridDB, anchor and global-rarity services all write from sync methods no controller reaches. Two apparent counter-examples in `img/` turned out to be comment references, not dependencies.
- **`ensureAbilityDescription` is self-limiting** — it looks like an on-demand upstream fetch, but it `findUnique`s first and 404s any championId/slot/index that is not a real ability row, so a bogus id triggers no upstream call, and real ones refresh at most once per patch via a watermark.
- **`RankSnapshot` growth is dedup-gated** — it writes only when tier/division/LP actually changed, so repeated sync triggers cannot inflate it.
- **`accounts.json` is server-side config**, filesystem-watched, with no HTTP route that can read or mutate it.
- **The background pollers do not iterate the `Summoner` table — which bounds F-1.** The obvious escalation of F-1 would be write amplification: insert 100k summoner rows, and the pollers then poll them all forever. That does not happen. Both `MatchSyncService` (`@Cron` every 5 min) and `LiveGamePollerService` iterate `identity.getLolAccounts()` — the static `accounts.json` list — never `prisma.summoner.findMany()`. `getForPuuid` reads only its in-memory cache populated from that same list, so an arbitrary puuid is a miss returning `null`, not a new poll target. F-1 is quota burn plus table growth; it is not self-sustaining background load.
- **The LoL event bus is a plain `Subject`**, not a `ReplaySubject`/`BehaviorSubject`, so there is no unbounded buffer; per-connection subscriptions are torn down by Nest on disconnect. No structural listener leak.
- **SQL injection: clean, codebase-wide.** Zero `$queryRawUnsafe`/`$executeRawUnsafe`, zero `Prisma.raw`. All 11 raw-SQL sites use parameterised tagged templates and live in maintenance scripts under `apps/api/prisma/` that `app.module.ts` never imports — unreachable over HTTP.
- **Mass assignment: clean.** Exactly one `@Body()` binding exists in the whole api (`NarrativeWindowDto`), and it is a real validated DTO. No `@Req()`, no `data: req.body`, no spreads of user input into Prisma.
- **Dynamic query shape: clean.** No `?sort=`/`?orderBy=` mechanism exists; every `orderBy` across ~50 Prisma calls is a hardcoded literal.
- **CORS: clean, and the dev fallback cannot reach production.** The localhost regex is fully anchored (`/^http:\/\/localhost:\d+$/`, no `m` flag) so no `localhost.evil.com` bypass exists, and `NODE_ENV=production` is pinned in the Dockerfile *and* compose, with `requireEnv("WEB_ORIGIN")` using a falsy check that catches empty string — so the repo's documented empty-`ARG` trap does not apply here.
- **Secrets in the bundle, image layers, or git: clean.** Only `VITE_API_URL`/`VITE_SITE_URL` are `VITE_`-prefixed and neither is secret; the api Dockerfile declares no `ARG` at all, so nothing is baked into image history; `git ls-files` shows only `.env.example` templates tracked.
- **Containers do not run as root** — both Dockerfiles set `USER node`. Postgres is loopback-bound with image-default `scram-sha-256`. `scripts/deploy.sh` excludes `.env` from its rsync and echoes no secret.
- **Query-param bounds** are technically unbounded on ~15 `count`/`limit` params, but every one of those routes is allowlist-gated first, which scopes the query to a single owner puuid — so `count=999999999` returns that account's rows and nothing more. Worth tidying via a shared pipe; not exploitable.

### Also worth doing, from the same lanes

- **`app.set("trust proxy", 1)` in `main.ts`.** A no-op today — nothing reads `req.ip` — but the moment a rate limiter keyed on IP lands, Express's default resolves every visitor to nginx's loopback address and buckets the whole internet as one client. Setting it now costs one line and removes a trap from the F-4 fix. It must be `1`, never `true`, or the attacker-supplied prefix of `X-Forwarded-For` becomes trusted.
- **Container resource limits.** `compose.prod.yaml` sets no `cpus`/`memory` on any service, so an api container driven by F-9/F-11 can OOM a host it shares with Postgres.
- **`server_tokens off`**, HSTS via `certbot --hsts` (the documented invocation omits it), and a catch-all `default_server` returning 444 — cheap, and none are currently set.

A calibrated rate-limit configuration for F-4 was produced and is carried in the remediation queue rather than inlined here: `limit_req_zone` at 10 r/s (burst 30, `nodelay`) for `location /`, 20 r/s (burst 100) for `/img/` since one page legitimately fans out 30–60 image requests, plus `limit_conn` of 20/40 — which is also what bounds the hour-long connection budget that the SSE-driven `proxy_read_timeout 1h` hands to every route.

## What the shape of this says

Three patterns account for nearly every finding, and they are more useful than the individual list:

1. **An invariant enforced by hand at every call site eventually gets missed.** The owner allowlist is applied 27 times and skipped 3 (F-1). This is the same failure the repo already documented for `excludeRemakes`, and the same remedy applies: move the check to a boundary, then lint it.
2. **A cache that is missing, bypassable, or never written turns a cheap request into an expensive one.** F-2 (no clamp), F-3 (`/og` has no cache behind its cache header), F-9 (cache key includes ignored inputs), F-20 (write fails, so nothing is ever cached), F-18 (no memoization). Each looked like a performance detail and is actually the exposure.
3. **Validation is strong where a DTO exists and absent where one does not.** The DTO-bound params are genuinely well-constrained; the raw `@Param`/`@Query` bindings — `tier`, `alias`, `slot`, `apiName`, `count` — are where every input finding lives. Zero `@Max`/`@Min` decorators exist in the api.

## Remediation queue

F-1, F-2, F-4, F-7/8/9, F-13 and the F-20/F-21/F-22 cluster are launch gates, mirrored into [pre-launch-sweep.md](pre-launch-sweep.md). Ordered by value per unit of work:

~~1. **Edge rate limiting (F-4)**~~ — **shipped**, including the `trust proxy` follow-up.

~~2. **The allowlist hoist + lint (F-1)**~~ — **shipped**, at the choke point rather than as a route guard.

~~3. **Clamp the upstream miss-paths (F-2, F-20)**~~ — **shipped.** F-21's cache is bounded but its ownership clamp is still open, for the reason recorded in that finding. Cache-table eviction for F-2 remains, and still gates on verified backups.

~~4. **Image proxy hardening (F-7 `tier`, F-8, F-9, F-10)**~~ — **shipped.** Remaining in this group: `alias` and `patch` reach CDragon and DDragon by the same interpolation as `tier` did, and F-11's response-size cap plus `sharp.limitInputPixels` are untouched.

~~5. **`/og` (F-3, F-17)**~~ — **shipped:** cache block, `renderAsync`, fetch timeout and redirect refusal.

~~6. **Error hygiene (F-13, F-16, F-19)**~~ — **shipped:** classified sync errors, `X-Powered-By` gone, unknown platform mapped to a 400.
~~7. **Bounded pagination (F-18, F-15)**~~ — **shipped:** one `BoundedIntPipe` across all 24 numeric query params, plus a bounded match-id cache.
~~8. **`/status/stream` multicast (F-14)**~~ — **shipped:** one shared, ref-counted pipeline.

**Remaining, unordered:** `alias`/`patch` validation (F-7's tail), F-11's response-size cap and `sharp.limitInputPixels`, F-12's pool sizing and `statement_timeout`, plus the two deferrals recorded in F-2 and F-21.

~~**Not gated on launch: F-5.**~~ **Shipped 2026-08-03** — the Steam key no longer reaches any log line or error object.

**Before implementation: F-6.** The owner-auth session model wants hashing-at-rest and a named CSPRNG before the table exists, which costs nothing now.

Owner-auth remains a separate and equally hard gate — none of the above touches the three unguarded mutating POSTs. Worth recording that its severity is higher than "anyone can pause syncs" sounds: `POST /status/sync/pause` flips an in-process flag that gates both the cron tick and manual triggers, so a single anonymous request silently stops all match and rank ingestion **indefinitely**, until someone notices and resumes it or the process restarts. Silent and indefinite is what makes it worse than noisy abuse.
