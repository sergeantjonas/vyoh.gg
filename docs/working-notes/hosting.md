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
