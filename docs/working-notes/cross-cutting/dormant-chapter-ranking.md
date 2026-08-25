# Dormant chapter ranking

**Status:** **Shipped 2026-08-25.** D1 (a 25% completion gate, so benchmark hours can't pass as play), D2 (the brief-launch guard now governs the unlock half of `freshest` too), and the review prompt now leads with the game that has hours behind it. Verified against the live api: the gate removed Cyberpunk from the chapter list and Resident Evil 4 backfilled the slot, as predicted. The sort order is unchanged and *correct* — `/` is a current-activity portrait, and the first draft's proposal to rank on lifetime hours was wrong for reasons the code had already recorded. Cyberpunk needs no `unfeaturedAt` row and has none.

Read this when: touching `collectDormantTopUp` in [recap-subjects.service.ts](../../../apps/api/src/recap/recap-subjects.service.ts), adding a signal to chapter scoring, or wondering why a specific game is or isn't a chapter.

## The framing that settles most of this

**`/` shows what the owner is playing now.** Everything else is subordinate to that. The dormant lane exists only so the Steam block doesn't collapse during a quiet fortnight — it is filler with an honest label ("Earlier this year on…"), not a greatest-hits chart. A dormant chapter's job is to be the *closest thing to current* among games that aren't current.

That framing kills the obvious-looking fix. Ranking the lane by lifetime hours would put a 434-hour Nightreign at the top of the Steam block permanently, months after it was last touched, on a page about right now.

It is also a decision this repo already made, in `collectSteamSubjectCandidates`:

> `baseSignal` models *recent engagement*, not historical depth. An earlier formulation used `playtimeForeverMinutes + lifetimeUnlocks × 0.5`; that let a brief re-launch of a high-lifetime game (e.g. 67h Silksong opened for 3 min) dominate over an active recent playthrough (RE2 played for hours that week). […] If we later want broader-freshness coverage, it should be a separate chapter kind ("Greatest hits"-shaped), **not a tweak to subject scoring.**

So magnitude has a designated home, and it is not here. **Nightreign ranking 11th is correct behaviour, not a defect** — that was the first draft's central error.

## What must keep working

Stated as an invariant before any change, because it is the case most at risk from a clumsy fix: **a new game played 10 hours on release day is the strongest thing on the page and must rank above the entire dormant lane.**

It does today, and not by out-scoring anything. `baseSignal = 600/60 = 10` against `RECAP_SCORE_FLOOR = 5` puts it in the **active** lane, and `getChapters` assembles `[...lolMoments, ...steamSubjects(active), ...dormant, ...steamMoments]` — active subjects precede dormant ones structurally. Nothing in the dormant lane can reach it.

The corollary for D2 below: the freshness guard governs the **dormant** lane only, and its threshold must stay low enough that real play never falls through it. Raising `BRIEF_LAUNCH_2W_MINUTES` is **not** part of the fix — a two-hour session on a dormant game is real engagement and must refresh its position. The bug is the bypass, not the threshold.

## What the lane does

Before, and after the two fixes:

```
was: appType 0/null → lifetime ≥ 5h                     → freshest = max(lastUnlock, lastPlayed)          → sort freshest desc → take(slack)
now: appType 0/null → lifetime ≥ 5h → completion ≥ 25%  → freshest = max(lastUnlock*, lastPlayed*)        → sort freshest desc → take(slack)
                                                          * both nulled when the last session was brief
```

`lifetimeHours` is a floor and the magnitude the web displays; it is not part of the ordering. Note also that the lane is spliced in by `getChapters` **after** `selectChapters` has run, so it never passes through `recapScore` and has **no score floor** — unlike the active lane, which drops anything under `RECAP_SCORE_FLOOR = 5`.

## Evidence

Uncurated, game-type, >14 days idle, in the order the lane emitted **before** the gate. The cap of 5 ended the list at Silksong:

| # | game | hours | completion | idle |
|---|---|---|---|---|
| 1 | Resident Evil Requiem | 43 | 100% | 36d |
| 2 | **Cyberpunk 2077** | 36 | **19%** | 48d |
| 3 | Sekiro | 54 | 100% | 69d |
| 4 | Resident Evil 4 | 26 | 100% | 74d |
| 5 | Hollow Knight: Silksong | 67 | 100% | 84d |

Completion across all 51 candidates (≥5h lifetime, tools included):

| completion | games | avg hours |
|---|---|---|
| 100% | 20 | 86 |
| 75–99% | 4 | 83 |
| 50–74% | 8 | 34 |
| 25–49% | 5 | 51 |
| 0–24% | 10 | **14** |
| no schema | 4 | 65 |

## Findings

**D1 — the lane cannot tell play from time-at-the-executable.** Originally written as "cannot tell a completion from an abandonment", which the owner corrected on 2026-08-25: Cyberpunk isn't abandoned, it's *unstarted* — the 36 hours are largely **in-game benchmark runs used for hardware stress-testing**, and a solid playthrough is still pending. So the lane's blind spot is broader than abandonment. It ranks on `freshest` and floors on `playtimeForeverMinutes`, and neither can distinguish 36 hours of benchmark loops from 36 hours of playing.

This is not a Cyberpunk quirk. In-game benchmarks ship in plenty of titles, and two others in the low-completion band are exactly the sort that get used that way — Shadow of the Tomb Raider (0–24%) and Rise of the Tomb Raider (25–49%).

**Session shape would be the truer signal, and the data doesn't reach.** A benchmark run is a short repeated session; a playthrough is long ones. `SteamPlaySession` shows precisely that where it has coverage — 3DMark: 3 sessions, 2-minute median. But the table only starts when the 2-minute player-state poller shipped, so Cyberpunk has fewer than three tracked sessions and its benchmark history is entirely invisible to it. **Dead end for diagnosing existing hours**, and worth knowing before anyone reaches for it: session shape can only classify games played from here on.

**D2 — a single round can re-top the lane, and the guard meant to stop it doesn't.** Two compounding holes:

- `BRIEF_LAUNCH_2W_MINUTES = 30` is a hair-trigger. One round of most games clears 30 minutes, so `brieflyLaunched` is false and `lastPlayed` refreshes to today.
- Worse, the guard is *bypassable even under* 30 minutes. It nulls `lastPlayedMs` only, while `freshest = max(lastUnlockMs, lastPlayedMs)` reads the ungated `lastUnlockMs`. Pop one achievement in a ten-minute session and today's date reaches `freshest` anyway.

Since the lane has no score floor either, the result is that touching a dormant game at all promotes it to the top of the Steam block. The guard's own comment states the intent it fails to deliver — *"if the user launched it for testing/checking, we don't want it crowding RE3/RE4 sessions that were real play"*.

**D3 — completion is bimodal here, so it works as a gate and not as a sort key.** 20 games at 100% averaging 86h against 10 at ≤24% averaging **14h**. Twenty games tie at the top, so it can never order the lane. Cyberpunk at 36h/19% is the outlier *inside* the abandoned group — the only one with real hours behind it, which is why no hours-based intuition caught it and a human had to.

**D4 — completion is a proxy for completionism, not for "did you finish it."** The 25–49% bucket holds Portal 2, Rise of the Tomb Raider, Saints Row IV, Borderlands GOTY: finished campaigns with grindy or multiplayer achievement sets attached. A 50% gate would drop them and be wrong. 25% is defensible only because the distribution is empty there — it is a line drawn at a gap, not a principled threshold.

**D5 — two guards are load-bearing in ways their code doesn't advertise.** `DORMANT_LIFETIME_FLOOR_HOURS = 5` is inert: the smallest real candidate is Resident Evil 3 at 7h. What actually keeps the lane clean is the `appType` filter — Wallpaper Engine (181h) and 3DMark (87h) outrank every real game on hours. Any future work that touches hours must treat that filter as safety-critical rather than cosmetic. Separately, 4 games carry no achievement schema (RIFT, Witcher 1, Fallout 3 GOTY, CoD MW; 65h average), so a completion rule without an explicit unknown branch silently drops them.

**D6 — the quarantine suppresses the release-day chapter, and that is the point.** Not a finding against the design; recorded here so nobody later reads the symptom as a bug and "fixes" it.

Chapter selection calls `curationForChapters()` → `getCuration()`, the **public** projection with both axes applied, and `/` is deliberately not viewer-aware. A newly-purchased game arrives from the poller with `hiddenAt` set, so `getOwnedGames(curation)` drops it from the steam-subject pool *and* from `detectFirstTimeGames`. Both chapters a release-day binge would earn — the "Playing lately" subject and the FIRST_TIME_GAME moment — are suppressed together, for the owner as well as for visitors.

**Confirmed as intended by the owner, 2026-08-25:** *"I don't want everyone to see I had a binge session of an adult game, so by default it should hide it until I allow it to show."* The high-engagement new purchase is not an unfortunate casualty of the privacy default — it is the **primary case the default exists for.** A quiet 40-minute curiosity needs hiding far less than a 10-hour weekend does, so the more the page would want to say about a new game, the more likely it is that saying it is the wrong call. The suppression scales with the risk, which is the correct direction.

Three consequences to preserve:

- **Never auto-publish past an engagement threshold.** This is the single most tempting "improvement" here and it inverts the feature: the threshold would fire hardest on exactly the games the owner most wants held back.
- **The prompt's absence from `/` is fine.** It lives in the Steam section root, so an owner who only visits `/` may not see it for a while — but the failure direction is *stays private*, which is the safe one. Do not "fix" this by moving the prompt to `/`.
- **Order the review prompt by recent engagement anyway.** Not to hurry a publish — to lead with the game the owner actually has a decision to make about, in either direction. A 10-hour quarantined game should be the first row, not an arbitrary one. Small, independent of D1 and D2, and the cheapest item in this note.

## What shipped

Two changes, both small, neither touching the sort order.

**1. Completion gate (D1).** Candidates below 25% completion are dropped. `no schema` and `achievementCount = 0` **pass** — absence of a schema is not evidence of abandonment (D5). `DORMANT_MIN_COMPLETION` carries the reasoning at the constant.

**2. The freshness guard governs the whole signal (D2).** `freshest` should be anchored on the last *substantial* session, which is what the brief-launch floor was reaching for. Concretely: when a session fails the floor, neither its playtime nor the unlocks it produced should carry into `freshest`. That means gating the unlock timestamp on the same session evidence rather than taking an all-time `max(unlockedAt)`. Leave the 30-minute threshold where it is — see the invariant above; raising it would suppress real play, and it fixes nothing anyway, since the unlock path routes around any threshold.

Keep the `appType` filter and the 5h lifetime floor as they are.

## Shipped 2026-08-25, and verified against the live api

The predicted effect held. Before: three active subjects left slack for two dormant rows, which went to Cyberpunk (48d) and Sekiro (69d). After: **Sekiro and Resident Evil 4** — the gate removed Cyberpunk and the next-best dormant game backfilled its slot.

One thing not to misread: Resident Evil Requiem is also absent, and that is the **pre-existing** brief-launch guard rather than either new change. It was launched briefly on 2026-08-25 and correctly re-dates to its March playthrough (last unlock 2026-03-30), which drops it below Sekiro and RE4.

**The benchmark signature is directly visible, and suggests a better signal than completion.** Cyberpunk's last unlock is 2025-06-10 while its last launch is 2026-07-07 — fourteen months of launches with zero achievement progress. That is what benchmark use looks like in this data, and it is a sharper statement than "19% complete".

The refinement worth remembering: **an unlock gap only means something while achievements remain.** Silksong shows the same shape — last unlock 2025-10-10, last played 2026-06-02 — but it is 100% complete, so there was nothing left to earn and the gap is meaningless. So the signal is "launched repeatedly, achievements still available, none earned", not "gap between unlock and launch". That distinguishes benchmark use from a finished game re-launched later, which a flat completion gate cannot, and it needs no new data. Worth doing if the gate proves blunt.

## Considered and rejected

- **Rank by lifetime hours, decayed or not.** The first draft's proposal. It contradicts what `/` is for, and re-introduces the failure the `baseSignal` comment records as already-fixed. A high-lifetime game must not out-rank current play, and "hours" is the signal that makes it do so.
- **Rank by completion.** Twenty games tie at 100%. A gate, never a sort key.
- **Rescue high-hours games from the completion gate.** Symmetrical-looking, and it re-admits Cyberpunk specifically — the one case this exists to handle. Hours must not buy past the gate.
- **Infer "finished" from the last unlock's global rarity** (`SteamGameGlobalRarity` is already populated). Probably the truest signal, since a story-ending achievement sits in a characteristic rarity band, but it needs per-game calibration and a schema-less fallback for a gain the 25% gate already delivers here. Revisit if the gate proves blunt.
- **Leave it and keep curating by hand.** Now weaker than it looks: it addresses D1 only, and D2 is a defect no amount of per-game curation can reach — any dormant game can be promoted by one round.

## Parked: the "Greatest hits" chapter kind

434 hours in Nightreign at 100% is a genuinely strong fact about the owner and the page currently has nowhere to put it. The existing comment already prescribes the shape — a separate chapter kind with a retrospective register of its own, scored on magnitude, sitting outside subject scoring so it cannot compete with current activity for the same slots. Not scoped. Worth doing before the library's best stories are all more than a year old.

## Resolved: the exception goes

The open question was whether Cyberpunk had been excluded for being unfinished or for being **off-identity** — the one open-worlder among twenty soulslike completions. Neither. Owner, 2026-08-25: *"I just haven't gotten around to doing a solid playthrough of cyberpunk, but I use the ingame benchmark a lot for stress-testing, but cyberpunk itself doesn't need an exception to the logic."*

So this is a data-quality problem, not an editorial one, and the fix belongs in the logic. **The `unfeaturedAt` row is deleted when the gate ships** — the blocklist is a surface expected to empty out, not a permanent one.

Two consequences for the gate:

- It produces the right answer here for a **partly wrong reason**. 19% completion excludes Cyberpunk because benchmark hours earn no achievements, which happens to look identical to abandonment. Fine in practice, and it self-corrects: once a real playthrough pushes completion past 25%, the game is admitted, which is exactly what should happen.
- It does **not** solve the general case. A benchmark-heavy game that also has a completed campaign would pass the gate carrying inflated hours. Harmless while nothing ranks on hours — and a reason not to start.
