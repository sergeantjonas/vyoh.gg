# Steam achievement rarity drift

**Status:** Active — R1 shipped 2026-08-07, R2 shipped 2026-08-12 (cohort split the same day, cadence split 2026-08-13). **R3 scoped 2026-09-02 as the launch-window beat**, decided on the third probe reading: launch cohort 99 of 99 series visible across two owner-played day-one titles (Beast of Reincarnation +36.90pp over 28 days on 12 observations, Mortal Shell II +31.50pp over 12 days on 5); the mature cohort's only rare-band movement is Nioh 3 rising off a literal 0.0 plus DOOM: The Dark Ages at +2.1pp in 27 days — no settled rare-band series reached 2× without starting at zero. The mature-library drift beat is **parked**: re-run the probe when a settled rare-band series moves ≥ 5pp or 2× from a non-zero origin. R3 ships as a third `steam-moment` type, `LAUNCH_RARITY_DRIFT`, in three chunks (shared deriver → api detector → web beat), none started; the plan below is written to be implemented from this note alone. Known limit stands: copy says "when you earned it" only for unlocks bracketed by a sample within 3 days, never for anything older.

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
| R3 | The launch-window drift beat | `packages/shared` + `apps/api/src/recap` + `apps/web/src/home/recap` | **Scoped 2026-09-02**, see [R3 chunk plan](#r3-chunk-plan-2026-09-02). Third `steam-moment` type `LAUNCH_RARITY_DRIFT`: the owner's unlocks on a day-one title, rarity when earned against rarity now, one curve. Three chunks, each independently committable. |
| R2b | Probe verdict hygiene | `apps/api/src/scripts` | Optional, independent of R3. Exclude from-the-floor series (`firstPct === 0`) from the mature verdict and print the rare-band count beside the all-band count, so `Gate CLEARED on settled titles` cannot fire off Isaac creep plus a content drop (see the third reading). |

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

## Third reading (2026-09-02), twenty days after the cadence split

Run: `pnpm --filter @vyoh/api build`, then `node dist/src/scripts/probe-rarity-drift.js` from `apps/api`, default thresholds (rare band < 10%, visible ≥ 0.5pp or ≥ 2×, launch window 60 days). The per-game decomposition below came from a scratch script over the same tables; the probe itself only prints the pooled cohort line.

**Coverage.** 9,175 series across 160 games. 3,786 have a second observation (566 on 2026-08-12), 5,389 are still single points. Observations land on 18 days between 2026-07-31 and 2026-09-01. 39 of 159 games were past the 7-day age at the time of the run, which is the sleeping dev box, not the market.

**Gate.** 51 series cleared the rare-band bar. Split by release age:

| cohort | series visible | games | largest move |
|---|---|---|---|
| launch window (≤ 60 d) | 99 of 99 | 2 | +36.90pp |
| mature (> 60 d) | 460 of 3,624 | 150 | +7.90pp |
| unknown release date | 1 of 63 | 3 | +0.50pp |

**Launch cohort, per game.** Beast of Reincarnation (released 2026-08-03): 12 observations over 28 days, 46 of 46 series visible, 37 of them in the rare band, largest absolute move `Lacerta's End` 7.0% → 43.9% (+36.90pp), largest relative `Munitions Master` 0.1% → 5.7% (57×). The owner holds 46 unlocks, 37 of them timestamped after the first observation (2026-08-05). Mortal Shell II (released 2026-08-20): 5 observations over 12 days, 53 of 53 visible, 25 in the rare band, largest `Decked Out` 16.1% → 47.6% (+31.50pp), rare-band largest `Stoned` 2.0% → 9.2% (4.6×). 53 unlocks, 33 after the first observation (2026-08-20 19:20Z). Two day-one titles inside one month, both played, both fully captured.

**Mature cohort, decomposed.** The probe printed `Gate CLEARED on settled titles — 460 series across 14 game(s)` and that line is true and misleading for the second time. The 460 count is mostly The Binding of Isaac: Rebirth outside the rare band (376 of its 640 two-point series moved 0.5–1.2pp in 27 days, an active community's slow creep at ~0.15pp/week). Inside the rare band the mature rows are:

- **Nioh 3** — 13 series, every one rising off a literal `0.0` on 2026-07-31 to 1.0–7.9% by 2026-09-01 (3 points). Enrichment dates the release 2026-02-06, so this is either a content drop adding achievements nobody had yet or a mis-dated release; in both cases it is a curve starting from the floor, not settled drift. It is the entire source of the cohort's +7.90pp maximum.
- **DOOM: The Dark Ages** (2025-05-15) — 9 series, +0.8 to +2.1pp over 27 days, 1.2–1.3×. Real, and the only genuinely settled rare-band movement in the table. ~0.5pp/week renders as a near-flat line.
- **The Binding of Isaac: Rebirth** (2014) — 12 series at +0.5 / +0.6pp, 1.05×. Five or six quanta, indistinguishable from the creep above.
- **Where Winds Meet** — 2 series at +0.1pp, one quantum.

The other ten "visible" mature games have no rare-band series past the bar. **No mature rare-band series reached 2× without starting at 0.0.** The largest settled rare-band move in the whole library is +2.1pp, against +36.9pp for a launch title observed over the same window.

**Reading.** Launch-window drift is established on two titles rather than one, and the cadence split delivered the resolution it was meant to (12 points on Beast, 5 on Mortal Shell II despite the box sleeping). The mature library is unchanged from the second reading in substance: nothing settled has moved by a story-sized amount, and the one cohort maximum that looks like it did is a from-the-floor series. A whole-library drift beat would still be blank for ~148 of 150 mature games.

**Follow-up for R2, not R3.** The pooled mature verdict should exclude from-the-floor series (`firstPct === 0`) and print the rare-band count separately from the all-band count, so the `Gate CLEARED` line cannot fire off Isaac creep plus a content drop. One flag or a second line; small, and it belongs to the probe.

## R3 chunk plan (2026-09-02)

Decision: R3 is the **launch-window beat**, a third `steam-moment` type rendered by the existing Steam moments aggregator on `/`. The mature-library drift beat is parked (re-check condition in the Status header). This section is the whole spec — an implementer should not need the conversation that produced it. Where a choice was open, it is closed here; do not reopen it in the implementing session, note the disagreement in this file instead.

### What the beat says

One day-one title the owner played, its rarity curve while they played it, and the receipt of what they earned early:

> **Early on** *Beast of Reincarnation*
> **Corvus's End** was **0.7%** when you earned it. It's **28.4%** today.
> ⟋ (one curve: that achievement's global percentage across every observation we hold)
> Bestie 1.4% → 34.3% · Taurus's End 1.5% → 34.8% · Closest Companion 3.2% → 38.4% · …

The honest-copy rule from "Known limit, permanently" applies with one sharpening: **"when you earned it" is said only for an unlock that has a rarity sample no more than 3 days older than the unlock timestamp.** Unlocks without such a sample are not in the receipt at all. There is no "since we started watching" fallback copy on this beat — that framing belongs to the parked mature beat, and mixing them on one surface would blur what this one claims.

### Design decisions, closed

1. **Surface: a `steam-moment`, not a trophy-case sparkline or an achievement-card delta.** The recap is the only surface where "a game you played early moved 30 points under you" reads as a story rather than as a number beside a number, and the moments aggregator already gives it a masthead, a hero backdrop, a when-line and a receipt band for free. The trophy case and achievement card stay untouched by R3; a delta glyph there is a separate, smaller idea that R2's data does not yet justify for settled titles.
2. **Gate on a captured curve, not on the window being open.** Eligibility is "we observed this game while it was inside its launch window and the owner earned bracketed unlocks during that span" (rules below). Whether the beat still shows is left to the selector's recency decay via `daysSince`, exactly like every other moment. Nothing checks "is the game still ≤ 60 days old" at render time, so the Beast curve stays on the page as long as its score clears the floor and then ages out like a cluster does.
3. **One curve, one headline, one receipt.** The descriptor carries the headline unlock's series and up to five receipt rows. It does not carry per-achievement series for the receipt, a whole-game aggregate curve, or the rare-band count. Twelve lines would be a dashboard; the design spec's rejected-experiments list already says what happens when a beat renders fifteen numbers at once.
4. **Ranking is relative, guarded absolute.** Receipt rows are the owner's bracketed unlocks with `percentNow − percentAtUnlock ≥ 1.0pp` (ten quanta, so no row is rounding), ordered by `percentNow / max(percentAtUnlock, 0.05)` descending, ties by absolute delta descending. The headline is row one. Using `0.05` as the floor denominator turns a reported `0` into a lower bound on the ratio rather than a division by zero, and `formatRarityPercentEditorial` renders the origin as `<0.1%`, which is the true statement.
5. **Score is the headline's absolute gain.** `baseSignal = min(headlineDeltaPp, 30) × 0.5` → Beast's +36.9pp lands at 15 on day 0 and crosses the floor of 5 after about 22 days without a new unlock. A cluster of five unlocks is the comparison point; this beat is meant to outrank a cluster on a fresh launch and lose to it three weeks later.
6. **`daysSince` is days since the newest bracketed unlock**, not since release or since the last observation. "Freshest owner signal" is what every other detector uses and what the when-line (`3 days ago`) means to a reader.
7. **Complementary to a `steam-subject` on the same appid, like `ACHIEVEMENT_CLUSTER`.** No dedupe against "Playing lately". It does join the dormant top-up exclusion set, which already spans every steam-moment type.
8. **No count-up, no VerdictProse.** The body is static prose with `Accent` spans, same as the cluster body. The percentages are the story; animating them would put three tweens in a sentence the spec wants read, not watched.
9. **Curve is the inline `<Sparkline>` scaled up, not `UnlocksPerWeekBand`.** The band primitive is a header-band shape (filled area, end caps, content width) for the Steam subject chapter; this curve sits inside a receipt beneath prose and wants to read as a stroke. Render `<Sparkline>` at 240×48 with `strokeWidth={1.5}` and the accent colour. If a third editorial curve appears later, factor a `ChapterCurve` then, per the design spec's 3-repeats rule.
10. **Server does the work, shared owns the maths.** A pure `deriveLaunchDrift()` in `packages/shared/src/steam/launch-drift.ts` takes plain rows and returns the stats or `null`; the api detector only queries and calls it. Same split as `deriveSteamGameRecap` → `SteamGameRecap`.

### Shared types (chunk 1 owns these; chunks 2 and 3 import them)

In `packages/shared/src/home/recap-chapter.ts`, beside `SteamAchievementClusterStats`:

```ts
/** One owner unlock on a launch-window title, with the global rarity Steam
 *  reported at the most recent observation before the unlock (never more than
 *  LAUNCH_DRIFT_SAMPLE_MAX_AGE_MS older) and the current value. */
export interface SteamLaunchDriftUnlock {
  apiName: string;
  displayName: string;
  unlockedAt: string;        // ISO
  percentAtUnlock: number;   // raw value Steam sent, may be 0
  percentNow: number;
}

export interface SteamLaunchDriftStats {
  releaseDate: string;         // ISO date (yyyy-mm-dd) from SteamGameEnrichment.releaseDate
  observedFrom: string;        // ISO, first history row for the game
  observedTo: string;          // ISO, last history row for the game
  observationCount: number;    // distinct observation timestamps for the game
  bracketedUnlockCount: number;// owner unlocks with a qualifying sample, before the 1.0pp filter
  headline: SteamLaunchDriftUnlock;   // === receipt[0]
  curve: number[];             // headline apiName's percent per observation, ascending observedAt, ≥ 2 points
  receipt: SteamLaunchDriftUnlock[];  // 1–5 rows, ranked per decision 4
}
```

`SteamMomentChapterDescriptor.momentType` becomes `"ACHIEVEMENT_CLUSTER" | "FIRST_TIME_GAME" | "LAUNCH_RARITY_DRIFT"`, and the descriptor gains `launchDrift: SteamLaunchDriftStats | null` after `cluster`. In `recap-scoring.ts` the `steam-moment` `RecapCandidate` variant gains `launchDrift?: SteamLaunchDriftStats | null` and `toDescriptor` passes it through as `candidate.launchDrift ?? null`. Update the doc comment on the descriptor that lists which chunk shipped which type.

In `packages/shared/src/steam/launch-drift.ts`:

```ts
export const LAUNCH_DRIFT_SAMPLE_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;
export const LAUNCH_DRIFT_MIN_DELTA_PP = 1.0;
export const LAUNCH_DRIFT_MIN_RECEIPT_ROWS = 3;   // fewer → no candidate
export const LAUNCH_DRIFT_RECEIPT_CAP = 5;
export const LAUNCH_DRIFT_DELTA_CAP_PP = 30;
export const LAUNCH_DRIFT_SIGNAL_FACTOR = 0.5;
export const LAUNCH_DRIFT_FLOOR_PERCENT = 0.05;   // denominator floor; same constant as the rarity formatter's sub-resolution bound

export interface LaunchDriftObservation { apiName: string; percent: number; observedAt: Date }
export interface LaunchDriftUnlockRow { apiName: string; displayName: string; unlockedAt: Date; percentNow: number | null }

export interface LaunchDriftInput {
  releaseDate: Date;
  observations: readonly LaunchDriftObservation[]; // ascending observedAt, all achievements of the game
  unlocks: readonly LaunchDriftUnlockRow[];
}

export function deriveLaunchDrift(input: LaunchDriftInput): SteamLaunchDriftStats | null;
export function launchDriftBaseSignal(stats: SteamLaunchDriftStats): number;
export function launchDriftDaysSince(stats: SteamLaunchDriftStats, now: Date): number;
```

`deriveLaunchDrift` algorithm, in order: (a) group observations by `apiName`, keep ascending order; (b) for each unlock, find the latest observation of its `apiName` with `observedAt ≤ unlockedAt`; discard the unlock if none exists, if it is older than `LAUNCH_DRIFT_SAMPLE_MAX_AGE_MS`, or if `percentNow` is null; the survivors are the bracketed set; (c) filter to `percentNow − percentAtUnlock ≥ LAUNCH_DRIFT_MIN_DELTA_PP`; (d) if fewer than `LAUNCH_DRIFT_MIN_RECEIPT_ROWS` remain, return `null`; (e) sort per decision 4, slice to the cap; (f) `curve` is the headline's full series as numbers; return `null` if it has fewer than 2 points (cannot happen after (b) with ≥ 1 later observation, but the guard keeps `<Sparkline>`'s own `< 2 → null` from ever being the thing that hides a beat). `observationCount` counts distinct `observedAt` values across the game. `launchDriftBaseSignal` is `Math.min(headline delta, LAUNCH_DRIFT_DELTA_CAP_PP) * LAUNCH_DRIFT_SIGNAL_FACTOR`. `launchDriftDaysSince` is `max(0, floor((now − max(receipt.unlockedAt)) / day))`.

Export everything from the barrel `packages/shared/src/index.ts` next to the other `./steam/*.ts` lines (types via `export type`).

### Chunks

Each chunk is one commit, each carries its tests, each leaves `verify:cc` green. Chunk 2 depends on chunk 1; chunk 3 depends on chunk 1 only, so 2 and 3 can be separate sessions in either order.

#### Chunk 1 — shared types and the deriver

**Files:** `packages/shared/src/home/recap-chapter.ts`, `packages/shared/src/home/recap-scoring.ts`, `packages/shared/src/home/recap-scoring.test.ts`, `packages/shared/src/steam/launch-drift.ts` (new), `packages/shared/src/steam/launch-drift.test.ts` (new), `packages/shared/src/index.ts`.

**Copies:** the `SteamAchievementClusterStats` doc-comment style and the `deriveSteamGameRecap` deriver-in-shared pattern (`packages/shared/src/steam/game-recap.ts` and its test).

**Tests (`launch-drift.test.ts`), each a named `it`:** returns `null` with no observations; returns `null` when every unlock predates the first observation; discards an unlock whose nearest earlier sample is 4 days old and keeps one at 2 days; discards a row with a +0.9pp delta and keeps +1.0pp; returns `null` with two qualifying rows and stats with three; ranks `0 → 5.0` (floor denominator, ratio 100) above `2.0 → 20.0` (ratio 10) above `10.0 → 40.0` (ratio 4, larger absolute); breaks a ratio tie by absolute delta; caps the receipt at 5 and sets `headline === receipt[0]`; `curve` is the headline's series only, ascending, and includes observations after the unlock; `observationCount` counts distinct timestamps not rows; `launchDriftBaseSignal` caps at `30 × 0.5 = 15` for a +36.9pp headline and returns `0.5` for +1.0pp; `launchDriftDaysSince` clamps at 0 for a future timestamp. Use the Beast numbers from the third reading as the fixture (`Corvus's End` 0.7 → 28.4, `Bestie` 1.4 → 34.3, `Munitions Master` 0.1 → 5.7) so the fixture is also documentation. In `recap-scoring.test.ts`, add one steam-moment candidate with `launchDrift` set and assert `toDescriptor` carries it through and `null`s it when absent.

**Web typecheck note:** adding the third `momentType` literal breaks nothing at compile time in `apps/web` because `momentCopy` falls through to the cluster branch and `momentAccentClass`'s `switch` has no exhaustiveness assertion — check both and, if either has gained a `never` guard since this was written, add the minimal case in this chunk so the shared change stays green on its own.

#### Chunk 2 — api detector

**Files:** `apps/api/src/recap/steam-moments.service.ts`, `apps/api/src/recap/steam-moments.service.spec.ts`, `apps/api/src/recap/recap-subjects.service.ts` (comment-only unless the check below fails).

**Copies:** `detectAchievementClusters` in the same file — its query-then-group shape, its curation handling (`excludeUnfeaturedGames` on the joined rows, `game.removedAt === null`, non-game `appType` exclusion via the separate enrichment lookup), its candidate literal, and its place in `detectAll`'s `Promise.all`.

**`detectLaunchRarityDrift(now, curation)`**, added to `detectAll`:

1. Import `LAUNCH_WINDOW_MS` from `../steam/global-rarity.poller` (the same constant the poller uses to pick daily-sampled titles, so "captured while in the window" means the same thing on both sides).
2. `steamGameEnrichment.findMany({ where: { releaseDate: { not: null, gte: new Date(now − LAUNCH_WINDOW_MS − 120 days) } }, select: { appid, releaseDate, appType } })`. The 120-day tail is not an eligibility rule; it bounds the query so a library with years of enrichment does not load every row. Eligibility is decided in step 4.
3. `steamAchievementRarityHistory.findMany({ where: { appid: { in: appids } }, orderBy: { observedAt: "asc" }, select: { appid, apiName, percent, observedAt } })` and `steamPlayerUnlock.findMany({ where: { appid: { in: appids } }, select: { appid, apiName, unlockedAt, achievement: { select: { displayName, game: { select: { name, removedAt } }, rarity: { select: { percent } } } } } })`. Two queries, not a join through history — history has no relation to unlocks, and the derive step wants both lists whole.
4. Per appid: skip if no history rows or no unlocks; skip if `game.removedAt !== null`, if `appType` is not a game (same predicate `detectAchievementClusters` uses), or if `excludeUnfeaturedGames` drops it; **skip unless the first history row's `observedAt` is ≤ `releaseDate + LAUNCH_WINDOW_MS`** — that is the "captured while in the window" rule. Build `LaunchDriftInput` (`percentNow` from `achievement.rarity?.percent ?? null`) and call `deriveLaunchDrift`. `null` → no candidate.
5. Emit `{ kind: "steam-moment", slug: \`steam-moment-launch-drift-${appid}\`, momentType: "LAUNCH_RARITY_DRIFT", appid, name, baseSignal: launchDriftBaseSignal(stats), daysSince: launchDriftDaysSince(stats, now), launchDrift: stats }`.

**`recap-subjects.service.ts`:** confirm `allSteamMomentAppids` is built from every `steam-moment` candidate regardless of `momentType` (the comment says "both momentTypes"; the code should not enumerate literals). If it does enumerate, add the new literal. Extend the two comments that name `ACHIEVEMENT_CLUSTER` as the complementary case to name `LAUNCH_RARITY_DRIFT` beside it. No dedupe change.

**Tests (`steam-moments.service.spec.ts`), new `describe("SteamMomentsService.detectLaunchRarityDrift")`:** extend `makeService` with `history?: HistoryRow[]`, `rarityUnlocks?: LaunchUnlockRow[]` and `releaseDate?: Date | null` on `EnrichmentRow`; give `steamPlayerUnlock.findMany` a `mockImplementation` that returns `rarityUnlocks` when `args.where.appid` is present and the existing `unlocks` otherwise (mirror `ownedFindMany`'s dispatch-on-`where` pattern), and add `steamAchievementRarityHistory: { findMany }`. Cases: no enrichment inside the bound → `[]` and no history query issued; a game first observed 61 days after release → `[]` (window rule); the Beast fixture → one candidate with `momentType`, slug, `baseSignal` 15, `daysSince` computed from the newest receipt unlock, `launchDrift.headline.apiName` as expected; an unfeatured Beast → `[]` (pair with the previous case, same fixture minus curation, the way the first-time tests do); `detectAll` returns first-time + cluster + launch candidates concatenated. Use `NO_CURATION` from `@vyoh/shared` as the other specs do.

**Live check before commit:** `curl -s localhost:<api port>/recap/chapters | jq '.chapters[] | select(.momentType == "LAUNCH_RARITY_DRIFT") | {name, score, daysSince, headline: .launchDrift.headline}'` should print Beast of Reincarnation and Mortal Shell II (or whichever launch titles the history holds by then). If it prints nothing, run the probe and check the "Launch cohort" line before debugging the detector — an empty cohort is a data state, not a defect.

#### Chunk 3 — web beat

**Files:** `apps/web/src/home/recap/steam-moment-beat.tsx`, `apps/web/src/home/recap/steam-moment-beat.test.tsx`, `apps/web/src/home/recap/steam-moments-aggregator.tsx`, `apps/web/src/home/recap/moment-accent.ts`, `apps/web/src/home/landing-config.ts` (comment + a commented fixture), `apps/web/src/home/recap/use-chapters.ts` (comment naming the third type).

**Copies:** the `ACHIEVEMENT_CLUSTER` branch end to end — `momentCopy` (eyebrow / masthead / leadingVisual / chapterLabel / ariaLabel / body), `clusterBody`'s `Accent` usage, `entranceForType`'s per-type timings, and the cluster receipt block (`ChapterDetail` › `ChapterReveal delay={entrance.receiptDelay}` › headline row + italic proof line).

**`SteamMomentBeatProps`** gains `launchDrift: SteamLaunchDriftStats | null`; the aggregator passes `launchDrift={m.launchDrift}`.

**`momentCopy`, new branch before the cluster fallthrough** (`momentType === "LAUNCH_RARITY_DRIFT"`):
- `eyebrow: "Early on"`, `mastheadText: name`, `chapterLabel: "Early"`, `ariaLabel: \`Early achievements on ${name}\``.
- `leadingVisual`: lucide `TrendingUp`, same class string as `Award` in the cluster branch.
- `body: launchDriftBody({ launchDrift, accentClass })`, where the body is: `<A>{headline.displayName}</A> was <A>{formatRarityPercentEditorial(headline.percentAtUnlock)}</A> when you earned it. It's <A>{formatRarityPercentEditorial(headline.percentNow)}</A> today.` With `launchDrift === null` (dev override without stats) render `Got there before the crowd did.` so the beat never throws on a partial descriptor. Import the formatter from `@/steam/_shared/rarity-percent`.

**`entranceForType`** case: `{ mastheadBlur: 16, mastheadRise: 22, mastheadDuration: 1.2, taglineDelay: 0.45, bodyDelay: 0.7, receiptDelay: 0.95 }` — cluster pacing; the receipt is the last beat, the curve draws in with it.

**`moment-accent.ts`:** `case "LAUNCH_RARITY_DRIFT": return "text-indigo-300";` with a two-line comment in the file's register: cool and unused elsewhere on the page, so "you were early" sits apart from the fuchsia cluster and the teal first-time on a mixed aggregator.

**Receipt block** (rendered when `launchDrift` is non-null, after the cluster block, same wrapper structure):
- Row 1, `flex flex-wrap items-baseline gap-x-4 gap-y-2 sm:gap-x-6`: `<span className="text-2xl font-semibold tabular-nums text-foreground sm:text-3xl" style={{ textShadow: SHADOW_MASTHEAD }}>{formatRarityPercentEditorial(at)} → {formatRarityPercentEditorial(now)}</span>` — write the arrow as `<span aria-hidden="true">→</span>` with a sibling `<span className="sr-only">to</span>`; then the `·` separator span the cluster uses; then `<span className="text-sm tabular-nums text-foreground/80">{observationCount} readings over {days} days</span>` where `days` is `Math.max(1, Math.round((observedTo − observedFrom) / day))`.
- Row 2: `<Sparkline data={launchDrift.curve} width={240} height={48} strokeWidth={1.5} stroke="currentColor" className={\`${accentClass} h-12 w-60 max-w-full\`} aria-label={\`${headline.displayName} global unlock rate, ${first} to ${last}\`} role="img" />` — `Sparkline` spreads `...rest` onto the `<svg>` and reads `aria-label` itself, so both attributes land without a wrapper; do not pass `tooltip`, the receipt row already names the endpoints.
- Row 3, the proof line, `max-w-prose text-sm italic text-foreground/70`: `receipt.map(r => \`${r.displayName} ${fmt(at)} → ${fmt(now)}\`).join(" · ")`, and when `bracketedUnlockCount > receipt.length` append ` · and ${n} more earned early`.

**Tests (`steam-moment-beat.test.tsx`), new `describe("SteamMomentBeat (LAUNCH_RARITY_DRIFT)")`** using the same `mockRecap()` / `baseProps` scaffolding with `momentType: "LAUNCH_RARITY_DRIFT"`, `firstTime: null`, `cluster: null`, and a `launchDrift` fixture built from the Beast numbers: renders the `Early on` eyebrow and the game-name `h2`; the body contains `0.7%`, `28.4%` and `when you earned it`; the headline row shows `<0.1%` for a `percentAtUnlock` of `0` (regression for the floor rule); the proof line lists every receipt `displayName` joined by `·`; `and N more earned early` appears only when `bracketedUnlockCount > receipt.length`; the sparkline `svg` has `role="img"` and an `aria-label` naming the headline; `launchDrift: null` renders the fallback sentence and no receipt block; the masthead links to `/steam/library/$appid` (copy the existing `a[to=…]` assertion). Extend `steam-moments-aggregator.test.tsx` only if it snapshot-asserts props; otherwise add one case that a `LAUNCH_RARITY_DRIFT` descriptor renders a beat (count `[data-beat]`). Run the axe scan pattern from `accessibility.test.tsx` on the new branch in the beat test file.

**Visual review:** put one descriptor in `DEV_STEAM_MOMENT_OVERRIDE` (appid 2001760, Beast of Reincarnation, `momentType: "LAUNCH_RARITY_DRIFT"`, the Beast fixture as `launchDrift`), check `/` in Chrome and Firefox, then reset it to `[]` before staging. Leave the fixture as a commented block below the override, matching the comment already there, so the next review does not rebuild it.

**Skeleton:** the moments aggregator has no per-type skeleton (it renders from the descriptor, and the per-beat recap query only feeds the tagline), so the skeleton convention is satisfied by inheritance — state that in the commit message rather than adding one.

### Not in R3

- Any trophy-case or achievement-card drift indicator (settled titles do not move; see the third reading).
- Per-receipt-row sparklines, a game-wide rare-band curve, or a rarity-at-unlock column anywhere outside this beat.
- Re-sampling history to true daily cadence — that is hosting (the process must be up at 05:30), tracked in the ops notes.
- Backfilling `percentAtUnlock` for unlocks older than their nearest sample. The known-limit section says why it cannot be done.

## Pointer hygiene

The trigger fired and is recorded above (third reading, 2026-09-02). From here the Status header tracks chunk shipment: update it and the R3 row in the same commit as each chunk. The mature-library re-check condition (a settled rare-band series ≥ 5pp or 2× from a non-zero origin) lives in the Status header; move it to [parked.md](../parked.md) only if the launch beat ships and the mature beat is still blank a season later.
