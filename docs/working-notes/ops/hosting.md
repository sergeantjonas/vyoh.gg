# Hosting plan and pre-deploy checklist

**Status:** Active — **Option C (Hetzner VPS + Docker Compose) chosen 2026-07-26**, and **the machinery is written and verified as of 2026-07-27** ([Start migration](../cross-cutting/tanstack-start-migration.md) chunk 6). Nginx routes `vyoh.gg` and `api.vyoh.gg` as separate vhosts on the one VM; "same-origin" in the earlier drafts meant one machine, not one origin. Checklist items 1–3 are done in code; **4–6 remain — 4 and 5 need a VPS that does not exist yet, and 6 (backups, added 2026-08-01) must be live before launch** — nothing here is blocked on the repo any more, it is blocked on buying the box. The full launch-gate list (owner auth, ValidationPipe V3, timeZone sweep, branch protection, and this file's items 4–6) lives in [pre-launch-sweep.md](pre-launch-sweep.md).

**What exists in-repo now:** [`apps/api/Dockerfile`](../../../apps/api/Dockerfile), [`apps/web/Dockerfile`](../../../apps/web/Dockerfile), [`compose.prod.yaml`](../../../compose.prod.yaml), [`deploy/nginx/`](../../../deploy/nginx/) (two vhosts + the `proxy_cache_path` file + install/TLS instructions), and [`scripts/deploy.sh`](../../../scripts/deploy.sh). The whole stack was brought up locally on shifted ports and probed end to end: 60 migrations applied from empty, 12 routes hydrating clean, CORS answering for the configured origin and refusing another. What has *not* been exercised is anything that needs the real box — TLS, DNS, certbot, and the Steam CM egress question below.

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
  `docker compose exec postgres pg_dump`.~~ **`scripts/backup.sh`, 2026-08-15.**
  The script exists and is exercised; the timer that runs it nightly does not.
- A copy **off the box** (Hetzner Storage Box or object storage) — a backup on
  the same disk it protects is not one.
- ~~One restore drill against a scratch database before launch, so the first
  restore is not performed during an incident.~~ **`scripts/restore.sh`,
  2026-08-15** — rehearsed against the dev database, 29 tables at exact
  row-count parity. The drill still has to run once on the box itself.

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

This also unblocks the parked destructive data arcs: match-cache tiers 1B/2/3
and the Tier-5 TTL eviction ([match-cache-storage.md](../lol/match-cache-storage.md))
are irreversible transforms whose trigger (DB size pressure) will fire on prod —
none of them should run without a verified restore.

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
