# Steam achievement rarity drift

**Status:** Active — R1 shipped 2026-08-07 (history table, append-on-change, seeded from the 9,085 existing rarity rows) and R2 shipped 2026-08-12 (`probe-rarity-drift.ts`, extended the same day with the launch/mature cohort split). **R2's second reading clears the gate for launch-window titles and leaves the mature library unresolved.** Beast of Reincarnation captured its second observation on the 00:12:07Z boot and moved up to +30.10pp in 7 days across 45 of 46 series — but it released 2026-08-03, so that is a launch curve, not settled drift. Split by release age: 45 of 46 launch-window series are visible, 0 of 512 mature ones are, and the mature maximum is +0.30pp over an 8-day span — on Steam's precision floor, where noise and ~3pp/year are indistinguishable. **R3 is no longer blocked on data; it needs a scoping decision**: a launch-window beat has a live dataset now but only fires on newly-played releases, while a whole-library drift beat would still be blank for 58 of 60 games and stays gated on elapsed time. **The poller's cadence was split 2026-08-13** so launch-window titles refresh daily instead of weekly — 33 of Beast's 42 unlocks postdate its first observation, but two samples across a 20pp/week curve can't say what a rarity *was* at unlock, and an unsampled curve is unrecoverable.

## Today's behaviour

Global rarity is a **current value, refreshed weekly, with an append-only observation log behind it**.

- [global-rarity.poller.ts](../../../apps/api/src/steam/global-rarity.poller.ts) selects every game whose `lastRarityCheckedAt` is older than 7 days, daily at 05:30 Europe/Brussels, 40 games per pass, boot-reconciled. So a displayed percentage is at most ~7 days stale.
- [global-rarity.service.ts](../../../apps/api/src/steam/global-rarity.service.ts) upserts `SteamAchievementGlobalRarity` in place. That row stays the single current value and stays the only thing the read path touches.
- The same transaction reads the outgoing values *before* the upsert overwrites them — the one moment the previous reading still exists anywhere — and appends to `SteamAchievementRarityHistory` only for what moved at Steam's one-decimal precision.
- `polledAt` never crosses the API boundary, and neither does the history table. No read-side consumer exists for either.

The display copy is present-tense and therefore correct — "X% of Steam players who own this game have unlocked this achievement" ([rarity-percent.tsx:36](../../../apps/web/src/steam/_shared/rarity-percent.tsx#L36)), "of players have it" ([game-recap.ts:810](../../../packages/shared/src/steam/game-recap.ts#L810)). **Nothing in the app claims rarity-at-unlock-time, so there is no defect here.** This arc is a feature, not a fix.

## What the drift actually measures (probed 2026-08-07)

Live Steam diffed against our stored rows: 12 games, 857 achievements, values 4.6–6.5 days old.

| Game | Age | n | ↑ | ↓ | moved |
|---|---|---|---|---|---|
| Nioh 3 | 6.5d | 64 | 0 | **33** | 33 |
| Control | 4.6d | 67 | **18** | 0 | 18 |
| Hollow Knight | 4.6d | 63 | 11 | 0 | 11 |
| Dark Souls II SotFS | 4.6d | 38 | 9 | 0 | 9 |
| Shadow of the Tomb Raider | 4.6d | 99 | 7 | 1 | 8 |
| Half-Life 2 / L4D2 / Rise of the Tomb Raider | 4.6d | 313 | 9 | 0 | 9 |
| Dark Souls III | 4.6d | 43 | 0 | 0 | 0 |
| Sekiro / Fallout 4 / Witcher 2 | 4.6d | 170 | 0 | 3 | 3 |

Four findings, each load-bearing for the design below.

**1. Steam publishes one decimal.** All 91 moves were exactly ±0.10pp, with zero smaller moves in 857 comparisons. That is the endpoint's real precision, not our rounding — so rendering at one decimal shows exactly what Steam knows, and sub-0.1pp drift is invisible by construction. **This decides the append predicate** (see R1). It holds everywhere except at the floor of the range, where the reading is `0` and one decimal states more than Steam said — see the 2026-08-11 section.

**2. Direction is per-game, and both mechanisms are visible.** Nioh 3 is a recent release with a growing owner base, and *every* one of its 33 moves is negative — new owners entering the denominator having unlocked nothing. The settled back-catalogue games move up as remaining owners grind. Dark Souls III has stopped moving entirely.

**3. The rare band is stickier than the common band.** 12 of 324 sub-10% achievements moved, against 91 of 857 overall. A 0.1pp step at 2% needs a 5% relative shift in the owner base; at 60% it needs 0.17%.

**4. The band we actually display did not move at all.** The rarest twelve owner-unlocked achievements (1.9%–5.1%, i.e. what the trophy case shows) moved 0.000pp over the window. Across all owner-unlocked rows, 41 of 321 moved.

## A reported 0 is a floor, not a measurement (2026-08-11)

The trophy case showed four Beast of Reincarnation achievements at **0.0%** — which, beside an unlock the owner holds, states that nobody holds it. Steam had reported literal `0` for them, and nothing in the pipeline was wrong: the api coerces the endpoint's string percent at [steam-client.service.ts:280](../../../apps/api/src/steam/steam-client.service.ts#L280) and the badge printed it at one decimal.

What the reading actually was: the game released **3 Aug 2026**, our rows were polled **2026-08-05 00:12** (two days in, before the owner unlocked any of them, which happened 8-09 → 8-11), and at that point its completionist achievements sat below the endpoint's one-decimal floor. Live on 8-11: 46 achievements, **none at 0**, minimum 0.9%, and `ACH_ALL_RESTING_PLACE` at **2.0%**.

Two things follow.

**The label had to stop asserting 0.0%.** `formatRarityPercent` and `formatRarityPercentEditorial` in [rarity-percent.tsx](../../../apps/web/src/steam/_shared/rarity-percent.tsx) render anything that would round to `0.0` as `<0.1%`, and the tooltip switches to "Fewer than 0.1% …". The predicate is `percent < 0.05` rather than `=== 0`, so the invariant is "no surface ever prints 0.0%" rather than "we special-case the value Steam happens to send". Four display sites needed it, because three were formatting their own percentage instead of going through the shared badge: the [trophy-case tile](../../../apps/web/src/steam/profile/trophy-case-strip.tsx) and the recap chapter's three inline formats. Ranking was left alone — `0` really is the rarest bucket Steam can express, so `ORDER BY percent ASC` in `getCrossGameRarest` is still right; only the label was lying.

**Staleness at the floor is by design, and visible.** The poller's 7-day age window (see "Today's behaviour") means a launch-week reading is displayed for up to a week, and launch week is exactly when the reading is a floor rather than a value. This row came due 8-12. Not worth a shorter window for zero-percent games on its own — the label fix removes the false claim, and the drift is the arc's whole subject rather than a bug — but it is the reason a brand-new game is the one surface where the display and Steam disagree most.

## Framing decision

The headline beat — *"0.3% when you got it, 1.9% now"* — **will not happen for the existing library**, and the note records that up front so nobody re-pitches it. Those games are settled; finding 4 says the rare end of a back-catalogue game moves at roughly nothing per week. Building history against what's already on the shelf produces a chart of flat lines.

Where it lands is Nioh-3-shaped: a game bought near release, where percentages fall steeply as sales grow the owner base. Unlock something at 2% in launch week and a year later it is genuinely rarer-looking. **That story only exists going forward, and only if the recording starts before the interesting games arrive.**

Four days after R1 shipped, one arrived: Beast of Reincarnation moved 0.0 → 0.9–2.0% in six days, in the rare band, on a game played at release. The direction is the opposite of the pitched sentence — it rose as the owner base finished the game rather than falling as the base grew — which is finding 2's per-game direction, not a contradiction. Finding 4 still stands for everything already on the shelf.

Two consequences:

- R1 was worth doing *despite* having no visible payoff. That is unusual for this repo and was the whole argument — deferring costs a year of curve, and the migration was an afternoon.
- R3 (the UI) must not be built on spec. It ships when R2's diagnostic shows a game with a real slope, and not before, or it renders twelve flat lines and reads as a bug.

## Chunk plan (2026-08-07)

| # | What | Where | Notes |
|---|---|---|---|
| R1 | History table + append-on-change | Prisma migration + `apps/api/src/steam` | **Shipped 2026-08-07**, migration `20260807000000_steam_achievement_rarity_history`. `SteamAchievementRarityHistory(id, appid, apiName, percent, observedAt)`, FK to `SteamGameAchievement` like the current-value row, indexed `(appid, apiName, observedAt)` so the series-for-one-achievement read gets its sort from the index. Seeded 9,085 origin rows from the current `percent` + `polledAt`, so every series starts at a known reading rather than at its first move. `RaritySyncResult` gained `historyRowsAppended`; the poller's log line reports it. Read path, API and web untouched. |
| R2 | Drift diagnostic script | `apps/api/src/scripts` | **Shipped 2026-08-12** as [probe-rarity-drift.ts](../../../apps/api/src/scripts/probe-rarity-drift.ts) — span, endpoints and slope per achievement with ≥2 rows, ranked absolutely and relatively, plus a quantum histogram and an explicit gate verdict. Thresholds are flags (`--rare-band`, `--visible-pp`, `--visible-ratio`) so the gate is argued from output. Two departures from the spec above. **Coverage leads the report**, because a single-point series and a flat series produce identical silence and mean opposite things — the first run found 8,565 of 9,085 series still single-point, which would have read as "rarity doesn't drift" without that line. And it constructs `PrismaService` directly rather than booting `AppModule` like `backfill-remake-flag.ts` does: an application context runs every `onModuleInit`, including this poller's own boot drain, so the probe would race the table it measures — the first build did exactly that, and spent the Riot budget on live-game polls as well. **Extended the same day with the launch/mature cohort split** (`cohortOf`, `ageDays`, `--launch-window`, default 60d) after the pooled verdict printed `Gate CLEARED` on the strength of a single nine-day-old release. The verdict now reports the cohorts separately and states the mature span, so it cannot claim "settled titles do not drift" from a window too narrow to measure one. |
| R3 | The drift beat | web + `packages/shared` | **Gated on R2, unscoped deliberately.** Shape is undecided because it depends on what R2 finds — a delta line on the achievement card, a sparkline in the trophy case, or a recap beat are all plausible and the data picks. Do not scope this before R2 has something to show. |

## Design decisions, settled up front

- **Append-on-change, not append-always.** At the measured ~10.6%-per-5-days move rate, append-on-change costs roughly 1,090 rows/week across the 9,085 tracked achievements — about 57k rows/year. Append-always would be ~472k/year for the same information. An order of magnitude, for free.
- **Compare on the rounded value, not the raw float.** Steam's real precision is one decimal (finding 1), but it serialises through a float32 and hands back values like `47.900001525878906`. Comparing raw floats risks appending representation noise as if it were drift. Round both sides to one decimal for the "did it move" test; store the raw value Steam sent.
- **Keep `SteamAchievementGlobalRarity` as the current-value row.** Do not derive "latest" from the history table. The read path is hot — every achievement panel, the trophy case, `use-cross-game-rarest`, the recap — and a `DISTINCT ON` per achievement would be a real regression bought for no benefit. History is append-only and write-side only until R3.
- **No retention policy, deliberately.** At ~57k rows/year this needs no pruning for the better part of a decade, and pruning is exactly the thing that would destroy the long spans the arc exists to accumulate. If someone later adds a cleanup pass here, that is a defect.
- **Games the owner no longer owns keep their history.** The poller already filters on `game.removedAt: null` so nothing new accrues, and the existing rows are harmless. Same reasoning as the absent stale-row cleanup documented at [global-rarity.service.ts:29-33](../../../apps/api/src/steam/global-rarity.service.ts#L29-L33).

## Known limit, permanently

`observedAt` records when *we* looked, never when the achievement was unlocked. Steam's unlock timestamps backfill retroactively ([schema.prisma:333-338](../../../apps/api/prisma/schema.prisma#L333-L338)), so the library's unlock history reaches back years while the rarity series can only ever start at R1. For everything already on the shelf, the honest framing is "since we started watching" — and any copy R3 ships has to say that rather than implying unlock-time. This gap cannot be closed by any amount of later work.

## R2's first reading (2026-08-12) — superseded the same day

> Superseded by [R2's second reading](#r2s-second-reading-2026-08-12-after-the-001207z-boot) below, taken after the boot that drained Beast of Reincarnation. Kept because its coverage numbers and its two confirmed gotchas still hold, and because the shape of the mistake is worth keeping: this reading pooled a nine-day-old release with 58 settled titles and concluded "flat", when the two populations were about to disagree by two orders of magnitude.

**Gate not cleared. Do not build R3.** Across 9,085 series in 158 games, 520 have a second observation and every one of them moves at Steam's precision floor or barely above it:

| absolute move | series |
|---|---|
| 0.30pp | 1 |
| 0.20pp | 32 |
| 0.10pp | 487 |

Nothing exceeds 0.30pp. In the rare band, 76 series move at all and the largest is `Tomb Raider — No Stone Left Unturned` at 8.2% → 8.3% over 8 days. The relative leaders top out at 1.10× (`Rise of the Tomb Raider — No One Left Behind`, 1.0% → 1.1%). This reading called that the flat-lines outcome the framing decision reserved as a failure condition — which held for the settled library and was wrong as a verdict on the arc, since the one game about to report was a launch-window title that moved 100× harder than anything here.

**The known-answer case is not in the table, and the reason is cadence, not a defect.** Beast of Reincarnation holds 46 rows across 46 series, all stamped `2026-08-05 00:12:07` — one observation each, so it cannot appear in any movement ranking. The 0.0 → 0.9–2.0% reading from 2026-08-11 was a manual live read that never entered the history table. Its seven-day age expires at **`2026-08-12 00:12:07Z`**, so on the 08-09 drain it was correctly five days old and skipped. It is the next game to come due, and `orderBy: { lastRarityCheckedAt: asc, nulls: "first" }` puts it first in the batch — so the first api boot after that timestamp captures its second observation, and R2 should be re-run immediately afterwards. The probe prints this as a `next to come due` line precisely so the instruction is "restart after X" rather than "restart".

Two things confirmed while chasing this, worth not re-deriving:

- **The poller is not misbehaving.** It fires at 05:30 Europe/Brussels while the dev box is asleep, but that was designed for — the due check is a seven-day *age* and `onModuleInit` re-runs the same selection on every boot, so a missed fire costs nothing that a restart does not repair. Partial coverage across the fleet is `RARITY_BATCH_CAP = 40` draining in boot-sized bites, working as intended.
- **`lastRarityCheckedAt` is `timestamp without time zone`, and the container runs `Europe/Brussels`.** `node-pg` parses naive timestamps as process-local, so a raw SQL probe renders every one of these two hours early and makes due-date arithmetic come out wrong by exactly that much. Prisma and the Postgres session are both UTC, so the shipped comparison is correct — it is only ad-hoc `pg` clients that mislead. Cast to `::text` when checking these by hand.

## R2's second reading (2026-08-12, after the 00:12:07Z boot)

Beast of Reincarnation captured its second observation on the restart, and it moves — hard. All 46 series moved; 45 of 46 clear the visibility bar; the largest is `Place of Return` at **16.1% → 46.2%, +30.10pp in 7 days**. Fifteen series moved more than 10pp. The relative leaders run to 26×.

That is the known-answer case answering, and it is worth being precise about what it answers. **The game released 2026-08-03**, so the first observation (`2026-08-05`) caught it two days after launch and the second nine days after. What the series records is a launch curve — the owned-but-unplayed population working through content nobody had reached yet — not the drift of a settled title. Direction is up, which is finding 2's per-game direction.

Splitting the 566 two-point series by release age separates the two populations cleanly:

| cohort | series | visible | games | largest move |
|---|---|---|---|---|
| launch window (≤60d) | 46 | 45 | 1 | +30.10pp |
| mature (>60d) | 512 | 0 | 58 | +0.30pp |
| unknown release date | 8 | 0 | 1 | +0.10pp |

**Launch-window drift is established.** It is real, large, and legible at a glance — the one thing this arc was waiting to see. The mature cohort's largest mover is `Borderless Gaming — LIGHTS_OFF` at 16.0% → 16.3% on a 4,038-day-old game; nothing else in 512 series reaches even 0.5pp.

**The mature cohort is not established either way, and the note should not claim it is.** The widest mature series spans 8 days (the table's observation dates cover 12, but no single settled series is watched across all of them yet). A 0.1–0.3pp move over 8 days sits exactly on Steam's published precision, where the slope's relative error exceeds the slope: the same data is consistent with pure quantization noise and with ~3pp/year of genuine drift, and nothing here separates them. "Settled titles do not drift" would be an overclaim from a window that narrow; the correct statement is that the mature slope is unmeasurable at this span. That half of the arc stays gated on elapsed time exactly as before — the difference is that it is no longer the only path forward.

**Consequence for R3.** A beat keyed on drift across the whole library would be blank for 58 of 60 games. A beat keyed on the launch window has a live, dramatic dataset today, but only fires when the owner plays something in its first weeks — which is a genuinely different feature with a different trigger, not a threshold tweak. That is the scoping decision R3 now needs; it is no longer blocked on data.

R2 was extended in the same session to report this split, because the pooled verdict printed `Gate CLEARED` on the strength of one nine-day-old game — technically true and materially misleading. `cohortOf()` keeps unknown-release-date games in their own bucket rather than folding them into `mature`, since an unenriched new release landing in the settled population is the single misclassification that would flip the verdict. `--launch-window` (default 60 days) is a flag like the other thresholds.

## The sampling rate was wrong for the cohort that moves (2026-08-13)

The pitched sentence — *"0.3% when you got it, 1.9% now"* — needs the unlock to postdate the first observation, which the arc's permanent limit says can never be reconciled retroactively. Beast of Reincarnation is the first game where it lines up: **33 of its 42 owner unlocks were recorded after we began observing.**

It still cannot be said, and the reason is cadence. `Bestie` reads **1.4% at first observation (08-05), unlocked 08-08, 24.1% now** — but every Beast series holds exactly **two** points, because the poller refreshed each game weekly while this one moved ~20pp per week. The bracket around "when you got it" is wider than the claim it would support. Only the vaguer *"1.4% → 24.1% while you played it"* is honest against two samples.

So the poller now splits its cadence: `RARITY_LAUNCH_MAX_AGE_MS` (1 day) for titles released within `LAUNCH_WINDOW_MS` (60 days), `RARITY_MAX_AGE_MS` (7 days) for everything else. Four things worth carrying:

- **The cohorts are selected in two queries, not one with a conditional cutoff.** They cannot share an ordering: `lastRarityCheckedAt asc` sorts a daily-polled launch title *behind* every weekly one, because it was checked more recently. A merged drain parks the only cohort that moves at the back of the queue, and past the batch cap entirely whenever a backlog exists. Launch-window games take their slots off the top and the settled pass gets the remainder.
- **The launch query is skipped outright when the cohort is empty**, rather than issued with an empty filter. An unfiltered query at the 24-hour cutoff selects the whole library — the first cut of this change did exactly that, and the spec now pins it.
- **A game with no known release date counts as settled.** Enrichment refreshes daily against a 30-day window so an unenriched release resolves within a day or two, and the other default would put the entire unenriched tail on daily polls. It mirrors the probe's `unknown` cohort.
- **Unreleased titles fall inside the window** (`releaseDate >= cutoff` catches a pre-order like Mortal Shell II, dated 2026-08-20), which is right — it is polled daily from the day it ships. The existing `achievementCount > 0` gate keeps it out of the pass until it has a schema at all.

Verified against the live database, not just the mocks: the cohort resolves to 2 games, Beast is due at the 24-hour cutoff right now, and 55 settled games are due at the 7-day one — so a boot pass takes Beast plus 39 settled, and the remainder drains on the next.

**Confirmed live on the first boot under the new selection** (2026-08-13 15:49:56Z). Beast led the pass, 45 of its 46 series took a third observation, and the settled arithmetic closed exactly — 55 due, minus the 39 slots left after the launch cohort, leaves the 16 the backlog query reports. The extra resolution shows immediately: `Bestie` reads **1.4 → 24.1 → 26.2**, `Closest Companion` **3.2 → 29.5 → 31.4**, so the 08-12 → 08-13 leg is ~1–2pp per day where one weekly sample had folded it into a single step. The 46th series took no row because nothing moved, which is the append-on-change table behaving correctly rather than a gap.

One thing to know when reading stamps around a restart: two boots ~18 minutes apart each drained a full 40, so 80 games carried a fresh stamp inside one window. That is two passes at the cap, not one pass overrunning it — the tell is which game leads each burst (`Portal 2`, oldest-first, under the old single query; `Beast of Reincarnation` under the split one).

**The honest limit: this fixes the selection, not the sampling.** The daily tick fires at 05:30 Europe/Brussels on a dev box that is asleep, so a launch-window game is still really sampled "whenever the api boots". That is the same hosting blocker tracked across the ingestion arc, and nothing here moves it — the change means the cadence is right the moment the process runs continuously, and that a restart now costs a launch title one day of resolution rather than seven.

## Pointer hygiene

When R2's diagnostic first reports a game with a real slope, record the numbers here — that reading is the trigger that unblocks R3, and it should be written down rather than remembered. Until then the honest state of this arc is "recording, nothing to show", and the Status header should keep saying so rather than drifting toward "in progress".
