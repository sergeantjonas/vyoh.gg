# Ingestion cron reliability

**Status:** Shipped — the 2026-08 gates and the 2026-09-05 Steam-private stamping are in; nothing open here (§ Remaining).

Opened 2026-08-05 after a reported symptom: Beast of Reincarnation (appid 2001760) had nine achievements unlocked on Steam over the preceding 24 hours and none of them in our database.

## The defect class

**A cached upstream fact that gates downstream work, and is only re-derived by a rare cron.** Every instance found is a variation on that sentence, and each one is silent — the pipeline reports success while skipping the work.

The reported case: the game was acquired 2026-07-25, before its achievement schema was published. The schema fetch on 07-26 legitimately returned an empty list, so `SteamGameAchievementMeta.achievementCount` was recorded as `0`. Steam later published 46 achievements. Nothing noticed, because all four unlock paths gate on `achievementCount > 0`:

- `SteamPlayerUnlocksPoller.tick` — `where achievementMeta: { achievementCount: { gt: 0 } }`
- `SteamPlayerUnlocksService.refreshUnlocksForGame` — short-circuits on a zero, and is what both the session-close hook and the recently-played backstop call
- `SteamGlobalRarityPoller` — both boot backfill and cron

So the more the game was played, the more often the hourly poller saw it and immediately no-opped. The only path that could correct the zero was the weekly schema cron, and the boot backfill deliberately skips rows that already exist (`achievementMeta: null`), so restarts didn't help either.

## Why the weekly cron didn't self-heal

`@nestjs/schedule` crons are in-process timers. No persistence, no catch-up: a fire missed because the process was down is skipped permanently, not deferred. On a pre-production project where the api only runs when the dev box does, a `0 5 * * 0` cron is closer to "never" than to "weekly".

Three independent measurements on 2026-08-05 confirmed this had already been happening:

- No `lastSchemaCheckedAt` value in the table fell at 05:00. Both recorded runs (2026-07-26 12:27 over 135 rows, 2026-08-02 11:56 over 59) were boot backfills — the second covering exactly the `195 − 135 − 1` rows that had no meta row at all. The weekly schema cron has never fired.
- `lastRarityCheckedAt` still read 2026-07-26, so the 2026-08-02 rarity cron didn't fire either.
- `SteamTag.updatedAt` newest was 2026-07-15 across 476 rows, so the 2026-08-01 monthly tag cron didn't fire.

The exposure scales with the interval. A missed `*/15 min` tick costs 15 minutes; a missed monthly tick costs a month.

| Cron | Schedule | Boot backfill | Cost of one missed fire |
|---|---|---|---|
| `steam-player-state` | `*/2 min` | full | 2 min |
| `match-sync` | `*/5 min` | — | 5 min |
| `steam-owned-games` | `*/15 min` | — | 15 min |
| `steam-recently-played-unlocks` | `:15 hourly` | — | 1 h |
| `steam-player-unlocks` | `*/4h :05` | never-checked only | 4 h |
| lol patch + static sync | `*/6h` | — | 6 h |
| `steam-achievement-schema` | `Sun 05:00` → **daily 05:00** | never-checked only → **age-based** | 1 week → **1 day** |
| `steam-global-rarity` | `Sun 05:30` → **daily 05:30** | never-checked only → **age-based** | 1 week → **1 day** |
| `steam-enrichment` | `1st 04:30` → **daily 04:30** | incomplete-row predicate → **+ age-based** | 1 month → **1 day** |
| `steam-tag-catalog` | `1st 04:45` | empty-table only → **age-based** | 1 month → **1 restart** |

All eleven have overlap protection. The eight Steam pollers pin `Europe/Brussels`; the three LoL crons don't, which only affects hour-anchoring since they're interval-based.

`steam-enrichment` was the closest to right before any of this: it already backfilled on an incompleteness *predicate* (`logoPath IS NULL`) retried every boot, with the expected residue documented — 15 of 227 rows sit there because PICS cannot resolve those titles. What it lacked was the age half, so a *complete* row that had gone stale was invisible to boot and reachable only from the monthly fire.

## Shipped 2026-08-05

- **Data repaired.** Whole-library schema refresh (195/195, `withAchievements` 157 → 158), then the unlocks boot backfill ingested all 9 rows with their true `unlocktime`.
- **`SteamRecentlyPlayedUnlocksPoller`** re-checks the schema of any recently-played game whose count is zero or null and was last checked over 24 h ago, before its unlock loop, so a count flipping 0 → N is used in the same tick. The 24 h floor keeps permanently schema-less titles (Dota 2, CS2, demos) at one wasted call per day.
- **`SteamTagPoller.onModuleInit`** checks catalog *age* rather than row count. Emptiness alone left a populated-but-stale catalog with no path back, since boot returned early and the cron that would have refreshed it is the one that already didn't fire.
- **`SteamAchievementSchemaService.refreshSchemas`** guards its write per appid. The `$transaction` sat outside the per-appid `try` that already wrapped the fetch, so one write failure aborted every appid queued behind it — each keeping whatever count it had, stale zeros included.
- **`refreshUnlocksForGame`** asserts `achievementCount > 0` rather than `!== 0`. The column is nullable and a null passed the old guard into `syncUnlocks`, where the FK rejects.

## The conversion, shipped 2026-08-06

**Every long-interval poller now selects on age, not on a wall-clock fire** — "on boot, and every day, process rows older than X" rather than "fire at time T, process everything". Budget is unchanged; it just spreads. The daily tick is what makes this work in production; **the boot pass is what makes it work here**, and it is the load-bearing half, since a daily cron at 05:00 on a machine that is off at 05:00 still never fires.

- `steam-achievement-schema` — never-checked games first, then the oldest `lastSchemaCheckedAt` past 7 days, capped at 40. Two queries, because a game with no meta row cannot be found by ordering on a column it doesn't have.
- `steam-global-rarity` — `lastRarityCheckedAt` past 7 days, gated on `achievementCount > 0`, capped at 40. No never-checked pass: a game with no meta row has nothing to ask Steam about yet. **Two queries since 2026-08-13**, one per release-age cohort: titles released within 60 days refresh against a 1-day age and take their slots off the top, everything else drains the remainder at 7 days. They cannot share a query, because one ordering on `lastRarityCheckedAt asc` sorts the daily-polled cohort *behind* the weekly one — it was checked more recently — and past the cap whenever a backlog exists. Rationale for the split cadence lives in the drift arc; the short version is that launch-window rarity moves ~100× faster and an unsampled curve is unrecoverable.
- `steam-enrichment` — no row, **or** `logoPath IS NULL`, **or** `enrichedAt` past 30 days; never-enriched first, then oldest, capped at 25. The always-due incomplete rows don't starve the queue behind them, because `enrichApps` restamps `enrichedAt` whether or not PICS resolved, sorting them to the back until everything else has had a turn.
- `steam-tag-catalog` — got the boot half on 2026-08-05; its monthly tick is unchanged, since one restart is now enough to reconcile it.

**Each was verified against the live database, not just mocks.** A backdated schema row was selected on boot, refreshed and restamped; a pass with nothing due exits silently. Rarity's first real run found the backlog the never-fired Sunday crons had left and drained it 40 at a time across successive passes rather than in one 158-call burst. Enrichment picked up 16 due (15 missing-logo, 2 past 30 days, one row both).

Three details worth keeping:

- **The batch cap must stay above the steady-state arrival rate** (~195/7 ≈ 28/day for schema) or the oldest rows never drain.
- **`orderBy` needs `nulls: "first"` explicitly.** The columns are nullable and Postgres sorts NULLS LAST on ASC, which would park a never-stamped row permanently behind the cap — the exact failure this arc exists to remove, reintroduced one layer down.
- **The three selections were deliberately not extracted into a shared helper.** They share a concept, not a shape: schema needs two queries across two tables, rarity needs two across two release-age cohorts with a relation gate, enrichment computes in memory over a candidate list that includes wishlist appids with no row. A generic `dueForRefresh()` would take more arguments than each call site has lines — and the shapes have diverged further since, not converged.

## Steam-private games are refused per app (found 2026-09-05)

Steam's library "Mark as Private" makes `GetPlayerAchievements` answer **403 `Profile is not public` for that appid only**, even to the owner's own key and with a public profile (visibility 3 confirmed the same minute a control game answered 200). Two owned games are in that state; both are also hidden on vyoh, which is how it surfaced — the 100%'d hall showed neither, and the probe found "0 / 53" with `lastUnlocksCheckedAt: null` after a sweep that had stamped 160 of 163 games.

`syncUnlocks` catches the throw and `continue`s **without stamping**, so a private game is retried every four hours forever and its displayed unlocks freeze at whatever was ingested before it was marked private (Subverse: 2026-09-03). The `success: false` branch that does stamp only handles a 200 body; a 403 never reaches it.

**Shipped 2026-09-05.** `getPlayerAchievements` now returns a three-way result — `ok`, `no-stats` (the 200 `success: false`) and `private` (a 403 whose body carries the same envelope; any other 403 body or status still throws). `syncUnlocks` stamps `lastUnlocksCheckedAt` on `private` like any other attempt, records the first refusal in `SteamGameAchievementMeta.statsPrivateAt` (migration `20260905162512`), and clears it on the next `ok` or `no-stats`; the sweep summary reports `private=N` beside `failed=N`. Vyoh-hiding is unrelated: no poller reads curation, and the sweep proved it by visiting the game.

Surfaces read the flag rather than the frozen count: the per-game panel says "Private on Steam" and quotes the snapshot only when it held real unlocks; a hall tile captions "stats private on Steam" instead of stating its total as current; Nearest 100% names the games it left out in a footnote, and the `/hunt` palette group counts them in a disabled row.

**Decision: a private game is never a Nearest 100% candidate.** Its locked set is frozen at the last sync Steam allowed, so "what is left" is unknowable and a score would be a guess; `buildCompletionCandidates` takes the private set as a third argument and the api reports the excluded appids as `privateAppids`, filtered through the viewer's curation so a hidden private game stays hidden. When the only started games are private the section still collapses — the ranking has nothing to rank and the per-game panel carries the message.

## Remaining

Nothing. The residual risk is now a full day rather than a week or a month, and it self-corrects on restart.

The one thing to re-check when hosting lands: with the process up continuously the daily ticks carry the load, and the boot passes become the deploy-time safety net they were designed to be — deploys land exactly the kind of short downtime that used to eat a whole fire. If the Steam budget ever tightens, the caps and windows in each poller are the knobs; they were set to preserve each poller's previous effective cadence, not to a measured limit.

The portrait arc's chunk 0 recorded the same underlying constraint from the other side — `SteamPlaySession` misses launches because the poller only runs on the dev box (see [player-portrait.md](../steam/player-portrait.md)). That one is not fixed by this arc: a missed *launch* is an event with no row to age, so there is nothing for a staleness pass to find. It needs hosting, not a better selection query.
