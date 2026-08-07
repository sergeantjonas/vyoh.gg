# Steam achievement rarity drift

**Status:** Active — plan written 2026-08-07, nothing built. R1 (history table + append-on-change) is the only chunk worth doing now; R2 and R3 are gated on elapsed time, not on effort. The arc exists because the data has a lead time: every week without R1 is a week of curve that cannot be reconstructed later.

## Today's behaviour

Global rarity is a **current value, refreshed, with no history**.

- [global-rarity.poller.ts](../../../apps/api/src/steam/global-rarity.poller.ts) selects every game whose `lastRarityCheckedAt` is older than 7 days, daily at 05:30 Europe/Brussels, 40 games per pass, boot-reconciled. So a displayed percentage is at most ~7 days stale.
- [global-rarity.service.ts:60-73](../../../apps/api/src/steam/global-rarity.service.ts#L60-L73) upserts `SteamAchievementGlobalRarity` in place — `update: { percent, polledAt }`. Every refresh destroys the previous value.
- [schema.prisma:356-365](../../../apps/api/prisma/schema.prisma#L356-L365) PKs the row on `(appid, apiName)`. One row per achievement, one `percent`, forever.
- `polledAt` never crosses the API boundary. No read-side consumer exists.

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

**1. Steam publishes one decimal.** All 91 moves were exactly ±0.10pp, with zero smaller moves in 857 comparisons. That is the endpoint's real precision, not our rounding — so `.toFixed(1)` at [rarity-percent.tsx:27](../../../apps/web/src/steam/_shared/rarity-percent.tsx#L27) shows exactly what Steam knows, and sub-0.1pp drift is invisible by construction. **This decides the append predicate** (see R1).

**2. Direction is per-game, and both mechanisms are visible.** Nioh 3 is a recent release with a growing owner base, and *every* one of its 33 moves is negative — new owners entering the denominator having unlocked nothing. The settled back-catalogue games move up as remaining owners grind. Dark Souls III has stopped moving entirely.

**3. The rare band is stickier than the common band.** 12 of 324 sub-10% achievements moved, against 91 of 857 overall. A 0.1pp step at 2% needs a 5% relative shift in the owner base; at 60% it needs 0.17%.

**4. The band we actually display did not move at all.** The rarest twelve owner-unlocked achievements (1.9%–5.1%, i.e. what the trophy case shows) moved 0.000pp over the window. Across all owner-unlocked rows, 41 of 321 moved.

## Framing decision

The headline beat — *"0.3% when you got it, 1.9% now"* — **will not happen for the existing library**, and the note records that up front so nobody re-pitches it. Those games are settled; finding 4 says the rare end of a back-catalogue game moves at roughly nothing per week. Building history against what's already on the shelf produces a chart of flat lines.

Where it lands is Nioh-3-shaped: a game bought near release, where percentages fall steeply as sales grow the owner base. Unlock something at 2% in launch week and a year later it is genuinely rarer-looking. **That story only exists going forward, and only if the recording starts before the interesting games arrive.**

Two consequences:

- R1 is worth doing now *despite* having no visible payoff now. That is unusual for this repo and is the whole argument — deferring costs a year of curve, and the migration is an afternoon.
- R3 (the UI) must not be built on spec. It ships when R2's diagnostic shows a game with a real slope, and not before, or it renders twelve flat lines and reads as a bug.

## Chunk plan (2026-08-07)

| # | What | Where | Notes |
|---|---|---|---|
| R1 | History table + append-on-change | Prisma migration + `apps/api/src/steam` | The only chunk to do now. `SteamAchievementRarityHistory(appid, apiName, percent, observedAt)`, FK to `SteamGameAchievement` like the current-value row. `refreshRarity` appends **only when the value moved**; the existing `SteamAchievementGlobalRarity` upsert stays exactly as-is. Seed one history row per existing rarity row from its current `percent` + `polledAt` (9,085 rows) so every series has an origin instead of starting at its first move. Tests alongside per project policy. No read-side change, no API change, no web change. |
| R2 | Drift diagnostic script | `apps/api/src/scripts` | A one-off reader — for each achievement with ≥2 history rows, report span, endpoints, and slope; rank by absolute and relative movement. Follows the `backfill-remake-flag.ts` shape. This is the **gate on R3**: run it periodically and build the UI when it names a game with a visible slope in the rare band. Cheap enough to write with R1, but useless until history accumulates, so it can wait. |
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

When R1 ships, update the Status header and the [open-work.md](../open-work.md) index line with the migration date and the seeded row count. When R2's diagnostic first reports a game with a real slope, record the numbers here — that reading is the trigger that unblocks R3, and it should be written down rather than remembered.
