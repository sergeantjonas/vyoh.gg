# Hosting plan and pre-deploy checklist

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

## Static asset serving — bundled LoL image set

See [lol-image-pipeline.md](lol-image-pipeline.md) for the full arc. The
short version: champion / item / profile-icon images are bundled into
`apps/web/public/lol/**` (~25MB) and served by the frontend host. This
section covers per-option deploy considerations.

### What ships in the frontend deploy

- `apps/web/public/lol/manifest.json` — runtime-readable
- `apps/web/public/lol/<champion>/{square,card,backdrop}.webp`
- `apps/web/public/lol/items/<itemId>.webp`
- `apps/web/public/lol/profile-icons/<iconId>.webp`
- `apps/web/public/lol/champion-summary.json`

Total: ~25MB of static assets, refreshed by a CI cron (see
`.github/workflows/refresh-lol-assets.yml`). Refresh PRs land asynchronously
from feature work, so deploys remain deterministic.

### Per-option notes

**Option A — Vercel**

- `public/` is served from Vercel's edge automatically with strong
  `Cache-Control` headers. No config needed.
- Vercel project settings have a 100MB deployment-size limit on the Hobby
  tier; 25MB is well under.
- Build output: assets pass through unchanged.

**Option B — Fly.io**

- Vite's static build is served by whatever process the Docker image
  starts (typically `vite preview` or a static-file server like `caddy`,
  `nginx`, or `serve`). Choose one with sensible default cache headers
  for `*.webp` and `manifest.json`.
- Recommended: bake a `Caddyfile` or `nginx.conf` into the image with:
  - `*.webp` → `Cache-Control: public, max-age=31536000, immutable`
  - `manifest.json` → `Cache-Control: public, max-age=300, must-revalidate`
- 25MB extra in the image is negligible.

**Option C — Hetzner VPS + Nginx**

- Add an Nginx `location` block for `/lol/`:

  ```nginx
  location /lol/ {
    alias /var/www/vyoh/dist/lol/;
    expires 1y;
    add_header Cache-Control "public, immutable";
  }
  location = /lol/manifest.json {
    expires 5m;
    add_header Cache-Control "public, must-revalidate";
  }
  ```

- Asset bundle ships as part of `dist/`. No CDN involved by default —
  add Cloudflare in front of the VPS if origin-bandwidth becomes a concern
  (it shouldn't at portfolio scale).

### Long-tail CDN fallback (CSP implications)

Even with assets bundled, the runtime fallback path still loads from
external CDNs for the long tail (new champions in the 24–72h window
between release and CI catch-up). If we add a `Content-Security-Policy`
header at the hosting layer later, the `img-src` directive must include:

```
img-src 'self' https://wsrv.nl https://cdn.communitydragon.org https://ddragon.leagueoflegends.com data:;
```

Today there's no CSP header set, so this is a forward-looking note.

### CI workflow has no hosting dependency

The asset-refresh workflow uses `peter-evans/create-pull-request` with
the default `GITHUB_TOKEN`. It runs regardless of which hosting option
is chosen and produces no deploy-time coupling.
