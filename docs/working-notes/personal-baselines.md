# Personal baselines — cross-cutting framing note

**Status:** Active — PB1 (doc-pass) + PB2 (weakest-matchup) + PB3 (patch-drift) all shipped 2026-05-14. PB4 (cross-tile anomaly aggregator) deferred until at least 2–3 more personal-baseline tiles ship past the current set. See [open-work.md](open-work.md).

Most stats sites benchmark against a global player base (*"your damage share is in the top 30% of ADCs at your rank"*). Vyoh's distinctive frame is the inverse: **you-vs-you**. *"Your damage share on Vex is +6pp above your own ADC baseline."* This note tracks where the pattern already exists, where it could extend, and the framing decision behind it.

Promoted to a working note because the question *"is this comparison against the world or against the player?"* surfaces in nearly every new tile we ship — and answering it consistently is part of the app's tonal identity.

---

## Premise

The genre default is to rank the user against everyone. Op.gg, u.gg, blitz, mobalytics — all of them sit on top of a "global percentile" computation. It's competitive in tone, gamified by construction, and useful only when the user actually wants to compare themselves to strangers.

Vyoh has, mostly by accident, drifted in a different direction. The strongest verdicts in the app are personal:

- *"Wide pool — consider focusing on 3 to climb faster"* — personal pool composition.
- *"Off-peak hour for you — 38% WR at Tue 23:00"* — personal time-of-day pattern.
- *"On a 3-game loss streak"* — personal cadence.
- *"Patch 14.20: 2-8, +X% from 14.19"* — personal patch delta.
- *"+18% damage share above your own ADC average"* — personal role baseline.

The you-vs-you frame is the calm-coaching frame. It removes the leaderboard. It assumes the user is the unit of analysis. It is also the harder-to-execute frame — global percentiles are easy because everyone has the same data; personal baselines require enough of the user's own history to be meaningful.

This note exists to make the pattern explicit so we apply it deliberately, not by accident.

---

## Where the pattern lives today

| Surface | Personal-baseline form |
|---|---|
| [`trend-champion-focus.tsx`](../../apps/web/src/lol/trends/trend-champion-focus.tsx) | Top-3 share of your own games. |
| [`trend-role-performance.tsx`](../../apps/web/src/lol/trends/trend-role-performance.tsx) | Each role's WR vs your overall, with the best/worst delta verdict. |
| [`trend-worst-matchup.tsx`](../../apps/web/src/lol/trends/trend-worst-matchup.tsx) | Pair-level WR among your matchups, not global. |
| [`trend-time-heatmap.tsx`](../../apps/web/src/lol/trends/trend-time-heatmap.tsx) | Your hour-of-week WR. |
| [`trend-kda.tsx`](../../apps/web/src/lol/trends/trend-kda.tsx) | Your KDA trajectory over the window. |
| [`trend-lp-economy.tsx`](../../apps/web/src/lol/trends/trend-lp-economy.tsx) | LP per game and accumulated, your data only. |
| [`trend-session-fatigue.tsx`](../../apps/web/src/lol/trends/trend-session-fatigue.tsx) | Your WR by game-of-session. |
| Champion detail delta tiles | Stats on this champion vs your own account average. |
| Patch history strip on Champion detail | This patch vs your previous patch — your own data. |
| LP history with streak overlay | Your snapshots only. |

The only places that explicitly use a **non-personal** baseline:

- [`role-baselines.ts`](../../apps/web/src/lol/_shared/role-baselines.ts) — static per-role damage-share and vision-score baselines (TOP 22%, JUNGLE 19%, MID 28%, BOT 30%, SUP 8%). Used by Phase T4 Phase-A trio (damage role consistency, vision investment, first-blood gold conversion). **These are role-population averages, not personal baselines.**
- [`trend-comeback-resilience.tsx`](../../apps/web/src/lol/trends/trend-comeback-resilience.tsx) — compares the user's comeback rate to a fixed 30% reference.

The role baselines are the principled exception. The user only has data on the role(s) they play; comparing their damage share to *their own damage share on the same role* would be vacuous. So we pull in a static baseline as the comparison surface — but the verdict still reads as "you vs the baseline for *your* role," not "you vs the world."

---

## Where the pattern could extend

In rough order of payoff:

### 1. Personal matchup baselines on Champion detail

The matchup table currently lists pair WR. Could add: *"vs Yasuo is your weakest matchup overall — 18% below your average"* as a verdict line. The data is in the same query.

### 2. Personal item-purchase consistency

Build-order Sankey shows item paths. Could surface: *"you build Ludens first on Vex 76% of the time and it wins 12pp more than your alt builds"*. Reads as a personal optimization hint, not a meta lookup.

### 3. Personal vision baseline by role (paired with the existing role-population baseline)

Today the vision tile in Trends compares user-vs-population. A second pass could add: *"your vision investment as MID has dropped 30 points over the last 30 days — you've stopped buying Sweeper."* The trajectory is the personal baseline, the population number is the absolute reference. Both belong on the tile.

### 4. Personal damage-pattern baseline

Currently the damage tile compares to the role population. A personal layer: *"your damage profile this window is 65% magic / 30% physical / 5% true — your usual is 80/15/5. You've been picking different champions."* Reads as "your composition has drifted," which is a personal-baseline statement about behavior, not performance.

### 5. Personal first-blood baseline by champion / role

The Phase T4 tile compares first-blood-kill-to-win conversion against the user's overall WR. Could extend to per-champion or per-role: *"first-blood on Lee Sin converts 70% of the time for you, vs 51% average across your account."* Picks up the "champion identity is signal" thread.

### 6. Cross-tile personal anomalies

Once we have enough personal baselines, an aggregator: *"two things are unusual this window: your vision is way up, your damage share is way down — you've been peeling more."* Reads as the system noticing patterns rather than printing tile-by-tile reads. Strong calm-coaching moment.

### 7. Personal patch-vs-patch baseline (already partially shipped)

Patch history strip on Champion detail compares this patch to the previous one. Could extend: *"on patch 14.20, your champion pool became 50% more concentrated"* (pool drift × patch boundary). New verdict, no new data.

---

## When to reach for a global / population baseline instead

The you-vs-you frame is the default, but population baselines belong on a small set of surfaces:

- **Role-specific absolute metrics** (damage share, vision score, CS at 10) — the population number is necessary because there's no personal alternative on the same role.
- **First-blood / comeback rates** — short-tail metrics where the user's own sample is too small for a stable personal baseline.
- **Optional comparison overlays** when the user explicitly opts in — *"compare to my rank's average"* could be a toggle on the relevant tiles. **No tile should default to a global comparison; it should be a deliberate user gesture.**

The principle: **the user is the unit of analysis. Global baselines are a reference, not a frame.**

---

## Practical work

### PB1 — Audit and label existing tiles — **shipped 2026-05-14**

Every tile file carries a top-of-file `// Baseline: <kind> — <one-liner>` marker so the kind is grep-able and visible at read-time. 26 files labeled across `apps/web/src/lol/trends/`, `apps/web/src/lol/champions/`, `apps/web/src/lol/profile/`, and `apps/web/src/lol/_shared/role-baselines.ts`.

Two audit findings:

- `trend-first-blood-conversion.tsx` was grouped with the T4 Phase-A role-population trio in the doc, but the code compares first-blood-game WR to the user's **overall WR** — it's a personal baseline, not role-population. Labeled as personal.
- `trend-lane-phase-prognosis.tsx` (not enumerated in the doc table) uses `ROLE_CS_AT_10` from `role-baselines.ts` and follows the same role-population pattern as damage/vision. Labeled as role-population.

Codified labels: `personal`, `role-population`, `fixed-reference`. A typed `Baseline` metadata field per tile (open question #2) remains optional — comments are sufficient until a tile-registry abstraction shows up.

### PB2 — Extend champion detail with personal-matchup verdict line — **shipped 2026-05-14**

- Helper: [`apps/web/src/lol/champions/weakest-matchup.ts`](../../apps/web/src/lol/champions/weakest-matchup.ts) — `buildWeakestMatchup()` filters matchups to `games ≥ 5`, picks the min-WR pair, and returns `{ champion, games, wr, baselineWr, deltaPP }` against the per-champion baseline (sum of matchup wins ÷ sum of matchup games).
- Render: [`$championKey.tsx`](../../apps/web/src/routes/lol/$accountSlug/champions/$championKey.tsx) renders a tone-tinted verdict line above the matchup grid: *"vs X — N% WR, Δpp below your B% baseline on this champion."* Warning tone when `deltaPP ≥ 15`, neutral otherwise. Suppressed entirely if no matchup meets the sample threshold.
- Sample threshold of 5 matches the codified value in open question #1 (matchup-level needs ≥ 5 same-pair games).

### PB3 — Personal patch-drift verdict — **shipped 2026-05-14**

- Helper: [`apps/web/src/lol/champions/patch-drift.ts`](../../apps/web/src/lol/champions/patch-drift.ts) — `buildPatchDrift()` groups all serious matches by patch (reusing `groupByPatch`), computes this-champion's share of total games on the latest two patches, and returns `{ currentPatch, previousPatch, currentShare, previousShare, currentChampGames, currentTotalGames, direction, relativeChangePct }` only when the drift is meaningful (both patches ≥ 5 total games; relative change ≥ 20% and absolute change ≥ 3pp).
- Render: [`$championKey.tsx`](../../apps/web/src/routes/lol/$accountSlug/champions/$championKey.tsx) renders a neutral-tone verdict line above the patch-history strip: *"Up on patch 26.9 — 18% of your 28 games (vs 10% on 26.8). 5 games this patch."* Suppressed entirely when no drift is meaningful (the common case keeps the page quiet).
- Tone stays neutral: this is a behavior observation, not a performance verdict.

### PB4 — Cross-tile personal anomalies

A "what's unusual this window" summary, sitting on Trends or Profile. Pulls verdict statements from all personal-baseline tiles and surfaces only the 1–2 most surprising. Needs a salience model (which deltas are large enough to flag). Defer until at least 2–3 more personal-baseline tiles ship.

### PB5 — Optional global-comparison toggle

A single `Compare to my rank` toggle on tiles that have a meaningful global baseline (damage, vision, KDA). Opt-in; off by default. Reasserts the personal frame as the home position.

---

## Status

- **2026-05-13** — framing note drafted. PB1 is the smallest unit; PB2 is the highest-payoff visible move.
- **2026-05-14** — PB2 shipped (weakest-matchup verdict on Champion detail). PB1 doc-pass and PB3 patch-drift verdict remain.
- **2026-05-14** — PB3 shipped (time-on-this-champion patch-drift verdict on Champion detail). PB1 doc-pass remains; PB4 cross-tile anomalies still deferred until at least 2–3 more personal-baseline tiles ship.
- **2026-05-14** — PB1 doc-pass shipped. Every tile file carries an explicit `// Baseline: <kind>` marker. Audit corrected one mis-classification (`trend-first-blood-conversion` is personal, not role-population) and added one new role-population label (`trend-lane-phase-prognosis`). Only PB4 remains, still deferred.

---

## Open questions

1. **What sample size makes a personal baseline meaningful?** 30 games on a role is probably enough for damage / vision; matchup-level needs ≥ 5 same-pair games to avoid noise. Codify the thresholds and reuse them.
2. **Where do we store the "personal-baseline label" decision per tile?** A comment in the component is fine for PB1; a typed `Baseline = "personal" | "role-population" | "fixed-reference"` field in the tile's metadata could enforce it later.
3. **Compare-to-rank toggle scope.** Per-tile or app-wide preference? Per-tile is more honest; app-wide is more discoverable. Probably per-tile with a synced preference for "remember on the next tile too."
4. **Naming.** Do we call them "your average" / "your baseline" / "your norm" / "your usual" — pick one and use it consistently. *"Your usual"* reads warmest; *"your baseline"* reads most analytic. Recommendation: *"your average"* on numeric tiles, *"your usual"* on behavioral tiles (pool composition, matchup choices).

---

## Connections to existing notes

- [`app-state-analysis.md`](app-state-analysis.md) — the personal-baseline frame is the deeper version of "Champions is the only tab without a verdict."
- [`vnext-ideas.md`](vnext-ideas.md) — PB2/PB3 belong as second-tier entries; PB4 is a top-tier "system notices something" candidate.
- [`trends-rework.md`](archive/trends-rework.md) — establishes the verdict-pattern primitives all of this rides on.
- [`case-study-topics.md`](case-study-topics.md) — *"a stats site where the user is the unit of analysis"* is a strong narrative for a write-up.
- [`post-game-close-the-loop.md`](post-game-close-the-loop.md) — the post-game read leans heavily on personal baselines.
