# Owner auth — GitHub OAuth for gated admin surfaces

**Status:** Active — **chunks 1 and 2 both shipped 2026-08-13. The launch gate is closed:** every mutating route answers 401 without an owner session, and the frontend renders them locked. Only chunk 3 remains. It was recorded as "prod wiring rather than code", and that was wrong in one load-bearing way, found 2026-08-20: `compose.prod.yaml` shipped 2026-07-27, *before* chunk 1 added four unconditional `requireEnv` calls, and was never updated to pass them — so the production api could not have booted at all. Fixed the same day, along with the root `.env.example`, which held none of the api's secrets because in dev they live in `apps/api/.env` and the compose stack never reads that file. The rest of chunk 3 genuinely is wiring: a separate prod OAuth app, and the values themselves. Plan written 2026-05-14; naming option 1 confirmed and built. The companion status-page admin surface landed 2026-09-02: its Steam sync rows are public and read-only, and its granular LoL trigger added the fifth gated route, `POST /status/sync/patches`. See [open-work.md](../open-work.md).

A working note for the auth layer. The status page used to expose mutating POSTs unguarded — `POST /status/sync`, `POST /status/sync/pause`, `POST /status/sync/resume`, plus a per-account sync trigger — and the surface of "owner-only" actions will grow once Steam integration toggles, manual refreshes, secret-rotation indicators, and draft content previews land. The fix was worth shipping deliberately (real OAuth flow, session table, guard pattern) rather than as a `?key=` env hack — both as freelance-profile signal and because the half-fix isn't faster to write.

Direction (owner, 2026-05-14): **single-owner auth via GitHub OAuth**, session cookie backed by a Prisma `Session` table, applied as a NestJS guard. Public read-only views stay untouched; admin surfaces stay *visibly* gated (locked button + Radix tooltip), not hidden — half the point is that a reviewer poking around can see the layer exists.

Sequencing (owner, 2026-05-14): **not urgent — pre-deploy work.** Owner only hosts vyoh.gg when the app feels pretty done, so while it's unhosted the unguarded POSTs aren't reachable to anyone but the owner. This is not gated to Steam S2 finishing; it stays parked in [open-work.md](../open-work.md) as a pre-deploy item alongside CORS hardening, prod env vars, and the hosting choice itself — and lands as part of one deliberate pre-launch sweep rather than as a "next" arc.

Sibling docs: [security.md](security.md) (this lands the "auth surface" CodeQL was deferred against), [hosting.md](hosting.md) (cookie/callback URL depends on which option ships).

---

## Decisions up front

- **Single-owner allowlist by GitHub user ID** (not username — usernames can be transferred). One ID hardcoded via env var, no roles, no DB-backed user table beyond sessions.
- **Cookie session, opaque session ID, Prisma-backed.** Not JWT. Revocation is trivial (delete the row), we already have Postgres, and a sessions table is one of those things that reads as "knows how to do auth without npm-installing four packages." `SameSite=Lax; HttpOnly; Secure` in prod.
- **NestJS `OwnerGuard`** applied per-route via `@UseGuards(OwnerGuard)`. Not a global guard — explicit at each call site so it's obvious in code review which endpoints are gated.
- **Frontend `useViewer()` hook**, parallel to the existing `useMe()`. Returns `{ isOwner: boolean } | null`. Gated UI renders disabled controls with a Radix tooltip explaining the gate when `viewer.isOwner` is false.
- **No multi-role, no audit log, no IP allowlist, no 2FA.** GitHub already enforces 2FA on the owner account; piggybacking on that is the whole point.

---

## Naming collision — handle before the first chunk

The existing `IdentityModule` and `/me` endpoint return *content* identity (`{ lol: LolAccount[]; steam: string[] }` — the accounts the site portraits), not *visitor* identity. The shared type is `Me` in [@vyoh/shared](packages/shared/). If we add a second `/me` for "who is logged in," readers will conflate them.

Two options:

1. **Keep `Me` for content, use `Viewer` for visitor.** Add `GET /auth/viewer` returning `{ isOwner: boolean } | null`. Hook: `useViewer()`. Minimal churn — zero renames in shared types, two well-named symbols sitting side by side. **Recommended.**
2. **Rename `Me` → `Accounts` and free up `/me` for visitor identity.** More semantically clean long-term, but ripples through `Me` references in `@vyoh/shared`, `IdentityController`, `IdentityService`, and `useMe`. Not worth it for one extra hop.

Plan assumes option 1 unless overridden. `IdentityModule` stays as-is; the new module is `AuthModule`.

---

## Backend shape

### New Prisma model

```prisma
model Session {
  // SHA-256 of the cookie value, hex. NOT the token itself — see below.
  tokenHash    String   @id
  githubUserId Int                     // GitHub numeric ID, not login
  githubLogin  String                  // cached display only — never trusted
  createdAt    DateTime @default(now())
  expiresAt    DateTime                // sliding 30-day expiry
  absoluteExpiresAt DateTime           // hard ceiling, ignores activity
  @@index([expiresAt])
}
```

No `User` table. A single GitHub user ID is the entire authorization model — owning the matching session row *is* the proof. If the owner ever wants multiple identities (a second device with its own session), they share the same `githubUserId`; expiry / revocation is per-row.

**Three details that are free to get right now and expensive to migrate later.** Raised by the [API exposure audit](api-exposure-audit.md) § F-6, which reviewed this plan as a design rather than waiting to review the implementation.

1. **Store a hash, never the token.** The first draft used the cookie value itself as the primary key, which makes the table a list of working credentials: anything that can read it — a backup, a stray Prisma Studio window, a query log, an errant `SELECT` in a future admin surface — yields usable sessions rather than evidence that sessions existed. Generate the raw token, send it as the cookie, persist only `sha256(token)`, and look up by hashing the incoming cookie. The table does not exist yet, so this costs one line today.

   Plain SHA-256 is right here, not bcrypt/argon2: those exist to slow brute force against *low-entropy* human passwords, and a 256-bit random token has nothing to brute-force. A slow hash on every guarded request would only cost latency.

2. **Name the generator explicitly.** "Opaque random" does not pin a mechanism, and the failure mode is silent — a session minted from `Math.random()` or a v1 UUID looks identical to a good one. Use `crypto.randomBytes(32).toString("base64url")`.

3. **Give expiry an absolute ceiling.** A sliding 30-day window that extends on every check means a session used once a month never expires, which is indefinite access from a single successful login. Keep the sliding window for convenience, and add `absoluteExpiresAt = createdAt + 90 days` that `OwnerGuard` checks alongside it. This closes the open question at the bottom of this note rather than carrying it into implementation.

### New `AuthModule` (apps/api/src/auth/)

- `auth.controller.ts`
  - `GET /auth/github/login` — generates state token, sets short-lived state cookie, 302 to `https://github.com/login/oauth/authorize`.
  - `GET /auth/github/callback?code&state` — exchanges code, validates `githubUserId === OWNER_GITHUB_USER_ID`, creates `Session` row, sets session cookie, 302 to `/status` (or `?next=` if passed safely).
  - `POST /auth/logout` — deletes session row, clears cookie. Idempotent.
  - `GET /auth/viewer` — returns `{ isOwner: true, login: string } | null`. Cheap, cacheable in React Query for 30 s.
- `auth.service.ts` — GitHub token exchange, session create/lookup/revoke.
- `owner.guard.ts` — NestJS guard. Reads the session cookie, hashes it, looks up the row by `tokenHash`, and checks `expiresAt > now`, `absoluteExpiresAt > now`, and `githubUserId === OWNER_GITHUB_USER_ID`. On success extends `expiresAt` only — never `absoluteExpiresAt`, which is the whole point of having it. On failure: 401.

### Env vars

| Var | Purpose |
|---|---|
| `OWNER_GITHUB_USER_ID` | The one allowed numeric ID. Hardcoded; not user-configurable per session. |
| `GITHUB_OAUTH_CLIENT_ID` | From the GitHub OAuth app — see step below |
| `GITHUB_OAUTH_CLIENT_SECRET` | Same |
| `SESSION_COOKIE_DOMAIN` | Empty in dev (same-origin), `.vyoh.gg` if subdomain split in prod |
| `SESSION_SECRET` | HMAC key for the OAuth state token only — session IDs are random, not signed |

All but `SESSION_COOKIE_DOMAIN` go through `requireEnv` in `bootstrap()` so the api refuses to start without them — empty is that one's correct dev value, and `requireEnv` treats empty as missing.

### Routes gated (all five, shipped)

`@UseGuards(OwnerGuard)` on:

- `POST /status/sync`, `POST /status/sync/pause`, `POST /status/sync/resume` ([status.controller.ts](../../../apps/api/src/status/status.controller.ts))
- `POST /status/sync/patches` (same file) — the granular patch-note fetch, added 2026-09-02. It sits on the status controller rather than on `patch.controller.ts` so every operational trigger stays on one controller and one `GUARDED_ROUTES` entry; `StatusModule` already imported `LolModule`, which exports `PatchService`.
- `POST /lol/summoners/:region/:gameName/:tagLine/matches/sync` ([lol.controller.ts](../../../apps/api/src/lol/lol.controller.ts)) — the per-account trigger `useSyncAccount` calls

That is the api's entire mutating surface. `StatusModule` and `LolModule` both import `AuthModule`, which is what makes the guard's own `AuthService` dependency resolvable — a guard resolves against the module declaring the guarded controller, so the decorator alone is not enough.

Public endpoints — `GET /status`, `GET /status/stream` (SSE), `GET /me`, `GET /lol/...`, `GET /steam/...`, `GET /health` — stay open. The site stays fully readable to anyone.

---

## Frontend shape

### `auth/` directory ([apps/web/src/auth/](../../../apps/web/src/auth/))

- `use-viewer.ts` — `useViewer` (React Query against `GET /auth/viewer`, 30 s stale, retry off), `useIsOwner`, `useLogout`, and the shared `viewerQueryKey`. Every fetch here carries `credentials: "include"`; in dev the api is a different origin, so without it the cookie is simply never sent and the api sees an anonymous request.
- `login-button.tsx` — an `<a href>` (not a click handler) to `/auth/github/login?next=<path>`, built on `API_PUBLIC_URL` because it is rendered into markup rather than fetched.
- `logout-button.tsx`, `owner-badge.tsx`, `login-page.tsx`, `login-search.ts`.

`useIsOwner()` is closed-by-default: pending and failed both read `false`, so a slow or unreachable api never briefly unlocks a control.

### Route changes

- `/login` — "Log in with GitHub" plus a one-line explanation, `noindex`, not in the nav. Renders a "signed in as @… / log out" state instead when a session already exists, so the bookmark is not a dead end.
- Its **only** inbound link in the app is an "Owner-only — sign in" line under the locked status controls, rendered only when `isOwner` is false. Deliberately scoped there rather than global: `/status` is the one page with gated controls, so it is the one page where a visitor is asking the question.
- The nav's right-hand cluster carries `<OwnerBadge />`, not `__root.tsx`. It renders nothing at all for anonymous visitors — an always-visible "Log in" on a single-owner site is an invitation to try.

### Gated UI pattern

All four write controls on [status-page.tsx](../../../apps/web/src/status/status-page.tsx) — Sync now, Pause/Resume, and the per-account sync icon — render **disabled with a Radix tooltip** rather than hidden, via a local `OwnerAction` shell. Tooltip copy: *"Owner-only — sign in to enable."* with a `Lock` icon standing in for the usual glyph.

The `<span>` wrapping the trigger is load-bearing: a disabled button swallows pointer events, so without it Radix never sees the hover and the tooltip explaining *why* the control is dead is the one thing you cannot read.

### Mutation 401 handling

`post()` in [use-status.ts](../../../apps/web/src/status/use-status.ts) rewrites a 401 into `HttpError(401, "Session expired — sign in again")`, and each mutation's `onError` invalidates the viewer query so the controls re-lock themselves. Only reachable when a session dies between page load and click — everyone else's buttons are disabled. No redirect, and no toast of its own: the message rides the error, which the router's `MutationCache.onError` already surfaces.

---

## Forward-looking gated surfaces

Things that don't exist yet but will plausibly want the same guard. Cataloguing here so the auth layer is sized for what's coming, not just today's three buttons.

- **Manual Steam refresh** — once the wishlist poller lands, an "Refresh now" trigger paralleling `triggerSync` for Steam.
- **Per-integration enable/disable toggles** — flip LoL / Steam / TFT polling off without redeploy. Useful during Riot key rotation or Steam profile-visibility lapses.
- **Draft / preview surfaces** — render an unpublished `ConclusionCard` against live data without exposing it to visitors. Owner-only `?preview=true` toggle.
- **Secret-rotation indicators** — surface "Riot key expires in N days" on the status page; owner sees the countdown, public visitors don't. (Read-only but sensitive — the *value* is what's gated, not an action.)
- **Manual cache invalidation** — drop a specific cache key after debugging.
- **Live-config edits — accounts roster** is now its own arc, planned 2026-06-06 in [accounts-admin.md](accounts-admin.md). Its dependency on `OwnerGuard` is satisfied as of 2026-08-13. Polling-interval toggles and per-integration enable/disable stay catalogued under this list.

The pattern is the same in every case, and both halves now exist to copy: a route decorated with `@UseGuards(OwnerGuard)` in a module that imports `AuthModule`, plus a control wrapped in `OwnerAction` reading `useIsOwner()`. Add the route to `GUARDED_ROUTES` in `conventions.spec.ts` in the same change.

---

## Hosting-dependent details

Current hosting lean (owner, 2026-05-14) is **option C — Hetzner VPS + Nginx** in [hosting.md](hosting.md), not committed. That happens to be the simplest auth case: web and API behind one Nginx, same-origin cookies, no `SameSite=None` / credentialed-CORS dance. The A/B variants below stay documented in case the lean shifts.

Cookie scope depends on which hosting option (A/B/C in [hosting.md](hosting.md)) ships. None of these are blockers — the auth code is identical; only env values and the cookie `domain` change.

- **Option A (Vercel + Railway).** Web on `vyoh.gg`, API on `*.railway.app` or `api.vyoh.gg`.
  - If API stays on the Railway domain → different sites, cookie needs `SameSite=None; Secure` and every fetch needs `credentials: "include"`. CORS must echo the exact origin with `Access-Control-Allow-Credentials: true` — current wildcard regex in [main.ts](apps/api/src/main.ts) does *not* qualify for credentialed requests.
  - If API moves to `api.vyoh.gg` (same registrable domain as `vyoh.gg`) → cookie with `Domain=.vyoh.gg; SameSite=Lax` works trivially. **Recommended path for option A.**
- **Option B (Fly).** One container can serve both web and API or sit behind one Caddy. Same-origin → `SameSite=Lax; Domain` unset. Simplest.
- **Option C (VPS + Nginx).** Same as B — Nginx reverse-proxies both paths under one host. Trivial.

OAuth app callback URL must be set per-environment. Localhost callback is `http://localhost:2010/auth/github/callback`; prod is whatever the API host becomes. A GitHub OAuth app accepts up to 10 redirect URIs, so one registration *could* carry both — but the client secret is shared across all of them, which means a leak from a dev machine is a prod credential. Register **two separate OAuth apps**. (The dev app was created 2026-08-12; prod's is a chunk 3 item.)

---

## Security posture (and what's *not* in scope)

- **CSRF.** `SameSite=Lax` cookies + state-changing actions limited to `POST` (not GET) is enough for this threat model. Adding a CSRF token would be defense-in-depth, deliberately deferred. Worth flagging in the case-study write-up.
- **OAuth state parameter.** Mandatory — short-lived HMAC-signed token in a state cookie, validated on callback. Prevents login-CSRF.
- **Open redirects.** The `?next=` param on `/auth/github/login` must be validated against a relative-path whitelist before being honoured. Default to `/status`.
- **Token storage.** GitHub access tokens are never persisted. After the callback exchange we read the user's GitHub ID, then discard the token.
- **Rate limiting.** GitHub's own OAuth endpoints rate-limit. We don't expose enough surface for app-side rate limiting to be worthwhile at this scale.
- **Audit log.** Out of scope. A single owner doesn't audit themselves.
- **Multiple owners / role-based access.** Out of scope. If a second identity ever becomes a real need, this design extends to a small `User` table — but right now, hardcoded ID is exactly enough and reads more honestly than a single-row table pretending to be multi-tenant.
- **Account takeover via stale GitHub session.** Real but unmitigatable from our side. The owner's GitHub 2FA is the actual barrier.

---

## Chunk plan

Each chunk is independently committable and fits a single session window. Wait for chunk N to land before starting chunk N+1.

### ~~Chunk 1 — Backend auth flow, not yet applied~~ — shipped 2026-08-13

Landed as planned: `Session` migration, `AuthModule` with all four routes, `OwnerGuard` built and applied to nothing, `Viewer` in `packages/shared/src/auth/`, and specs across `auth.service` / `auth.controller` / `owner.guard` / `oauth-state` / `cookies` / `auth.config` (71 tests).

Five things the implementation decided that the plan above left open:

1. **`GET /auth/viewer` answers 200 for everyone**, returning `{ isOwner: false }` rather than 401 or a null body. Being logged out is this endpoint's normal case; a 401 would make React Query treat every anonymous page view as a failed request, which is exactly the retry-storm the plan's "retry off" line was working around. `Viewer` is a discriminated union, so `login` is unreachable until `isOwner` has been checked.
2. **The callback redirects to an absolute `webOrigin`**, resolved by `resolveWebOrigin()` from the first `WEB_ORIGIN` entry, falling back to `http://localhost:2009`. A relative `Location: /status` looks right and is wrong in dev — the api is on :2010, so the browser would land on the api's own status endpoint. Prod is same-origin behind nginx and the value is the site itself.
3. **`SESSION_COOKIE_DOMAIN` is deliberately not in `requireEnv`.** Empty is its correct dev value and `requireEnv` treats empty as missing, so requiring it would make the api refuse to boot in the only configuration dev has. The other four are required. Note the consequence: a fresh clone running `.env.example` verbatim fails at module init, because the `00000000` owner-id placeholder is rejected by `resolveAuthConfig` — deliberate, and the error names the var.
4. **`credentials: true` added to `enableCors`.** In dev the web tier is a different *origin* (port) though the same *site*, so without it the browser never sends the session cookie to `/auth/viewer`. Safe next to the existing allowlist — a credentialed request is only honoured against an echoed origin, never a wildcard.
5. **The sliding window is only written once it has drifted a day.** Extending on literally every guarded request would put a `Session` UPDATE on the hot path of every admin action for no behavioural gain.

No `cookie-parser` dependency: Express sets cookies natively, so only parsing was missing, and that is [cookies.ts](../../../apps/api/src/auth/cookies.ts).

**Verified live** (dev api + real OAuth app), beyond the unit tests: `/auth/viewer` 200 `{"isOwner":false}` with `Cache-Control: no-store`; `/auth/github/login` 302 to GitHub with a `HttpOnly; SameSite=Lax` state cookie whose nonce matches the signed state; callback with no state cookie / a wrong nonce → `?error=state`; callback with a real GitHub exchange on a bad code → `?error=github`; and seeded `Session` rows resolving through real Prisma — live → owner, sliding-expired → reaped, absolute-expired → reaped, foreign github id → refused and *not* reaped, logout → 204 and row deleted.

**Gotcha this probe re-surfaced.** Seeding `Session` rows with node-pg `Date` objects makes every expiry test pass falsely: the columns are `timestamp without time zone`, node-pg serialises a `Date` in the container's local zone (Europe/Brussels) and Prisma reads naive columns back as UTC, so the rows land two hours in the future. Seed with `.toISOString()`. The app never mixes the two — it writes and reads through Prisma — so this is a probe hazard, not a defect.

**Closed 2026-08-13** by the owner walking the real authorize screen: landed back on `/status`, `vyoh_session` set, and the persisted row carried the real numeric id, a 64-char hex hash rather than the token, and both TTLs at exactly 30 and 90 days.

### ~~Chunk 2 — Gate the status routes and wire the frontend~~ — shipped 2026-08-13

`@UseGuards(OwnerGuard)` on all four mutating routes, the `apps/web/src/auth/` directory, `/login`, the locked status controls, the nav affordance, and 401 handling. The api's entire mutating surface is now four routes and every one of them is gated.

Four things the implementation decided that the plan above left open:

1. **The viewer query is client-only, and must stay that way.** It is deliberately not primed from a route loader the way `meQueryOptions` is. A loader runs on the server, where `API_URL` is the internal origin and the visitor's cookie is out of scope, so a prefetch resolves to `{ isOwner: false }` and dehydrates *that* into the client cache as authoritative for 30 s — the owner would watch their own controls sit locked after a hard refresh. The cost of leaving it client-only is one request and one flip; the server render and the first client render both see "pending", so they agree.
2. **The lock lives on the guard, not on the toast.** `post()` rewrites a 401 into `HttpError(401, "Session expired — sign in again")` and the mutation hooks invalidate the viewer query on it. No new toast and no redirect: the router's `MutationCache.onError` already surfaces every mutation error, so the copy rides the error rather than adding a fourth code path.
3. **The affordance went into the nav's right-hand cluster, not a floating corner.** Leftmost of the cluster so the ⌘K chip keeps the corner position muscle memory expects. It appears after hydration, and nothing reserves space for it — it only ever renders for one person, so a shift on their visits beats a permanent gap on everyone else's.
4. **`routeMeta` grew a `noindex` flag** for `/login`. `robots.txt` can only ask a crawler not to *fetch* a URL; a page nobody fetched can still be indexed from inbound links, with no snippet, because the crawler was never allowed to read the rule saying not to. The sitemap is a hand-maintained allowlist, so it needed no change.

`?error=` and `?next=` are both narrowed in `validateSearch` — the first to the three literals the callback emits (it is rendered as page copy), the second through a mirror of the api's `safeNextPath` (it ends up in the login button's href, and `/login?next=https://evil.example` is a link anyone can send).

A structural lint in [conventions.spec.ts](../../../apps/api/src/conventions.spec.ts) now pins `@UseGuards(OwnerGuard)` to each of the four routes by name, with fixtures asserting a guard on a *neighbouring* route doesn't count. Per-route guards are the right shape on a public-by-design site, but nothing otherwise stops a decorator from being dropped in a refactor, and the failure is silent — the route just works, for everyone.

**Verified live** against the dev pair: `GET /status` still 200 for anyone; all four writes 401 without a cookie; all four 200/201 with a seeded owner session, restoring `sync.enabled` to what it found. `Access-Control-Allow-Origin` echoes the exact origin with `Allow-Credentials: true` on both the 200 and the 401 — without the latter the browser reports a network error instead of a readable 401. `/login` server-renders with exactly one `robots` meta (`noindex, nofollow`, overriding the root's `index, follow`) and a login href carrying the validated `next`.

### Chunk 3 — Polish, prod wiring, case study

- Prod GitHub OAuth app + env vars set on the chosen hosting target.
- Cookie `domain` configured per the hosting-dependent section above.
- README section documenting the env vars and the "log in to use admin controls" flow.
- Optional: candidate entry in [case-study-topics.md](../cross-cutting/case-study-topics.md) — *"Single-owner auth without a framework"* is genuinely a good write-up topic (the CSRF / SameSite / state-cookie reasoning is the substance).

Files touched: docs only + env config on hosting platform. Lands once a hosting option is chosen.

---

## Open questions for owner

1. ~~**Naming.**~~ **Resolved 2026-08-13: option 1.** `Viewer` is visitor identity, `Me` stays content identity. Built that way; no renames landed in `@vyoh/shared`, `IdentityService`, or `useMe`.
2. ~~**Sliding vs absolute session expiry.**~~ **Resolved 2026-08-05: both.** Sliding 30-day for convenience, with a hard 90-day `absoluteExpiresAt` that activity never extends — see the Prisma model above. Sliding-only was the quiet problem: a session touched once a month never expires, so one successful login grants indefinite access. Purely absolute re-auth would be more conservative still, but weekly re-auth to press a sync button is friction with no matching threat at this scale. Reopen only if the guarded surface grows past owner-only admin actions.
3. ~~**Should the `/login` route be linked from public nav?**~~ **Resolved 2026-08-14: not from the nav, but linked from the status page.** It shipped fully unlinked first and that was wrong: a visitor met eleven padlocks with nothing anywhere saying what would unlock them. Hiding the link also bought nothing — the OAuth app accepts one GitHub user id, so a stranger who finds `/login` is bounced to `?error=forbidden` regardless. The nav was still the wrong home for it (auth chrome on `/`, `/lol` and `/steam`, none of which gate anything), so the link lives beside the locked controls instead, where the question it answers is the one the padlocks just raised. Still `noindex`, still absent for signed-in viewers.
