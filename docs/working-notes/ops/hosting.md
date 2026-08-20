# Hosting plan and pre-deploy checklist

**Status:** Active — **Option C (Hetzner VPS + Docker Compose) chosen 2026-07-26**, and **the machinery is written and verified as of 2026-07-27** ([Start migration](../cross-cutting/tanstack-start-migration.md) chunk 6). Nginx routes `vyoh.gg` and `api.vyoh.gg` as separate vhosts on the one VM; "same-origin" in the earlier drafts meant one machine, not one origin. Checklist items 1–3 are done in code; **4–7 remain — 4, 5 and 7 need a VPS that does not exist yet, and 6 (backups, added 2026-08-01) is written and locally verified but not yet installed anywhere** — nothing here is blocked on the repo any more, it is blocked on buying the box. Item 7 (seeding prod from the dev database, added 2026-08-16) is a launch step rather than a gate, but it is the reason launch is not the same thing as an empty database. The full launch-gate list (owner auth, ValidationPipe V3, timeZone sweep, branch protection, and this file's items 4–6) lives in [pre-launch-sweep.md](pre-launch-sweep.md).

**Read the [launch runbook](#launch-runbook--added-2026-08-20) first on the night.** The numbered items below it are reference detail on individual topics, not an order of operations, and three of them carry ordering constraints that only make sense once seen together — DNS before the first build because `VITE_API_URL` is baked in, `.env` on the box before the first deploy because compose refuses to start without it, and the backup drill after seeding rather than before so it tests a dump of real data. A 2026-08-20 audit of exactly this question found that every piece of the deploy was documented and the sequence was not, plus one hole that would have failed the first deploy outright (`compose.prod.yaml` never passed the owner-auth env vars).

**What exists in-repo now:** [`apps/api/Dockerfile`](../../../apps/api/Dockerfile), [`apps/web/Dockerfile`](../../../apps/web/Dockerfile), [`compose.prod.yaml`](../../../compose.prod.yaml), [`deploy/nginx/`](../../../deploy/nginx/) (two vhosts + the `proxy_cache_path` file + install/TLS instructions), [`deploy/systemd/`](../../../deploy/systemd/) (the nightly backup timer + install instructions), [`scripts/deploy.sh`](../../../scripts/deploy.sh), and [`scripts/backup.sh`](../../../scripts/backup.sh) + [`scripts/restore.sh`](../../../scripts/restore.sh). The whole stack was brought up locally on shifted ports and probed end to end: 60 migrations applied from empty, 12 routes hydrating clean, CORS answering for the configured origin and refusing another. What has *not* been exercised is anything that needs the real box — TLS, DNS, certbot, and the Steam CM egress question below.

## Options under consideration

### Option A — Vercel + Railway + Neon (lowest ops overhead)

| Part     | Service  | Notes                                                  |
| -------- | -------- | ------------------------------------------------------ |
| Frontend | Vercel   | Deploys on push, edge CDN, custom domain via dashboard |
| Backend  | Railway  | Persistent Node process — no serverless timeout issues |
| Postgres | Neon     | Managed serverless Postgres, generous free tier        |
| Redis    | Upstash  | Add when BullMQ backfill workers are wired             |

Cost: ~$0–5/mo on free tiers, ~$15–20/mo if limits are hit. Multi-vendor but
each service is best-in-class for its role. Fastest path to a live URL.

### Option B — Fly.io (unified platform)

Everything on Fly: NestJS as a Docker container, Fly Postgres, Upstash for Redis.
Write a `fly.toml`, manage machines, choose regions. Stronger ops portfolio
signal than Option A. Cost: ~$5–10/mo (1 shared CPU machine + DB).

### Option C — Hetzner VPS + Docker Compose (full control, cheapest)

Single €4–6/mo VPS. Docker Compose for NestJS + Postgres + Nginx + Certbot.
Strongest "I can ship to production" ops signal. Most maintenance burden:
SSL renewal, OS updates, no auto-deploys without extra setup (e.g. Watchtower
or a simple deploy script triggered by CI).

---

## Steam network protocol (outbound TCP)

`SteamPicsService` (added in S5.5.A) talks to Steam's Connection Managers via the
Steam network protobuf protocol over **TCP**, not HTTPS. This is the only
outbound non-HTTPS dependency in the API; everything else (Riot, the
`api.steampowered.com` Web API, image CDNs) is HTTPS-only.

**What it needs:** outbound TCP to Steam CMs on a rotating port range (the
`steam-user` library handles CM discovery automatically; ports observed in the
wild span 27015-27050 plus 443 fallbacks). No inbound port needed — connections
are client-initiated, short-lived, and torn down per PICS fetch.

**Per-option implications:**

- **A (Vercel + Railway):** Railway permits arbitrary outbound TCP by default. No
  config needed.
- **B (Fly.io):** Same — Fly machines permit arbitrary outbound TCP.
- **C (Hetzner VPS + Nginx):** Nginx is reverse-proxy only and never touches
  outbound traffic from the Node process, so the proxy config is unaffected.
  **But:** if a host-level firewall is set up (UFW, nftables, or Hetzner's
  Cloud Firewall product), the egress policy must allow outbound TCP to
  Steam CM IP ranges. Don't lock egress to 80/443 only — that would silently
  break PICS enrichment with no error visible until a logo refresh runs.
  The simplest policy: allow all outbound (which is the OS default) and only
  filter ingress at the firewall.

**Failure mode if blocked:** `steam-user` retries CM discovery and eventually
times out. The enrichment tick will log the timeout and skip the logo hash for
that pass; capsule/hero/header (HTTPS-only) still resolve. So a misconfigured
firewall is graceful but silent — worth a smoke test post-deploy.

---

## SSE compatibility across all options

SSE (`/lol/summoners/:region/:gameName/:tagLine/matches/events`) works on all
three options. Railway (A), Fly (B), and a VPS process (C) are all persistent
long-running processes — no serverless timeout that would kill open connections.
The browser opens an `EventSource` directly to the API host; the frontend CDN
never proxies the stream.

## Launch runbook — added 2026-08-20

The ordered sequence, for the night it actually happens. Everything it refers to
is documented in full elsewhere; this exists because the *order* was not written
down anywhere, and several of these steps have hard constraints that are only
discoverable by having read all of them. Follow it top to bottom.

The numbered sections below this one are reference detail, not a sequence —
1 through 3 are already shipped code, and 4 through 8 are topics rather than
steps.

**0. Buy the box.** Hetzner CAX31 per [option C](#option-c--hetzner-vps--docker-compose-full-control-cheapest). Docker, docker-compose-plugin, nginx, certbot. Nothing below works without it, and nothing above it in the repo is still blocking.

**1. DNS first, before any image is built.** Point `vyoh.gg`, `www.vyoh.gg` and `api.vyoh.gg` at the box ([§ 4](#4-custom-domain)). This has to precede the first build rather than follow it: `VITE_API_URL` is a **build argument** baked into the bundle and into the markup `head()` emits, so changing the api hostname later means rebuilding the web image, not editing a file. The prod OAuth app in step 3 also needs the final api hostname before it can be registered.

**2. Write `/srv/vyoh/.env` on the box, by hand.** `scripts/deploy.sh` excludes `.env` from its rsync — production secrets have no local counterpart — so it has to exist there before the first deploy, not after. `mkdir -p /srv/vyoh` and `scp` a filled-in copy of [`.env.example`](../../../.env.example).

Compose now refuses to bring anything up when a required var is missing, naming
it. That is deliberate and it means an incomplete `.env` fails in a legible way
rather than as a restarting container — but it also means **step 5 cannot
succeed until this file is complete**, including the four owner-auth values from
step 3.

**3. Register the production GitHub OAuth app.** A **separate** app from the dev one: the client secret is shared across every redirect URI on a registration, so reusing dev's makes a laptop leak a production credential. Callback URL is `https://api.vyoh.gg/auth/github/callback`. Put the id, the secret, a fresh `SESSION_SECRET` (`openssl rand -hex 32`) and `OWNER_GITHUB_USER_ID` into the `.env` from step 2. Detail in [owner-auth.md](owner-auth.md).

**4. Install nginx config, then TLS.** [`deploy/nginx/README.md`](../../../deploy/nginx/README.md). One ordering trap inside it: `vyoh-cache.conf` goes into `conf.d/` **before** enabling the vhosts, because they reference the `limit_req_zone` it declares and nginx will refuse to load a vhost naming a zone that does not exist yet. Then `certbot --nginx -d vyoh.gg -d www.vyoh.gg -d api.vyoh.gg`.

**5. First deploy — against an empty database.** `VYOH_DEPLOY_HOST=vyoh scripts/deploy.sh`. It rsyncs, builds both images on the box, restarts the stack and smoke-checks the loopback endpoints, exiting non-zero if they do not answer. The api's entrypoint applies all migrations on start, so this is also what creates the schema.

Confirm the empty stack serves before putting data in it. [§ 7](#7-seed-production-from-the-dev-database--added-2026-08-16)
is explicit about why: seeding first gives you two variables at once when
something is wrong.

**6. Seed from the dev database.** The six steps in [§ 7](#7-seed-production-from-the-dev-database--added-2026-08-16), which end with clearing the `Session` table. Check its three preconditions first — the `TZ` match is the one that silently corrupts every historical timestamp if it ever stops holding.

**7. Install the backup timer and drill it.** [`deploy/systemd/README.md`](../../../deploy/systemd/README.md) and [§ 6](#6-backups--added-2026-08-01). Run the service once by hand rather than waiting for 03:30, then restore that dump into a scratch database. Doing this *after* step 6 is what makes the drill meaningful: it proves a dump of the real database restores, which is the thing actually reached for during an incident. A drill against an empty schema proves the script runs.

**8. Verify SSE through nginx.** [§ 5](#5-verify-sse-in-production). Trigger a sync, watch for `EventStream` traffic. The symptom of a regression here is specific: the stream connects, stays open, and delivers nothing until a buffer flushes.

**9. Enable branch protection on `main`.** A GitHub settings page, and the point at which direct-push stops being appropriate. Recorded as a decision rather than a gap in [pre-launch-sweep.md](pre-launch-sweep.md); this is where it flips.

Things that are *not* in this list because they need no action: nginx rate
limiting, the `/og` cache block and the image-proxy cache all ship with step 4;
CORS and the api's env contract are enforced by the code rather than configured
at deploy; the off-box backup copy stays open by decision, and step 7 leaves the
archives on the same disk as the volume they protect until it closes.

## Pre-deploy checklist (applies to all options)

### 1. Replace hardcoded API_URL with an env var — SHIPPED 2026-07-26

Landed as chunk 2 of the [Start migration](../cross-cutting/tanstack-start-migration.md). The literal now lives in exactly one place, [`apps/web/src/lib/api-url.ts`](../../../apps/web/src/lib/api-url.ts), and a structural lint in `apps/api/src/conventions.spec.ts` fails the build if a second copy appears.

The audit found **65** re-declared sites, not the 20+ estimated here. They split two ways, and the split is the part worth remembering:

- **58 fetch-side** (`fetch`, the SSE `EventSource`) import `API_URL`, which resolves to `API_INTERNAL_URL` when the module runs on a server and to the public origin in a browser.
- **7 render-side** (`champion-icon`, `summoner-icon`, `steam-image`, `match-og`, 3 route `head()`s) import `API_PUBLIC_URL`, a build-time constant. Anything that lands in markup has to be identical on both sides of a server render, so it cannot read the server origin.

Two predictions in the original plan did not survive contact:

- **Tests needed no changes.** The helper falls back to `http://localhost:2010` when `VITE_API_URL` is unset, so all 116 assertions still compare against the same literal. The step-4 "parallel updates" never materialised.
- **The Vite dev proxy (step 5) is dead work.** It assumed Option C means same-origin. It does not — the [topology](#topology) below routes `vyoh.gg` and `api.vyoh.gg` as separate vhosts even on a single VPS, so the public base is an absolute origin under every option. A path prefix could not work here regardless: the api serves `/lol/summoners/…` while the web app owns `/lol/$accountSlug/…`, and no prefix rule separates an account slug from a literal route segment.

What that leaves for the deploy: set `VITE_API_URL=https://api.vyoh.gg` at **build** time (it is baked into the bundle and into `index.html`'s `og:image`, not read at runtime), and `API_INTERNAL_URL` at **runtime** once SSR lands. Both are documented in `.env.example`.

The `og:image` breakage this section flagged as the most user-visible symptom — broken social previews on every shared match URL — is fixed by the same change, since `head()` now emits the absolute public origin.

### 2. Configure CORS on the NestJS side — SHIPPED 2026-07-27

`WEB_ORIGIN` is a comma-separated allowlist, resolved by `resolveCorsOrigin()`
in [`apps/api/src/env.ts`](../../../apps/api/src/env.ts). Apex and `www` are two
origins to a browser even when Nginx serves them as one site, hence the list.

Unset, it falls back to the dev pattern (any `http://localhost:<port>`), which
is why `bootstrap` **requires** the var under `NODE_ENV=production`. Without
that gate a deploy that forgot to set it comes up looking perfectly healthy and
only fails once a browser makes the first cross-origin request — which, since
SSR fetches server-side and carry no `Origin`, would be after the page had
already rendered. `EventSource` goes through CORS the same as regular fetch.

Nginx deliberately does **not** add CORS headers: a doubled
`Access-Control-Allow-Origin` is treated by browsers as none at all.

### 3. Set backend env vars — SHIPPED 2026-07-27

Wired through [`compose.prod.yaml`](../../../compose.prod.yaml) and documented in
`.env.example`. Compose fails to start rather than defaulting on
`POSTGRES_PASSWORD`, `RIOT_API_KEY`, `WEB_ORIGIN` and `VITE_API_URL`.

- `DATABASE_URL` — **built by compose**, not read from `.env`: inside the stack
  the host is the `postgres` service, not the `localhost` the dev URL names.
- `RIOT_API_KEY`, `STEAM_API_KEY`, `STEAM_GRIDDB_API_KEY` — from `.env` on the VPS,
  which `deploy.sh` deliberately does not rsync.
- `PORT` — set explicitly per service (2010 api, 2009 web); the published ports
  are `WEB_PORT`/`API_PORT` and bind loopback only.
- `TZ` — `Europe/Brussels`. Not hygiene: containers are UTC, and any
  `Intl.DateTimeFormat` without an explicit `timeZone` resolves to the process
  zone, so a UTC server renders a date one day off from the browser and React
  throws away the server tree. Caught on `/steam/achievements` in chunk 6.

### 4. Custom domain

Point `vyoh.gg` DNS to wherever the frontend is hosted. Point `api.vyoh.gg`
(or similar) to the backend host. Update `VITE_API_URL` to the custom
subdomain once DNS propagates.

### 5. Verify SSE in production

Open DevTools → Network → filter `EventStream`. After triggering a sync, you
should see events flowing on the `matches/events` connection. If you see a
CORS error instead, step 2 is incomplete.

The Nginx side of this is already written:
[`api.vyoh.gg.conf`](../../../deploy/nginx/api.vyoh.gg.conf) sets
`proxy_buffering off` for the whole vhost with an hour-long read timeout. It is
vhost-wide rather than per-location because the three SSE endpoints sit under a
dynamic prefix — `/status/stream`, and
`/lol/summoners/:region/:gameName/:tagLine/{matches,live}/events` — so no static
`location` covers them without a regex that rots the next time a route moves.
Buffering goes back on inside `location /img/`, where `proxy_cache` needs it.

The symptom to recognise if this is ever undone: the stream connects, stays
open, and delivers nothing until enough bytes accumulate to flush a buffer.

### 6. Backups — added 2026-08-01

Until the docs survey's prod-risk pass, no backup/restore story existed anywhere
in the notes (it was a one-word ★ idea in vnext-ideas). It gates launch because
the Postgres volume is the only irreplaceable artefact in the stack: LP-history
snapshots, Steam playtime snapshots, and every match older than Riot's retention
window cannot be re-fetched from any upstream — a lost volume is lost history,
not a re-sync. Everything else (images, containers, code) rebuilds from the repo
and the upstreams.

Minimum shape before the site is public:

- ~~Nightly `pg_dump` (custom format), ~14 days retained, reading through
  `docker compose exec postgres pg_dump`.~~ **`scripts/backup.sh` +
  `deploy/systemd/vyoh-backup.{service,timer}`, 2026-08-15.** Installing the
  timer is a box-side step; the units and their instructions are in-repo.
- A copy **off the box** (Hetzner Storage Box or object storage) — a backup on
  the same disk it protects is not one. **Deferred 2026-08-15**, decided rather
  than forgotten: nothing about the target can be tested before the VPS exists,
  and guessing at one produces a script whose only real test is the incident.
  Until it lands, the backups survive a bad migration, a dropped table, or a
  botched restore, and do not survive losing the disk. **This gate stays open.**
- ~~One restore drill against a scratch database before launch, so the first
  restore is not performed during an incident.~~ **`scripts/restore.sh`,
  2026-08-15** — rehearsed against the dev database, 29 tables at exact
  row-count parity. The drill still has to run once on the box itself.

The archives are unencrypted, decided 2026-08-15. They hold this project's own
data, the owner's GitHub id, and `Session` rows whose tokens are already hashed
— no third-party PII. On storage the owner controls, a passphrase is mostly one
more thing to lose, and losing it converts a recoverable incident into an
unrecoverable one. Revisit if this database ever holds anyone else's data, and
revisit alongside the off-box target if that target is not owner-controlled.

`backup.sh` writes `vyoh-<UTC stamp>.dump` to `/var/backups/vyoh`, verifies it,
then prunes to the newest `VYOH_BACKUP_KEEP` (default 14). `restore.sh` defaults
to restoring into a scratch database and diffing exact per-table row counts
against the live one; going over a real database needs `--into`, the name typed
back, and no clients connected.

Two things the rehearsal settled, both of which produce a check that passes
without checking anything:

- **`pg_restore --list` is not a verification.** A custom-format archive keeps
  its table of contents in the header, so `--list` accepts a file truncated to
  3% of its length. `backup.sh` decodes the whole archive to `/dev/null`
  instead — ~2s against 130 MB, and it does reject the truncated file.
- **`n_live_tup` is not a row count.** It is an estimate autovacuum maintains,
  and a freshly restored database has not been analysed, so it reads zero
  everywhere — a comparison built on it would pass by agreeing that both sides
  are empty. The drill counts exactly, via `query_to_xml`.

`deploy.sh` stays backup-agnostic apart from one `--exclude 'backups/'`. The
default backup directory is outside the synced tree precisely so `rsync
--delete` cannot reach it; the exclude only covers overriding `VYOH_BACKUP_DIR`
to a path inside the checkout.

Nothing surfaces backup health. A timer that has quietly stopped firing looks
identical to one that is working, so the two checks in
[deploy/systemd/README.md](../../../deploy/systemd/README.md) are manual. Dump
freshness on `/status` is the obvious follow-up and is not scoped.

This also unblocks the parked destructive data arcs: match-cache tiers 1B/2/3
and the Tier-5 TTL eviction ([match-cache-storage.md](../lol/match-cache-storage.md))
are irreversible transforms whose trigger (DB size pressure) will fire on prod —
none of them should run without a verified restore.

### 7. Seed production from the dev database — added 2026-08-16

Production does not start empty. It starts as a restore of the dev database,
using the same `restore.sh --into` path the backups already depend on.

The reason is that most of what makes this site worth looking at cannot be
re-fetched from anywhere. Roughly 25,000 rows are manufactured by the poller
running over months, and no upstream will return them:

| Table | Rows (2026-08-15) | Why it cannot be re-fetched |
|---|---|---|
| `SteamPlaytimeSnapshot` | 12,705 | Steam returns a current total, not a history |
| `SteamAchievementRarityHistory` | 11,341 | Global rarity is a point-in-time read |
| `RankSnapshot` | 823 | Riot returns current LP, not the curve |
| `SteamPlaySession` | 47 | Derived from playtime deltas between polls |

Match data (6,038 rows plus its two caches) is a weaker case — re-fetchable in
principle, but only inside Riot's retention window and at a quota cost that
runs straight into the standing warning about backfills competing with live
traffic ([pre-launch-sweep.md](pre-launch-sweep.md)). A restore costs zero
upstream calls.

Launching empty would mean shipping the LP curve, the playtime trends and the
rarity history as blank surfaces on a site whose whole premise is an always-on
Wrapped. The data is the product here, not a cache in front of one.

Sequence, and the order matters — seeding before the stack is known-good just
gives you two variables at once:

1. `scripts/deploy.sh`, then confirm the empty stack serves.
2. Dump dev: `VYOH_COMPOSE_FILE=compose.yaml VYOH_BACKUP_DIR=~/dumps scripts/backup.sh`
3. `scp` it to the box.
4. `docker compose -f compose.prod.yaml stop api` — `restore.sh` refuses while
   clients are connected, by design.
5. `scripts/restore.sh --into vyoh <dump>`
6. Start the api, verify, then `delete from "Session";`

Three things this depends on:

- **Naive timestamps line up.** All 51 `DateTime` columns are naive
  `timestamp` — zero `@db.Timestamptz` — so their stored value is whatever
  wall clock the writer had. `compose.prod.yaml` sets `TZ=Europe/Brussels` on
  api and web, which is what the devcontainer runs, and Postgres is UTC on both
  sides. Dev and prod therefore read these columns identically and the restore
  needs no conversion. **If that TZ ever diverges, this stops being safe** and
  every historical timestamp shifts.
- **Migration parity.** The dump carries `_prisma_migrations` and replaces
  prod's. Deploy the same commit the dump was taken against, and check dev is
  at head first, or prod's schema history describes something the code does not
  expect.
- **The dev `Session` row.** Harmless — the cookie is scoped to `localhost` and
  is never sent to `vyoh.gg` — but it is stale state with no reason to exist on
  a fresh box.

This is not a substitute for the drill in § 6. Seeding proves a dev dump
restores; the drill proves that *prod's own nightly dumps* restore, which is
the thing actually reached for during an incident. Seeding does de-risk it
substantially, and it happens first.

Anything in the seeded roster that should not be public comes out through the
accounts arc's purge rather than by hand ([accounts-admin.md](accounts-admin.md)).

### 8. Trim the api image — added 2026-08-20

**Complete 2026-08-20: 1.77 GB → 1.14 GB**, in two commits. Chunk A pruned
`onnxruntime-node` from 259 MB to 20 MB; chunk B removed the build and test
toolchain, taking the container's executable surface from thirteen binaries to
one. Chunk C (`pnpm deploy --prod`) is deliberately not done — reasoning at the
end of this section.

**Why the image is 1.77 GB at all**, since the inventory alone doesn't explain
it: the runtime stage does one unpruned `COPY /repo/node_modules`, so it ships a
*development* install. That is the root cause; everything else multiplies it.
The api's own dependencies are unusually heavy because it does image work —
`sharp` (+18 MB libvips), `@resvg/resvg-js`, `satori`, `node-vibrant`,
`smartcrop-sharp`, `onnxruntime-node` — and every native module bundles
prebuilds for every platform it supports rather than the one it runs on, which
is ~380 MB of platform binaries. On top of that sits transitive weight nobody
chose (traced with `pnpm why`, 2026-08-20): `class-validator` →
**`libphonenumber-js` 13 MB, in `dependencies`**, for a validator this project
never calls; `@prisma/config` → `effect` 33 MB; the `prisma` CLI →
`@prisma/studio-core` 43 MB + `@prisma/dev` 19 MB + `pglite` 24 MB. Plus
duplicate resolutions nobody decided — `typescript` 6.0.3 *and* 5.9.3 (47 MB),
`rxjs` 7.8.1 *and* 7.8.2 (24 MB). Roughly half the layer is packaging rather
than payload.

**Chunk A — prune onnxruntime's foreign prebuilds.** Windows DLLs and macOS
dylibs were 203 MB of the package's 259, for a 1.3 MB face-detection model.
Two things about the implementation are load-bearing:

- **It prunes in the build stage, not the runtime stage.** The obvious place is
  beside the runtime `COPY node_modules`, and a `rm -rf` there deletes the files
  while leaving them in the layer they arrived in — the image measures the same
  and the work reads as done. Deleting before the COPY is what makes them
  absent.
- **It keys off `TARGETARCH`** rather than hardcoding an arch, because the dev
  box is arm64 and the VPS is likely x64, and a wrong guess fails on the first
  Steam artwork request rather than at build time. An unhandled arch, a missing
  `napi-*` directory, or a missing target arch is a hard build error — silently
  keeping nothing would ship a broken image.

Verified 2026-08-20 rather than assumed. The same inference probe run against
the pre-change and post-change images returned **byte-identical output** —
session opens on the real model, `scores`/`boxes` outputs, all four rotations
execute. And the trimmed image's real entrypoint applied **all 67 migrations,
0 unfinished, 29 tables** against a throwaway database, so `migrate deploy` is
unaffected.

**Chunk B shipped 2026-08-20: 1.43 GB → 1.14 GB, and 13 executables → 1.**

**The justification is the executable surface, not the disk, and that only
became clear after reading `deploy.sh`.** Images are built on the VPS — no
registry, `rsync` sends source — so trimming saves neither bandwidth nor
download, and 160 GB makes the disk argument thin. What it does fix is that
`node_modules/.bin` held `biome conc concurrently nest playwright prisma spack
swc swcx tsc tsserver tsx vitest`, all invokable in a container serving public
traffic. A language server and a browser launcher in a production runtime is a
finding on its own terms, in the same class as
[api-exposure-audit.md](api-exposure-audit.md), and it is the reason to do this.
The megabytes are a side effect. Anyone re-reading this to justify more
size work should start from that.

Implemented as two mechanisms with deliberately different guarantees. The `.bin`
sweep is an **allowlist** — everything but `prisma` is deleted and the build
asserts the result — so a dependency added next year cannot reintroduce an
executable regardless of what the package list says. The package list is
opportunistic removal of the code behind those binaries; a name that vanishes
upstream is harmless, and drift shows up as image size rather than as a broken
container.

**Three findings, each of which cost a cycle:**

- **`@prisma/studio-core` (43 MB) and `@prisma/dev` (19 MB) cannot be removed.**
  The CLI requires both *eagerly*, even for `migrate deploy` — hiding them fails
  with `Cannot find module '@prisma/studio-core/data/bff'` and
  `'@prisma/dev/internal/state'`. So Prisma Studio's data layer ships to
  production for as long as the api container is the thing that runs migrations.
  The only escape is moving migrations out of it (a one-shot container, or
  `deploy.sh` over ssh), which is a bigger decision than this chunk. `pglite`
  (24 MB) *is* removable; `effect` (33 MB) is not, being reached through
  `@prisma/config` when it reads `prisma.config.ts`.
- **pnpm writes `.bin` entries as ~900-byte shim scripts, not symlinks.** The
  first implementation deleted packages and then swept dangling links with
  `find -xtype l`, which matched nothing — every shim survived, looking
  perfectly runnable while its package was gone. The assert caught it. Sweep by
  name here, not by brokenness.
- **`find -name '@scope/pkg@*'` silently matches nothing in the pnpm store**,
  because the store uses `+` as the scope separator (`@biomejs+biome@1.9.4`) and
  `-name` cannot match a `/` in a basename. An early probe "passed" while
  testing only the ten unscoped candidates. Any future store surgery should
  spell scoped names with `+`.

Also settled: `typescript`, `esbuild` and `tsx` are **not** needed to load
`prisma.config.ts`. `@prisma/config` handles the TS config itself.

**Verified against the built image, not a simulation** — four gates, all green:
`migrate deploy` applied 67 migrations to a throwaway database; the Nest module
graph resolved; onnx inference ran; and the real entrypoint booted to
`/health` 200 in ~14s. That last one earned its place — the module graph
resolving is *not* the same as the server starting, and only the boot gate
exercises `main.ts`'s env validation.

No smoke script was committed, because `deploy.sh` already smoke-checks the
endpoints over ssh and exits non-zero, which is the durable net for exactly this
failure mode. If a dependency change ever warrants re-running the gates by hand,
the shape is: a scratch database, dummy values for the six vars `main.ts`
requires, and `docker run` against the built image.

**Why not restructure onto `pnpm deploy --prod` instead** (the "proper" fix).
The Dockerfile gives two reasons and only one holds. The generated Prisma client
really does live in the pnpm virtual store — verified on disk at
`node_modules/.pnpm/@prisma+client@7.9.0_…/node_modules/.prisma` — and
`pnpm deploy` re-materialises from the content-addressable store, so it would
ship a pristine client with no generated output. But that is a consequence of
`generator client { provider = "prisma-client-js" }` having no `output` path;
Prisma 7's `prisma-client` generator requires one and emits into the source
tree, at which point the client is an ordinary build artifact. The installed
`prisma@7.9.0` build references `"prisma-client"`, and only **4 files** import
`@prisma/client`, so the churn is small. The Dockerfile's second reason — the
prisma CLI is a devDependency needed for `migrate deploy` — is a
misclassification rather than a constraint: something the runtime needs at every
start belongs in `dependencies`, and `--prod` would then keep it.

Still not the first move. A is 240 MB for one build-stage `RUN`; C is a
generator migration whose real unknown is what an ESM-first client does to the
SWC build and to `@vyoh/shared` being consumed as raw `.ts`. The honest ordering
is A, then B, then re-ask whether 1.2 GB is worth a migration — and the better
reason to skip C is that ratio, not the one currently written in the Dockerfile.

**Not urgent either way:** 160 GB disk, and layer caching means only changed
layers move on a deploy.

---

## Static asset serving

Superseded by [Phase 4 runtime image proxy](../lol/lol-image-pipeline.md#phase-4--runtime-image-proxy-planned-multi-stream).
The bundled `apps/web/public/lol/**` set, the per-option Nginx/Vercel/Fly
`location /lol/` deploy notes, the CSP `img-src` forward-look against
wsrv.nl + CDragon + DDragon, and the `refresh-lol-assets.yml` CI workflow
all become obsolete the moment Phase 4 Chunk 3 lands and deletes the
bundled set. Pre-launch hosting work should treat the `/img/*` proxy as
the only static-image story; the CSP `img-src` reduces to `'self' data:`
once vendor URLs no longer appear in the browser.

---

## Multi-site target shape (single Hetzner VPS, N projects)

Option C above only describes vyoh.gg on its own box. The lean is to use
the same VPS for additional sites and one-off projects, with vyoh.gg as
the largest tenant. This section is the target shape — what to provision
at the pre-launch hosting sweep, and what conventions every future site
on the same box should follow.

### Topology

```
                  ┌──────────────────────────────────────────┐
   :443  ─────►   │ Nginx (host-installed, not containerised)│
                  │ - TLS termination (Certbot)              │
                  │ - vhost routing by server_name           │
                  │ - vyoh.gg          → SPA static root     │
                  │ - api.vyoh.gg      → proxy_pass :20XX    │
                  │ - other-site.tld   → static / proxy      │
                  │ - /img/* proxy_cache (Phase 4)           │
                  └────────────────┬─────────────────────────┘
                                   │ 127.0.0.1:20XX (per-app loopback)
                  ┌────────────────┼────────────────┐
                  ▼                ▼                ▼
            vyoh-api (Node)   site2-api (Node)   ...
                  │                │
                  └────────┬───────┘
                           ▼
              postgres (one cluster, DB+role per project)
```

### Per-component conventions

- **Nginx is host-installed, not containerised.** It's the TLS
  termination and cert-renewal point; running it as a container forces
  cert-volume gymnastics and buys nothing on a single VPS. Configs live
  at `/etc/nginx/sites-available/<project>.conf`, symlinked into
  `sites-enabled/`. One file per project — each contains its `server_name`,
  TLS block, static `root`, and any `proxy_pass` lines.
- **Static SPAs are served by Nginx directly, no container.** Vite's
  `pnpm build` outputs plain HTML/JS/CSS to `apps/<app>/dist/`; deploys
  are `rsync` to `/var/www/<project>/dist/` (from CI or local). A
  container around `vite preview` or `serve` is pure overhead. Per site,
  expect 0–1 backend containers, not 2.
  **vyoh.gg stopped qualifying when Start landed** (2026-07-27) — SSR
  needs a long-lived Node process, so `vyoh.gg` is now a second
  `proxy_pass` target rather than a static root, and the site runs 3
  containers (web, api, postgres). The rule still holds for genuinely
  static sites on the same box. Config:
  [`deploy/nginx/vyoh.gg.conf`](../../../deploy/nginx/vyoh.gg.conf).
  Note that `dist/client` is served by the *web container*, not by Nginx —
  it lives inside the image, so mounting it out to a `root` directive
  would mean a volume that has to stay in step with the image. The
  adapter handles static files and Nginx handles compression, TLS and
  logging; the split is written down in
  [`node-adapter.ts`](../../../apps/web/server/node-adapter.ts).
- **Backends run as per-project Docker Compose stacks.** Each project
  gets `/srv/<project>/docker-compose.yml`. Backend containers bind to
  a distinct `127.0.0.1:20XX` loopback port (no public bind, Nginx is
  the only ingress). No cross-project Docker network meshing.
- **One Postgres cluster, separate DB + role per project.** Postgres
  itself is one container (or host-installed) shared across projects;
  isolation is at the database + role layer, not the cluster layer.
  Saves a few hundred MB of RAM vs a Postgres-per-project layout.
  Example: `CREATE DATABASE vyoh; CREATE ROLE vyoh_app LOGIN; GRANT ALL
  ON DATABASE vyoh TO vyoh_app;` — and a separate `vyoh_app` connection
  string in vyoh-api's env.
- **Certbot handles all hostnames in one install.** Nginx plugin for
  the easy case; DNS-01 if/when we want wildcard certs. Renewal via
  the bundled `certbot.timer`, no hand-rolled cron.
- **Deploys are `rsync` + `docker compose up -d --build`.** Per
  project. A simple `deploy.sh` is enough; full CI/CD orchestration is
  out of scope for the portfolio tier. Watchtower is rejected — visible,
  intentional deploys are more useful than auto-pulls for a few sites.
  vyoh's is [`scripts/deploy.sh`](../../../scripts/deploy.sh): it rsyncs
  (excluding `.env`, so production secrets stay on the box and have no
  local counterpart), builds on the VPS, and then **smoke-checks the
  three endpoints over ssh and exits non-zero if they do not answer**.
  Images build on the VPS rather than locally: there is no registry, and
  `docker save | ssh docker load` moves ~2 GB per deploy over a link
  slower than the CAX31 is at building.
- **Migrations run from the api container's entrypoint**, not from
  `deploy.sh`. `prisma migrate deploy` is a no-op once the journal is
  current, so a restart costs one query — and the alternative loses: a
  container coming back after a crash would otherwise serve against
  whatever schema it happened to find. This is also why the api image
  keeps its devDependencies: the prisma CLI is one, and Prisma's
  generated client is written into the virtual store at install time, so
  `pnpm deploy --prod` would strip both. The web image does prune, for
  exactly the reason the api cannot.

### Sizing implications

The multi-site shape ratchets up the case for **CAX31 (8 vCPU / 16 GB
ARM / 160 GB NVMe, ~€12.49/mo)** over CAX21:

- vyoh.gg API alone is in the 200–400 MB RSS range; with the Phase 4
  image proxy Sharp transcodes add bursty allocation on top.
- Postgres baseline ~500 MB–1 GB depending on `shared_buffers` and the
  size of the LP history table.
- Nginx + the `proxy_cache` working set live in page cache; healthy on
  a 16 GB box, tight on 8 GB once a second project lands.
- 160 GB disk easily absorbs the 2 GB Nginx cache ceiling plus a
  multi-project Postgres data dir for the foreseeable future.

### Cross-references

- The Phase 4 runtime image proxy ([lol-image-pipeline.md §Phase 4](../lol/lol-image-pipeline.md#phase-4--runtime-image-proxy-planned-multi-stream))
  is the single largest change to this shape vs the original Option C
  draft. It adds the `/img/*` Nginx `proxy_cache` layer — written in
  [`vyoh-cache.conf`](../../../deploy/nginx/vyoh-cache.conf) (2 GB ceiling,
  7-day inactive, `proxy_cache_lock` so a miss does not stampede sharp)
  plus the `location /img/` block in the api vhost — and removes the
  bundled `/lol/**` static-asset block in §Static asset serving above.
  The bundled-asset Nginx `location /lol/` config in that section
  becomes obsolete the moment Phase 4 Chunk 3 lands; keep the section
  as historical context until then.
- The Steam outbound TCP block (§Steam network protocol above) applies
  unchanged in the multi-site layout — egress-allow-all stays the
  simplest correct policy.
- Owner auth ([owner-auth.md](owner-auth.md)) gates the same set of
  POST endpoints regardless of how many sites share the box.
