# Accounts — move from JSON config to DB-backed admin surface

**Status:** Active — pre-deploy work, planned 2026-06-06, not started. Pairs with [owner-auth.md](owner-auth.md) (its chunk 1 is a prerequisite — `OwnerGuard` ships dormant there, this arc applies it). Replaces the "Live-config edits" forward-looking item catalogued in [owner-auth.md § Forward-looking gated surfaces](owner-auth.md).

Today the tracked-accounts roster lives in [apps/api/accounts.json](../../../apps/api/accounts.json) — read at boot in [identity.module.ts:11-14](../../../apps/api/src/identity/identity.module.ts#L11-L14), held in memory by [identity.service.ts](../../../apps/api/src/identity/identity.service.ts), hot-reloaded via `fs.watch`. The file ships committed to git, so every roster change (add a Steam friend's library, flip an `isOwner` flag, retire a test account) is a deploy. Once hosting lands this stops being a non-issue and becomes a real friction. The arc swaps the JSON for two Prisma tables, adds an `OwnerGuard`-protected admin section on the status page, and keeps every existing synchronous `IdentityService` call site unchanged.

Sibling docs: [owner-auth.md](owner-auth.md) (prerequisite), [hosting.md](hosting.md) (the deploy friction this removes is hosting-coupled), [security.md](security.md) (CodeQL was deferred against the auth surface; this lands one more mutating endpoint group under it).

---

## Decisions up front

- **Sequencing: ships *after* owner-auth chunk 1.** That chunk introduces `AuthModule` + `OwnerGuard` *dormant* (not applied to any controller). This arc then has a guard ready to use the same day its admin endpoints land — no temporary `// TODO: gate` window.
- **DB is the source of truth; `accounts.json` is deleted** in the cutover commit, not kept as a fallback. Two sources drift; the seed migration carries the existing roster over once.
- **`IdentityService` read path stays synchronous.** ~22 services + 4 scripts call `getLolAccounts()`, `findBySlug`, `isLolAccountAllowed`, `getSteamIds` synchronously. The cache is repopulated from DB on `onModuleInit` and invalidated on writes; the `fs.watch` block is deleted.
- **Admin surface lives on the status page**, gated by the same `OwnerGuard`. Owner-auth chunk 2 will disable-with-tooltip the existing Sync/Pause/Resume buttons for non-owner visitors; the accounts table follows the same pattern.
- **No slug renames in v1.** Slugs appear in URLs (`/lol/$accountSlug/...`); rename without redirect handling breaks bookmarks. Park as a follow-up.
- **Riot ID validated on add** by calling account-v1 server-side before persisting — catches typos that would silently produce empty `/lol/$accountSlug` pages. Steam IDs validated by length/digit shape only.

---

## Naming

`IdentityService` keeps its name — it already plays the role this arc extends (the existing service literally caches and serves the roster). The new admin module is `AdminAccountsModule`, not a second identity layer. New endpoints live under `/admin/lol-accounts` and `/admin/steam-accounts`.

`Me` (public content identity, `GET /me`) stays unchanged. `Viewer` (visitor identity from owner-auth) also stays distinct. Three well-named symbols, no overlap.

---

## Backend shape

### New Prisma models

```prisma
model LolAccount {
  slug       String   @id
  gameName   String
  tagLine    String
  region     String
  isOwner    Boolean  @default(false)
  isPrimary  Boolean  @default(false)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  @@unique([gameName, tagLine, region])
}

model SteamAccount {
  steamId64  String   @id
  isOwner    Boolean  @default(true)
  createdAt  DateTime @default(now())
}
```

Notes:
- `slug` is the primary key — it's the URL handle and must be unique; PKing on it also lets `IdentityService.findBySlug` and `isLolAccountAllowed` stay cheap.
- `@@unique([gameName, tagLine, region])` guards against the same Riot ID being registered under two slugs (which would split match history across two pages).
- `SteamAccount.isOwner` defaults `true` to mirror the current JSON's implicit assumption (every entry is "the owner's"). Anticipates a future "track a friend's library" use case without changing the shape later.

### `IdentityService` changes

- Constructor drops the `ACCOUNTS_CONFIG` provider. Replaces it with a `cache: { lol: LolAccount[]; steam: SteamAccount[] }` populated by an async `reload()` method.
- `onModuleInit` → `await this.reload()`.
- `onModuleDestroy` + `fs.watch` block + `assertUniqueSlugs` boot check deleted (uniqueness moves to the DB constraint + write-side check).
- `assertAccountOwnerInvariants` (multi-primary, primary-without-owner, owner-without-primary) **moves to the write side** — the admin controller calls it against the proposed post-write state and 400s on violation. Invariants stay; only the enforcement point shifts.
- `IdentityModule` factory swaps from `JSON.parse(readFileSync)` to providing the service directly — no `useFactory`.

Every existing call site (`getLolAccounts`, `getOwnerPuuids`, `getLolAccountsWithSummary`, `findBySlug`, `isLolAccountAllowed`, `getSteamIds`) keeps its current signature.

### New `AdminAccountsModule` (apps/api/src/admin/)

All routes carry `@UseGuards(OwnerGuard)`:

- `POST /admin/lol-accounts` — body `{ slug, gameName, tagLine, region, isOwner, isPrimary }`. Validates Riot ID via account-v1, asserts post-write invariants, inserts, calls `identity.reload()`. Returns the new row.
- `PATCH /admin/lol-accounts/:slug` — body subset of `{ isOwner, isPrimary }`. Slug, Riot ID tuple, and region are immutable in v1. Asserts invariants over proposed state, updates, reloads.
- `DELETE /admin/lol-accounts/:slug` — refuses to delete the last primary (invariant), refuses if any Summoner/Match rows still reference it without a confirmation flag (a `?force=true` query param), deletes, reloads. Match data itself is untouched.
- `POST /admin/steam-accounts` — body `{ steamId64, isOwner }`. Length/digit validation. Inserts, reloads.
- `DELETE /admin/steam-accounts/:steamId64` — deletes, reloads. Same Steam-data-untouched semantics.

`GET /me` stays public and unchanged.

### Bug fix bundled in — `home-first-played` uses the wrong filter

[home-first-played.service.ts:189](../../../apps/api/src/home/home-first-played.service.ts#L189) calls `getLolAccounts()` (all configured accounts) when computing which puuids may compete for the conclusion's "first played" slot. Every other `home-*` service correctly uses `getOwnerPuuids()` — see [home-chronotype.service.ts:60](../../../apps/api/src/home/home-chronotype.service.ts#L60) as the rationale anchor. Result today: a non-owner account in the JSON whose first match predates the owner's wins the slot and gets promoted into the `/` conclusion tile.

The fix is one line (`getLolAccounts()` → `getOwnerPuuids()`) plus a comment swap to cite `HomeChronotypeService` like the rest. Same-commit test adds a non-owner account whose first match predates the owner's and asserts the owner's match wins.

Lands as a **separate prerequisite commit (chunk 0)** before chunk 1 — independent of the DB migration, worth fixing now whether or not the arc proceeds, and avoids muddling the cutover diff.

---

## Frontend shape

### New `apps/web/src/admin/`

- `use-lol-accounts.ts`, `use-steam-accounts.ts` — React Query hooks reading the same in-memory snapshot as `/me`. On owner-mutation success, invalidate both `me` and the admin queries.
- `lol-accounts-table.tsx` — table with per-row delete + `isOwner`/`isPrimary` toggle, header "Add account" button opening a form dialog.
- `steam-accounts-table.tsx` — table with delete and add-form dialog.
- `add-lol-account-dialog.tsx`, `add-steam-account-dialog.tsx` — Radix Dialog + react-hook-form, surfacing the Riot/Steam-side validation errors inline.

### Status page integration

Add a new **"Tracked accounts"** `SectionTitle` zone in [status-page.tsx](../../../apps/web/src/status/status-page.tsx), placed below the existing Sync/Pause/Resume block. Two cards side-by-side at md+ (LoL, Steam), stacked on mobile.

The owner-auth disable-with-tooltip pattern from owner-auth chunk 2 applies here: when `viewer.isOwner === false`, the tables render read-only (no toggle, no delete, no add button) with a single `TooltipPrimitive` lock icon in the header. Per the [`CardTitle` / `SectionTitle` convention](../repo-conventions.md#header-primitives-sectiontitle-vs-cardtitle--pick-by-chrome-not-by-content): each card carries its own chrome → use `CardTitle` for the per-card headers, `SectionTitle` for the zone divider above them.

### Tests in same commit

Per [feedback_test_alongside_code](#) — same-commit coverage is the standing bar:

- Backend: spec per admin endpoint (auth-gated, validation, invariant assertion, reload triggers).
- Frontend: axe scan + add/delete/toggle flows for at least the LoL table; Steam mirrors the same shape so one example is enough.

---

## What's *not* in this arc

- **Slug rename.** Requires redirect handling on the URL surface. Park as a follow-up — separate note if it becomes real.
- **Polling-interval / per-integration toggles.** Owner-auth catalogues these as forward-looking; they're a separate admin surface, not roster CRUD.
- **Bulk import / CSV.** YAGNI — the roster is single digits.
- **Audit log.** Single owner. Same call as owner-auth.
- **Multi-tenant / role split.** Out of scope of the whole `OwnerGuard` design; if a second identity ever becomes real, this design extends.

---

## Chunk plan

Each chunk is independently committable and fits a single session window.

### Chunk 0 — Fix `home-first-played` owner filter

- Swap `getLolAccounts()` → `getOwnerPuuids()` at [home-first-played.service.ts:189](../../../apps/api/src/home/home-first-played.service.ts#L189).
- Update the comment to cite `HomeChronotypeService` like the other home services.
- Same-commit spec: non-owner account with earlier first match must not win the slot.

Files: 1 modified service + 1 modified spec. Independently mergeable; doesn't depend on owner-auth or the DB swap. Could land tomorrow.

### Chunk 1 — Schema + cutover (no admin endpoints yet)

- Prisma migration: add `LolAccount` + `SteamAccount` tables.
- Seed migration: insert existing `accounts.json` rows on first apply.
- `IdentityService` swap: cache populated by `reload()` from DB, `fs.watch` block deleted, `IdentityModule` factory updated.
- Delete `apps/api/accounts.json` + `loadAccountsConfig` in the same commit.
- Add `assertAccountOwnerInvariants` call to an internal write-side hook ready for chunk 2 (no public mutation routes yet).
- Verify all existing identity specs still pass; add one new spec covering DB-backed reload semantics.

Files: 1 new migration, ~3 modified API files, 1 deleted JSON, ~1 new spec. No frontend changes. Public behavior unchanged — verify by running the existing test suite green.

**Prerequisite: owner-auth chunk 1.** If owner-auth hasn't started by the time this is ready to land, ship owner-auth chunk 1 first (it's a dormant capability — no UX change, just `OwnerGuard` available).

### Chunk 2 — Admin endpoints + status-page UI

- `AdminAccountsModule` with the five endpoints above, all `@UseGuards(OwnerGuard)`.
- Riot account-v1 validation in the LoL POST handler.
- `apps/web/src/admin/` directory: hooks + tables + dialogs.
- "Tracked accounts" zone on the status page, disable-with-tooltip when `viewer.isOwner === false`.
- Same-commit specs (backend per-endpoint + frontend table + axe).

Files: ~5 new backend + ~6 new frontend + ~1 modified status page + ~8 new specs. Single PR; the visible UX change is the new tables appearing on `/status`.

### Chunk 3 — Polish

- Refuse-delete-with-data confirmation flow on LoL accounts that still have Match rows (`?force=true` UX + toast).
- README section documenting the admin flow.
- Optional: case-study candidate in [case-study-topics.md](../cross-cutting/case-study-topics.md) — "Roster as data, not config" pairs naturally with the owner-auth write-up.

Files: docs + small UX polish. Lands once the pre-launch sweep is otherwise complete.

---

## Open questions for owner

1. **Sequencing.** Plan assumes A (owner-auth chunk 1 first, then this arc). The alternative is C — bundle both into one pre-launch sweep. C is reviewable but heavy. Confirm A or override.
2. **`SteamAccount.isOwner` default.** Plan assumes `true` to mirror today's implicit JSON semantics. Confirm.
3. **Chunk 0 timing.** Stand the `home-first-played` fix up as an immediate standalone commit, or hold it until chunk 1 lands so the diff stays bundled? Plan assumes immediate.
4. **Riot ID validation on add — strict?** Plan assumes hard-fail on account-v1 404 / Riot 5xx, with a retry hint in the error toast. The alternative is soft-warn-and-store (some Riot IDs are unstable across renames). Strict is safer and matches the rest of the API's posture.
