# Ingestion cron reliability

**Status:** Active — three self-sealing gates fixed 2026-08-05; converting the weekly/monthly pollers from schedule-driven to staleness-driven is the remaining work.

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
| `steam-achievement-schema` | `Sun 05:00` | never-checked only | 1 week |
| `steam-global-rarity` | `Sun 05:30` | never-checked only | 1 week |
| `steam-enrichment` | `1st 04:30` | incomplete-row predicate | 1 month |
| `steam-tag-catalog` | `1st 04:45` | empty-table only | 1 month |

All eleven have overlap protection. The eight Steam pollers pin `Europe/Brussels`; the three LoL crons don't, which only affects hour-anchoring since they're interval-based.

`steam-enrichment` is the counter-example done right: it backfills on an incompleteness *predicate* (`logoPath IS NULL`), retried every boot, with the expected residue documented. 15 of 227 rows sit there by design.

## Shipped 2026-08-05

- **Data repaired.** Whole-library schema refresh (195/195, `withAchievements` 157 → 158), then the unlocks boot backfill ingested all 9 rows with their true `unlocktime`.
- **`SteamRecentlyPlayedUnlocksPoller`** re-checks the schema of any recently-played game whose count is zero or null and was last checked over 24 h ago, before its unlock loop, so a count flipping 0 → N is used in the same tick. The 24 h floor keeps permanently schema-less titles (Dota 2, CS2, demos) at one wasted call per day.
- **`SteamTagPoller.onModuleInit`** checks catalog *age* rather than row count. Emptiness alone left a populated-but-stale catalog with no path back, since boot returned early and the cron that would have refreshed it is the one that already didn't fire.
- **`SteamAchievementSchemaService.refreshSchemas`** guards its write per appid. The `$transaction` sat outside the per-appid `try` that already wrapped the fetch, so one write failure aborted every appid queued behind it — each keeping whatever count it had, stale zeros included.
- **`refreshUnlocksForGame`** asserts `achievementCount > 0` rather than `!== 0`. The column is nullable and a null passed the old guard into `syncUnlocks`, where the FK rejects.

## Remaining

**Convert the weekly and monthly pollers from schedule-driven to staleness-driven** — "on boot, and every N, process rows older than X" rather than "fire at time T". Same Steam budget, but a missed window self-corrects at the next boot or tick instead of waiting a full period. Applies to `steam-achievement-schema`, `steam-global-rarity` and `steam-enrichment`; `steam-tag-catalog` already got the boot half of this.

This matters more, not less, once hosting lands: the process will be up continuously, but deploys land exactly the kind of short downtime that eats a single fire. The portrait arc's chunk 0 already recorded the same underlying constraint from the other side — `SteamPlaySession` misses launches because the poller only runs on the dev box (see [player-portrait.md](../steam/player-portrait.md)).
