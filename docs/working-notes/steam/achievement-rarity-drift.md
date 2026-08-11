# Steam achievement rarity drift

**Status:** Active — R1 shipped 2026-08-07 (history table, append-on-change, seeded from the 9,085 existing rarity rows). R2 and R3 stay gated on elapsed time, not on effort: nothing reads the table yet, and nothing should until there is a curve worth rendering. **R2's gate has its first candidate as of 2026-08-11** — Beast of Reincarnation moved 0.0 → 0.9–2.0% in six days, the launch-week shape the framing decision reserved this arc for. The same reading exposed a display defect at the bottom of the range, fixed the same day (see below).

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
| R2 | Drift diagnostic script | `apps/api/src/scripts` | A one-off reader — for each achievement with ≥2 history rows, report span, endpoints, and slope; rank by absolute and relative movement. Follows the `backfill-remake-flag.ts` shape. This is the **gate on R3**: run it periodically and build the UI when it names a game with a visible slope in the rare band. Cheap enough to write with R1, but useless until history accumulates, so it can wait. **It now has something to find** — Beast of Reincarnation cleared the gate condition by hand on 2026-08-11, so write R2 against a case with a known answer rather than against an empty table. |
| R3 | The drift beat | web + `packages/shared` | **Gated on R2, unscoped deliberately.** Shape is undecided because it depends on what R2 finds — a delta line on the achievement card, a sparkline in the trophy case, or a recap beat are all plausible and the data picks. Do not scope this before R2 has something to show. |

## Design decisions, settled up front

- **Append-on-change, not append-always.** At the measured ~10.6%-per-5-days move rate, append-on-change costs roughly 1,090 rows/week across the 9,085 tracked achievements — about 57k rows/year. Append-always would be ~472k/year for the same information. An order of magnitude, for free.
- **Compare on the rounded value, not the raw float.** Steam's real precision is one decimal (finding 1), but it serialises through a float32 and hands back values like `47.900001525878906`. Comparing raw floats risks appending representation noise as if it were drift. Round both sides to one decimal for the "did it move" test; store the raw value Steam sent.
- **Keep `SteamAchievementGlobalRarity` as the current-value row.** Do not derive "latest" from the history table. The read path is hot — every achievement panel, the trophy case, `use-cross-game-rarest`, the recap — and a `DISTINCT ON` per achievement would be a real regression bought for no benefit. History is append-only and write-side only until R3.
- **No retention policy, deliberately.** At ~57k rows/year this needs no pruning for the better part of a decade, and pruning is exactly the thing that would destroy the long spans the arc exists to accumulate. If someone later adds a cleanup pass here, that is a defect.
- **Games the owner no longer owns keep their history.** The poller already filters on `game.removedAt: null` so nothing new accrues, and the existing rows are harmless. Same reasoning as the absent stale-row cleanup documented at [global-rarity.service.ts:29-33](../../../apps/api/src/steam/global-rarity.service.ts#L29-L33).

## Known limit, permanently

`observedAt` records when *we* looked, never when the achievement was unlocked. Steam's unlock timestamps backfill retroactively ([schema.prisma:333-338](../../../apps/api/prisma/schema.prisma#L333-L338)), so the library's unlock history reaches back years while the rarity series can only ever start at R1. For everything already on the shelf, the honest framing is "since we started watching" — and any copy R3 ships has to say that rather than implying unlock-time. This gap cannot be closed by any amount of later work.

## Pointer hygiene

When R2's diagnostic first reports a game with a real slope, record the numbers here — that reading is the trigger that unblocks R3, and it should be written down rather than remembered. Until then the honest state of this arc is "recording, nothing to show", and the Status header should keep saying so rather than drifting toward "in progress".
