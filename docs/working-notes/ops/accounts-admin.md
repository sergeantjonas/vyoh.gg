# Accounts — move from JSON config to DB-backed admin surface

**Status:** Active — chunk 0 shipped 2026-06-09 (`1f33d7fc`), chunk 1 shipped 2026-08-14; chunks 2–3 not started. Owner-auth shipped in full 2026-08-13, so the prerequisite is closed and chunk 2 can start whenever. Pairs with [owner-auth.md](owner-auth.md) (`OwnerGuard` ships there, this arc applies it to the admin endpoints). Replaces the "Live-config edits" forward-looking item catalogued in [owner-auth.md § Forward-looking gated surfaces](owner-auth.md).

The tracked-accounts roster lives in the `LolAccount` + `SteamAccount` tables, read at boot into [identity.service.ts](../../../apps/api/src/identity/identity.service.ts)'s cache by `reload()`. Until 2026-08-14 it was a committed `apps/api/accounts.json` hot-reloaded via `fs.watch`, which made every roster change (add a Steam friend's library, flip an `isOwner` flag, retire a test account) a deploy. The remaining arc adds an `OwnerGuard`-protected admin section on the status page; every existing synchronous `IdentityService` call site is unchanged.

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

### `IdentityService` changes — shipped 2026-08-14

- Constructor takes only `PrismaService`; the `ACCOUNTS_CONFIG` provider and `loadAccountsConfig` are gone. The cache is `{ lol: LolAccount[]; steam: string[] }`, populated by an async `reload()` and empty until it first resolves.
- `onModuleInit` → `await this.reload()`. `onModuleDestroy` + the `fs.watch` block are deleted, and `IdentityModule` provides the service directly with no `useFactory`.
- `reload()` reads both tables ordered by `createdAt` and projects field-by-field, so the roster keeps a stable order and `createdAt`/`updatedAt` never reach the `/me` payload.
- `assertAccountOwnerInvariants` **moved to the write side**, wrapped by `assertRosterInvariants(next)` — chunk 2's admin controller calls it against the proposed post-write roster and 400s on violation.
- Two deviations from the plan above, both deliberate. `assertUniqueSlugs` was **kept**, moved into `assertRosterInvariants` rather than deleted: the `slug` primary key is case-sensitive and `findBySlug` is not, so `Ahri` and `ahri` are two legal rows resolving to whichever the roster lists first — a gap the DB constraint cannot close. And `reload()` runs the invariants over what it loaded and **logs a warning** on breach instead of throwing; a hand-edited row otherwise surfaces only as a silently empty recap, but refusing to boot over one bad flag would take the whole API down.

Every existing call site (`getLolAccounts`, `getOwnerPuuids`, `getLolAccountsWithSummary`, `findBySlug`, `isLolAccountAllowed`, `getSteamIds`) kept its signature.

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

The owner-auth disable-with-tooltip pattern from owner-auth chunk 2 applies here: when `viewer.isOwner === false`, the tables render read-only (no toggle, no delete, no add button) with a single `TooltipPrimitive` lock icon in the header. Per the [`CardTitle` / `SectionTitle` convention](../repo-conventions-web.md#header-primitives-sectiontitle-vs-cardtitle--pick-by-chrome-not-by-content): each card carries its own chrome → use `CardTitle` for the per-card headers, `SectionTitle` for the zone divider above them.

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

### Chunk 0 — Fix `home-first-played` owner filter — ✅ shipped 2026-06-09 (`1f33d7fc`)

Landed three days after this plan was written, without this note being updated; closed 2026-08-01. The match query is scoped via `getOwnerPuuids()` at [home-first-played.service.ts:192](../../../apps/api/src/home/home-first-played.service.ts#L192) with the owner-only rationale in a comment. The class spec mocks `getOwnerPuuids`; a where-clause regression pin (non-owner puuids cannot re-enter the query) was added 2026-08-01.

### Chunk 1 — Schema + cutover (no admin endpoints yet) — ✅ shipped 2026-08-14

Migration `20260813230117_accounts_roster_tables` creates both tables and seeds the nine roster rows the JSON carried, with `createdAt` staggered one second apart in config order so the read's `ORDER BY createdAt` reproduces the order `/me` always had. `apps/api/accounts.json`, `loadAccountsConfig`, and the `COPY` that put the JSON in the api image are all deleted.

The identity spec was reworked against a Prisma stub instead of a temp-dir `accounts.json`: the three `fs.watch` lifecycle tests are gone, and reload semantics are covered instead — cache empty until the first reload, `orderBy` pinned, bookkeeping columns dropped, a second reload replacing rather than appending, and a breached invariant warning without failing boot. `assertRosterInvariants` has its own describe block. Net +3 tests on the api (1528 → 1531); shared and web untouched.

Public behaviour is unchanged with one cosmetic exception: `/me` now spells `"isOwner": false` / `"isPrimary": false` on accounts that previously omitted the keys, because the columns are `NOT NULL DEFAULT false`. Every consumer tests `=== true`, so nothing reads differently. Verified live against the dev server after the cutover: all nine accounts, original order, homoglyph Riot IDs (`Νine Tailed Fox`, `TIFΑ`) intact, every summary still resolving.

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

## Resolved decisions (2026-06-06)

1. **Sequencing: A.** Owner-auth chunk 1 lands first (ships `OwnerGuard` dormant), then this arc's chunks 1–3. No temporary-gate window.
2. **`SteamAccount.isOwner`: default `true`, no v1 UI affordance to flip it.** Owner has no immediate plan to track non-owner Steam libraries; the field is provisioned for shape-consistency with `LolAccount` so a future Steam-friend use case doesn't require a migration. Admin form may omit the field on the Steam add dialog; backend accepts it and defaults to `true` when missing.
3. **Chunk 0: immediate standalone commit.** The `home-first-played` filter fix ships independently of the rest of the arc — and did: `1f33d7fc`, 2026-06-09.
4. **Riot ID validation: strict.** Account-v1 404 hard-fails the POST with an inline error on the form. Riot 5xx surfaces a retry hint in the error toast; the row is not persisted. Matches the API's posture elsewhere.
