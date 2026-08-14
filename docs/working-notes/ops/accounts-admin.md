# Accounts — move from JSON config to DB-backed admin surface

**Status:** Active — chunk 0 shipped 2026-06-09 (`1f33d7fc`), chunk 1 shipped 2026-08-14 (`ac3907fa`), chunk 2a shipped 2026-08-14; **chunk 2b is next**, chunk 3 after it. Owner-auth shipped in full 2026-08-13, so the prerequisite is closed. Chunk 2's scope was widened 2026-08-14 from delete-only to **hide / pause / delete** on two independent axes, and chunk 3 now carries the opt-in **purge**. Pairs with [owner-auth.md](owner-auth.md) (`OwnerGuard` ships there, this arc applies it to the admin endpoints). Replaces the "Live-config edits" forward-looking item catalogued in [owner-auth.md § Forward-looking gated surfaces](owner-auth.md).

The tracked-accounts roster lives in the `LolAccount` + `SteamAccount` tables, read at boot into [identity.service.ts](../../../apps/api/src/identity/identity.service.ts)'s cache by `reload()`. Until 2026-08-14 it was a committed `apps/api/accounts.json` hot-reloaded via `fs.watch`, which made every roster change (add a Steam friend's library, flip an `isOwner` flag, retire a test account) a deploy. The remaining arc adds an `OwnerGuard`-protected admin section on the status page. Every existing `IdentityService` read keeps its signature and its semantics; the one structural change is that the two sync-worklist call sites move off `getLolAccounts()` onto a new `getSyncableLolAccounts()` (see [the read-path table](#read-path-which-reads-filter-on-what)).

Sibling docs: [owner-auth.md](owner-auth.md) (prerequisite), [hosting.md](hosting.md) (the deploy friction this removes is hosting-coupled), [security.md](security.md) (CodeQL was deferred against the auth surface; this lands one more mutating endpoint group under it).

---

## Decisions up front

- **Sequencing: ships *after* owner-auth chunk 1.** That chunk introduces `AuthModule` + `OwnerGuard` *dormant* (not applied to any controller). This arc then has a guard ready to use the same day its admin endpoints land — no temporary `// TODO: gate` window.
- **DB is the source of truth; `accounts.json` is deleted** in the cutover commit, not kept as a fallback. Two sources drift; the seed migration carries the existing roster over once.
- **`IdentityService` read path stays synchronous.** ~22 services + 4 scripts call `getLolAccounts()`, `findBySlug`, `isLolAccountAllowed`, `getSteamIds` synchronously. The cache is repopulated from DB on `onModuleInit` and invalidated on writes; the `fs.watch` block is deleted.
- **Admin surface lives on the status page**, gated by the same `OwnerGuard`. Owner-auth chunk 2 will disable-with-tooltip the existing Sync/Pause/Resume buttons for non-owner visitors; the accounts table follows the same pattern.
- **No slug renames in v1.** Slugs appear in URLs (`/lol/$accountSlug/...`); rename without redirect handling breaks bookmarks. Park as a follow-up.
- **Riot ID validated on add** by calling account-v1 server-side before persisting — catches typos that would silently produce empty `/lol/$accountSlug` pages. Steam IDs validated by length/digit shape only.
- **Visibility and sync are two independent axes, not one lifecycle** (decided 2026-08-14). `hiddenAt` controls whether an account is *advertised*; `syncPausedAt` controls whether it is *fetched*. The current roster already occupies one corner that a single enum can't express — the five non-owner accounts are things the owner wants syncing but arguably not fronted in the nav — and a temporarily-tracked friend's account wants the opposite corner: still browsable, no longer polled. Two nullable timestamps, four legal states, no ordering between them.
- **Delete shrinks to typo cleanup.** Once hide and pause exist, the only honest reason to remove a roster row is that it should never have been added. That matters because **the roster row is the only handle on the data**: there is no foreign key from `LolAccount` to `Summoner`/`Match`, so the `gameName + tagLine + region` tuple on the row is the sole thing that can name an account's history. Delete-to-hide would leave 1,961 Agurin matches unreachable by any admin surface or future purge.
- **Purge is opt-in, separate, and gated on a verified restore** (decided 2026-08-14). It is the one irreversible action in the arc — hide, pause, and roster-row delete are all recoverable — so it gets its own endpoint rather than a flag on `DELETE`, and it lands in chunk 3 under the standing backup rule in [pre-launch-sweep.md](pre-launch-sweep.md).

---

## Naming

`IdentityService` keeps its name — it already plays the role this arc extends (the existing service literally caches and serves the roster). The new admin module is `AdminAccountsModule`, not a second identity layer. New endpoints live under `/admin/lol-accounts` and `/admin/steam-accounts`.

`Me` (public content identity, `GET /me`) stays unchanged. `Viewer` (visitor identity from owner-auth) also stays distinct. Three well-named symbols, no overlap.

---

## Backend shape

### Prisma models — shipped 2026-08-14

Shipped as sketched here, plus a `createdAt`-as-display-order contract the sketch didn't anticipate (see chunk 1):

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

### Visibility + pause columns — shipped 2026-08-14 (chunk 2a)

```prisma
model LolAccount {
  // …roster columns…
  hiddenAt     DateTime?
  syncPausedAt DateTime?
}
```

Timestamps rather than booleans, because "hidden since when" is the question actually asked when reviewing a roster months later, and a nullable timestamp answers both it and the boolean for free. No `hiddenBy`/`pausedBy` — single owner, same call as the audit-log decision below.

`SteamAccount` gets neither. A single Steam library is either tracked or it isn't, and there is no Steam equivalent of a "browse a friend's history" surface to keep alive; add them when a second Steam row exists.

### Read path: which reads filter on what

This is the load-bearing table for chunk 2. Both columns are **opt-in per read** — the default is to ignore them, and only three call sites change.

| Read | `hiddenAt` | `syncPausedAt` | Why |
|---|---|---|---|
| `getSyncableLolAccounts()` *(new)* | ignores | **excludes** | The only new method, and **two** call sites — the match-sync cron ([match-sync.service.ts:104](../../../apps/api/src/lol/match-sync.service.ts#L104)) and the live-game poller's account loop ([live-game-poller.service.ts:85](../../../apps/api/src/lol/live-game-poller.service.ts#L85)). Between them that is every place new LoL data enters, which is exactly what pause promises to stop. |
| `getLolAccounts()` | ignores | ignores | Stays the unfiltered roster. The reverse puuid→slug lookup at [home-first-played.service.ts:244](../../../apps/api/src/home/home-first-played.service.ts#L244), the four backfill scripts, and the live-game participant labelling at [live-game-poller.service.ts:180](../../../apps/api/src/lol/live-game-poller.service.ts#L180) all iterate it. The labelling site was mis-classified as a sync worklist when this table was first written: it decides which *participants of an in-progress game* are tracked accounts, reads only the local DB, and fetches nothing — so a paused account in the same lobby should still be labelled. Filtering any of these would make work skip accounts silently, the failure mode hardest to notice. |
| `isLolAccountAllowed()` | ignores | ignores | Gates 24 read endpoints across `lol.service`, `lol-analytics.service`, and `lol-champion-analytics.service`. Filtering here would 403 a hidden *or* paused account's own pages — the opposite of the point, which is that the data stays browsable. |
| `findBySlug()` | ignores | ignores | Resolves URLs and OG images. A bookmark to a hidden account must keep working; hiding removes the link, not the page. |
| `getLolAccountsWithSummary()` → `/me` | **flags, never drops** | ignores | Verified 2026-08-14: [use-account-from-slug.ts](../../../apps/web/src/lol/_shared/account/use-account-from-slug.ts) resolves the *page's own* account object out of the `/me` payload, so omitting hidden rows breaks every `/lol/<hidden-slug>/*` route while the API happily serves the data behind it. Ship `hidden: boolean` on the payload and let [nav.tsx](../../../apps/web/src/components/nav.tsx) filter. Pause stays out of `/me` — it's an ops state, not public content. |
| `getOwnerPuuids()` | ignores | ignores | Decided: hiding is presentation, authorship is `isOwner`. A nav toggle must not silently rewrite `/`'s lifetime totals; if an account should leave the self-portrait, clear `isOwner`. |
| `resolveOwnerPuuids()` *(private, [lol.service.ts:1097](../../../apps/api/src/lol/lol.service.ts#L1097))* | ignores | ignores | Misleadingly named — it resolves *every* roster account, and deliberately so: it feeds `projectMatchForStorage`'s keep-full-fields set, so filtering it would strip a tracked account's own damage/heal fields out of newly cached match details. Leave it alone. |

The `hidden: boolean` addition means `LolAccount` in `@vyoh/shared` grows a field, so it stays the projected-field-by-field shape chunk 1 established — the timestamps themselves never leave the api.

### Purge — full data removal, opt-in (chunk 3)

`POST /admin/lol-accounts/:slug/purge` removes the roster row **and** everything the account's history occupies. Separate route from `DELETE`, not a `?purge=true` flag: two risk classes deserve two endpoints, and a distinct path is harder to reach by accident than a query param appended while debugging.

There are exactly three `puuid`-bearing tables (`Summoner`, `RankSnapshot`, `Match`) and no slug-keyed cache, so the operation is bounded. Order is forced by the schema — `Match.summoner` ([schema.prisma:587](../../../apps/api/prisma/schema.prisma#L587)) and `RankSnapshot.summoner` ([:79](../../../apps/api/prisma/schema.prisma#L79)) are required relations with no `onDelete`, so Prisma's default `Restrict` blocks deleting the `Summoner` first:

1. Resolve the target `puuid` through the `gameName + tagLine + region` → `Summoner` join. There is no FK from `LolAccount`, so this join *is* the handle — which is why the roster row has to outlive the decision to purge.
2. `DELETE FROM "Match" WHERE puuid = $1`
3. `DELETE FROM "RankSnapshot" WHERE puuid = $1`
4. `DELETE FROM "Summoner" WHERE puuid = $1`
5. Orphan sweep: `DELETE FROM "MatchDetailCache" WHERE "matchId" NOT IN (SELECT "matchId" FROM "Match")`, same for `MatchTimelineCache`.
6. `DELETE FROM "LolAccount" WHERE slug = $1`, then `identity.reload()`.

Steps 2–6 run in one transaction.

**Step 5 is why this is safe.** Both cache tables are keyed on `matchId` alone, so in principle they are shared across roster accounts that played the same game. Framing the eviction as an orphan sweep *after* step 2 makes that a non-issue with no special-casing: a match two roster accounts share keeps its cache row automatically, because the other account's `Match` row still references it. The same query also self-heals any cache rows orphaned by earlier deletes. Measured 2026-08-14: exactly **1** `matchId` in the whole DB is shared by 2+ roster accounts, so per-account purge is empirically almost perfectly clean — but the sweep is written to be correct rather than to rely on that.

**Preview before confirm.** `GET /admin/lol-accounts/:slug/purge-preview` returns the row counts and byte estimate the purge would free; the dialog calls it on open, and the POST requires the slug typed back. The numbers are what make the decision informed rather than nervous — measured baseline 2026-08-14:

| Table | Rows | Size |
|---|---|---|
| `Match` | 6,024 | 11 MB |
| `MatchDetailCache` | 6,017 | 57 MB |
| `MatchTimelineCache` | 1,714 | 257 MB |

Per-account `Match` rows, in roster order: ahri 565, vyoh 18, 9tails 0, miyeon 16, tifa 1,299, tifa2 419, tifa3 587, twix 1,153, agurin 1,961. The five non-owner accounts hold **5,419 of 6,024 rows — 90% of all match data**, and timelines average ~150 KB per row, so purging one large non-owner account frees tens of MB. That ratio is the argument for the feature existing at all.

Purge writes one structured log line (slug, resolved puuid, per-table counts). That is not a reversal of the no-audit-log decision below — it's the minimum needed to answer "what did I delete" after the fact, and a log line is not a table.

### `IdentityService` changes — shipped 2026-08-14

- Constructor takes only `PrismaService`; the `ACCOUNTS_CONFIG` provider and `loadAccountsConfig` are gone. The cache is `{ lol: LolAccount[]; steam: string[] }`, populated by an async `reload()` and empty until it first resolves.
- `onModuleInit` → `await this.reload()`. `onModuleDestroy` + the `fs.watch` block are deleted, and `IdentityModule` provides the service directly with no `useFactory`.
- `reload()` reads both tables ordered by `createdAt` and projects field-by-field, so the roster keeps a stable order and `createdAt`/`updatedAt` never reach the `/me` payload.
- `assertAccountOwnerInvariants` **moved to the write side**, wrapped by `assertRosterInvariants(next)` — chunk 2's admin controller calls it against the proposed post-write roster and 400s on violation.
- Two deviations from the plan above, both deliberate. `assertUniqueSlugs` was **kept**, moved into `assertRosterInvariants` rather than deleted: the `slug` primary key is case-sensitive and `findBySlug` is not, so `Ahri` and `ahri` are two legal rows resolving to whichever the roster lists first — a gap the DB constraint cannot close. And `reload()` runs the invariants over what it loaded and **logs a warning** on breach instead of throwing; a hand-edited row otherwise surfaces only as a silently empty recap, but refusing to boot over one bad flag would take the whole API down.

Every existing call site (`getLolAccounts`, `getOwnerPuuids`, `getLolAccountsWithSummary`, `findBySlug`, `isLolAccountAllowed`, `getSteamIds`) kept its signature.

### New `AdminAccountsModule` (apps/api/src/admin/)

All routes carry `@UseGuards(OwnerGuard)`:

- `GET /admin/lol-accounts` — the full roster including `hiddenAt`/`syncPausedAt`, which `/me` doesn't carry. The admin table reads this, not `/me`.
- `POST /admin/lol-accounts` — body `{ slug, gameName, tagLine, region, isOwner, isPrimary }`. Validates Riot ID via account-v1, asserts post-write invariants, inserts, calls `identity.reload()`. Returns the new row.
- `PATCH /admin/lol-accounts/:slug` — body subset of `{ isOwner, isPrimary, hidden, syncPaused }`. The two booleans set or clear their timestamp; the api owns the clock, so the client never sends one. Slug, Riot ID tuple, and region stay immutable in v1. Asserts invariants over proposed state, updates, reloads.
- `DELETE /admin/lol-accounts/:slug` — roster row only; history untouched. Refuses to delete the primary (invariant). When the account still has `Match` rows, the response tells the caller how many and points at hide/pause instead — the row is the only handle on that data, so removing it strands the history rather than cleaning it up. A `?force=true` param overrides for the typo case.
- `POST /admin/steam-accounts` — body `{ steamId64, isOwner }`. Length/digit validation. Inserts, reloads.
- `DELETE /admin/steam-accounts/:steamId64` — deletes, reloads. Same Steam-data-untouched semantics.

Chunk 3 adds two more:

- `GET /admin/lol-accounts/:slug/purge-preview` — per-table counts + byte estimate. Safe, idempotent, called on dialog open.
- `POST /admin/lol-accounts/:slug/purge` — body `{ confirm: "<slug>" }`. Runs the six steps above in a transaction, logs the counts, reloads.

`GET /me` stays public, and gains exactly one field: `hidden: boolean` per LoL account.

One addition to `assertRosterInvariants`, write-side like the ones chunk 1 established: **the primary account cannot be hidden.** `/`'s OG image and the nav's default `?as=` lens both key off the primary, so hiding it produces a roster whose front page is built around an account the nav can't reach. Lives in `@vyoh/shared` as `assertAccountVisibilityInvariants`, beside the owner/primary set.

"The last non-hidden owner account cannot be hidden" was planned as a second check and **dropped as provably redundant**: `assertAccountOwnerInvariants` already requires a primary whenever any owner exists and requires that primary to be an owner, so refusing to hide the primary means a fully-hidden owner set is unreachable. A test pins the composition rather than the dead branch, so removing either assert fails the suite.

Pausing carries no invariants — every account, primary included, is legitimately pausable.

### Bug fix bundled in — `home-first-played` uses the wrong filter

[home-first-played.service.ts:189](../../../apps/api/src/home/home-first-played.service.ts#L189) calls `getLolAccounts()` (all configured accounts) when computing which puuids may compete for the conclusion's "first played" slot. Every other `home-*` service correctly uses `getOwnerPuuids()` — see [home-chronotype.service.ts:60](../../../apps/api/src/home/home-chronotype.service.ts#L60) as the rationale anchor. Result today: a non-owner account in the JSON whose first match predates the owner's wins the slot and gets promoted into the `/` conclusion tile.

The fix is one line (`getLolAccounts()` → `getOwnerPuuids()`) plus a comment swap to cite `HomeChronotypeService` like the rest. Same-commit test adds a non-owner account whose first match predates the owner's and asserts the owner's match wins.

Lands as a **separate prerequisite commit (chunk 0)** before chunk 1 — independent of the DB migration, worth fixing now whether or not the arc proceeds, and avoids muddling the cutover diff.

---

## Frontend shape

### New `apps/web/src/admin/`

- `use-lol-accounts.ts`, `use-steam-accounts.ts` — React Query hooks against the `/admin/*` reads (not `/me` — the admin table needs the two timestamps `/me` withholds). On mutation success, invalidate both `me` and the admin queries, since hiding an account changes the nav.
- `lol-accounts-table.tsx` — per-row: `isOwner`/`isPrimary` toggles, **hide**, **pause**, delete. Header "Add account" button opening a form dialog.
- `steam-accounts-table.tsx` — table with delete and add-form dialog.
- `add-lol-account-dialog.tsx`, `add-steam-account-dialog.tsx` — Radix Dialog + react-hook-form, surfacing the Riot/Steam-side validation errors inline.
- `purge-account-dialog.tsx` *(chunk 3)* — preview counts on open, slug typed back to enable the button.

Hide and pause read as state, not as actions, so they're toggles with a visible resting state rather than buttons in a menu — a roster where three of nine rows are paused has to be legible at a glance, otherwise "why is this account stale" becomes a debugging session. Delete stays a destructive-styled action; purge (chunk 3) sits behind it in an overflow menu, since it should be reached deliberately.

### Status page integration

Add a new **"Tracked accounts"** `SectionTitle` zone in [status-page.tsx](../../../apps/web/src/status/status-page.tsx), placed below the existing Sync/Pause/Resume block. Two cards side-by-side at md+ (LoL, Steam), stacked on mobile.

The owner-auth disable-with-tooltip pattern from owner-auth chunk 2 applies here: when `viewer.isOwner === false`, the tables render read-only (no toggle, no delete, no add button) with a single `TooltipPrimitive` lock icon in the header. Per the [`CardTitle` / `SectionTitle` convention](../repo-conventions-web.md#header-primitives-sectiontitle-vs-cardtitle--pick-by-chrome-not-by-content): each card carries its own chrome → use `CardTitle` for the per-card headers, `SectionTitle` for the zone divider above them.

### Tests in same commit

Per [feedback_test_alongside_code](#) — same-commit coverage is the standing bar:

- Backend: spec per admin endpoint (auth-gated, validation, invariant assertion, reload triggers), plus one case per row of the read-path table above — that table is the test matrix, and a read that silently starts or stops honouring `hiddenAt` is the failure mode with no visible symptom.
- Frontend: axe scan + add/delete/hide/pause/toggle flows for at least the LoL table; Steam mirrors the same shape so one example is enough. One nav test pinning the pair that matters: a hidden account leaves the dropdown while `/lol/<slug>` still resolves.

---

## What's *not* in this arc

- **Slug rename.** Requires redirect handling on the URL surface. Park as a follow-up — separate note if it becomes real.
- **Polling-interval / per-integration toggles.** Owner-auth catalogues these as forward-looking; they're a separate admin surface, not roster CRUD.
- **Bulk import / CSV.** YAGNI — the roster is single digits.
- **Audit log.** Single owner. Same call as owner-auth. Purge logs one line; that isn't a log table.
- **Bulk / TTL cache eviction.** Purge here is per-account and owner-triggered. Size-pressure-driven eviction across the whole cache is a different trigger with a different failure mode and stays in [match-cache-storage.md](../lol/match-cache-storage.md). The orphan-sweep query in step 5 is the piece the two arcs share.
- **Steam `hiddenAt`/`syncPausedAt`.** One row, no browse surface to preserve. Add when a second Steam account exists.
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

### Chunk 2a — Visibility + pause columns and the reads that honour them — ✅ shipped 2026-08-14

Migration `20260814185752_account_visibility_and_sync_pause` adds both nullable timestamps. `reload()` carries `syncPausedAt` just long enough to partition the roster into `cache.lol` and a precomputed `cache.syncableLol`, then drops it — so the pause state cannot reach `/me` even by accident, while `hidden` is projected deliberately. `getSyncableLolAccounts()` backs the two fetch sites; [nav.tsx](../../../apps/web/src/components/nav.tsx) filters through the new `getVisibleAccounts()` from `@vyoh/shared`, which also fixes the default `?as=` lens for free (it reads the first *visible* account, so a hidden first row no longer aims Patches at an account the menu never offers).

Verified against the real database, not just the Prisma stub: with `tifa` hidden and `twix` paused, `tifa` stayed syncable and kept resolving through `findBySlug` and `isLolAccountAllowed`, `twix` left the worklist while its reads stayed open, no row leaked a pause field, and owner puuids held at 4. Net +19 tests (shared 530 → 537, api 1531 → 1541, web 3043 → 3045).

One correction fell out of implementing it: `live-game-poller.service.ts:180` was listed as a third sync site and is not one — see the `getLolAccounts()` row of the read-path table. It now carries a comment saying so, because it is exactly the kind of line a later reader would "fix".

### Chunk 2b — Admin endpoints + status-page UI

`AdminAccountsModule` with the six routes, all `@UseGuards(OwnerGuard)`. Riot account-v1 validation in the LoL POST. `apps/web/src/admin/`: hooks + tables + dialogs. "Tracked accounts" zone on the status page, disable-with-tooltip when `viewer.isOwner === false`. Same-commit specs (backend per-endpoint + frontend table + axe).

Files: ~5 new backend + ~6 new frontend + ~1 modified status page + ~8 new specs. The visible UX change is the new tables on `/status`.

Note what 2a deliberately left undone: **nothing calls `reload()` yet**, so a roster written straight to the DB is not picked up until the api restarts. That is the gap these endpoints close, and it is why 2a's live verification had to construct the service directly rather than curl `/me`.

### Chunk 3 — Purge + polish

**Gated on a verified restore.** [pre-launch-sweep.md](pre-launch-sweep.md) already carries the standing rule that destructive data arcs don't run without one, and purge is squarely that class. Nothing here needs to ship with chunk 2 — the roster is fully manageable without it.

- `purge-preview` + `purge` endpoints, the six-step transaction, the orphan sweep.
- `purge-account-dialog.tsx` — preview counts, typed-slug confirmation.
- Spec coverage for the ordering constraint specifically: a purge that tries `Summoner` before `Match` must fail, and the shared-`matchId` case must keep its cache row.
- README section documenting the admin flow.
- Optional: case-study candidate in [case-study-topics.md](../cross-cutting/case-study-topics.md) — "Roster as data, not config" pairs naturally with the owner-auth write-up.

---

## Resolved decisions (2026-06-06)

1. **Sequencing: A.** Owner-auth chunk 1 lands first (ships `OwnerGuard` dormant), then this arc's chunks 1–3. No temporary-gate window.
2. **`SteamAccount.isOwner`: default `true`, no v1 UI affordance to flip it.** Owner has no immediate plan to track non-owner Steam libraries; the field is provisioned for shape-consistency with `LolAccount` so a future Steam-friend use case doesn't require a migration. Admin form may omit the field on the Steam add dialog; backend accepts it and defaults to `true` when missing.
3. **Chunk 0: immediate standalone commit.** The `home-first-played` filter fix ships independently of the rest of the arc — and did: `1f33d7fc`, 2026-06-09.
4. **Riot ID validation: strict.** Account-v1 404 hard-fails the POST with an inline error on the form. Riot 5xx surfaces a retry hint in the error toast; the row is not persisted. Matches the API's posture elsewhere.

---

## Resolved decisions (2026-08-14)

Chunk 1 shipped, then chunk 2's scope was reopened. All five settled in the same pass:

1. **Four actions, not one lifecycle: hide, pause, delete, purge.** Hide and pause are orthogonal nullable timestamps; delete removes the roster row; purge removes the data. An enum was considered and rejected — the roster already wants hidden-and-syncing while a temporarily-tracked friend wants visible-and-paused, and those are opposite corners no single ordered state expresses.
2. **`/me` flags hidden accounts, never omits them.** Forced by measurement, not preference: `useAccountFromSlug` resolves the page's account out of `/me`, so dropping the row breaks the hidden account's own route while the api keeps serving it. Filtering happens in the nav.
3. **Hiding does not touch `getOwnerPuuids()`,** so it cannot move `/`'s lifetime totals. Presentation and authorship stay separate levers; `isOwner` is the one that changes the self-portrait.
4. **Purge gets its own endpoint and its own chunk.** Not a `?purge=true` flag on `DELETE`. It is the only irreversible action in the arc, and the repo's own backup rule already covers this class of change.
5. **Cache eviction stays an orphan sweep, not a match-id set diff.** `DELETE … WHERE "matchId" NOT IN (SELECT "matchId" FROM "Match")` after the account's `Match` rows are gone is correct for shared matches with no special-casing, and self-heals pre-existing orphans. Measured: 1 shared `matchId` across the whole roster, so the general form costs nothing.
