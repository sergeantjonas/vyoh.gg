# Hosting plan and pre-deploy checklist

**Status:** Active — pre-deploy work, not started. Owner lean is Hetzner VPS (single-VM, same-origin behind Nginx) but not committed. Landing is gated to a deliberate pre-launch sweep, not to any single content arc finishing. See [open-work.md](open-work.md) for sibling pre-deploy items (owner auth, status admin surface).

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

### 1. Replace hardcoded API_URL with an env var

`apps/web/src/lol/matches/use-matches.ts:11` has:

```ts
const API_URL = "http://localhost:2010";
```

Replace with:

```ts
const API_URL = import.meta.env.VITE_API_URL;
```

Then set `VITE_API_URL=https://<railway-service>.railway.app` (or custom domain
once wired) in Vercel's environment variable settings. This affects all fetch
calls **and** the `EventSource` URL for SSE — both share the constant.

### 2. Configure CORS on the NestJS side

Allow `https://vyoh.gg` (and `https://www.vyoh.gg` if relevant) as an allowed
origin in `main.ts`. `EventSource` goes through CORS the same as regular fetch.

### 3. Set backend env vars

Minimum required at deploy time (variable names are the same across all options):

- `DATABASE_URL` — Postgres connection string
- `RIOT_API_KEY` — from developer.riotgames.com
- `PORT` — Railway/Fly inject this automatically; on a VPS set it explicitly.
  Make sure `main.ts` reads `process.env.PORT`.

### 4. Custom domain

Point `vyoh.gg` DNS to wherever the frontend is hosted. Point `api.vyoh.gg`
(or similar) to the backend host. Update `VITE_API_URL` to the custom
subdomain once DNS propagates.

### 5. Verify SSE in production

Open DevTools → Network → filter `EventStream`. After triggering a sync, you
should see events flowing on the `matches/events` connection. If you see a
CORS error instead, step 2 is incomplete.

---

## Static asset serving

Superseded by [Phase 4 runtime image proxy](lol-image-pipeline.md#phase-4--runtime-image-proxy-planned-multi-stream).
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

- The Phase 4 runtime image proxy ([lol-image-pipeline.md §Phase 4](lol-image-pipeline.md#phase-4--runtime-image-proxy-planned-multi-stream))
  is the single largest change to this shape vs the original Option C
  draft. It adds the `/img/*` Nginx `proxy_cache` layer and removes the
  bundled `/lol/**` static-asset block in §Static asset serving above.
  The bundled-asset Nginx `location /lol/` config in that section
  becomes obsolete the moment Phase 4 Chunk 3 lands; keep the section
  as historical context until then.
- The Steam outbound TCP block (§Steam network protocol above) applies
  unchanged in the multi-site layout — egress-allow-all stays the
  simplest correct policy.
- Owner auth ([owner-auth.md](owner-auth.md)) gates the same set of
  POST endpoints regardless of how many sites share the box.
