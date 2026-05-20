# Composite LP forecast tile — design note

**Status:** Active — Phase LP1 (directional-only verdict) shipped 2026-05-14. Phase LP2 shipped 2026-05-20 (retroactive signal-replay + directional-accuracy calibration, "How is this computed?" disclosure). Per-signal sample-size weighting deferred — gated on whether calibration shows uneven signal contribution once Agurin's window grows. Phase LP3 (personal linear fit) remains the long-tail target. See [open-work.md](../open-work.md).

A single tile on Profile that composes the four existing Pregame Ritual signals (form, tilt, time-slot, top-champion) into one forward-looking verdict: *"Composite read for your next ranked: +X expected LP — confidence Y."*

Promoted from [vnext-ideas.md](../cross-cutting/vnext-ideas.md) ("Goal setting + projection" and the implied composite-of-signals idea in Pregame Ritual) and [app-state-analysis.md](app-state-analysis.md) (broader-app gap #2) into a tracked design note.

Read this before starting work on the tile, or when deciding the confidence-model approach.

---

## Premise

[Pregame Ritual](../../../apps/web/src/lol/profile/profile-pregame-ritual.tsx) computes four signals independently:

1. **Form** — recent win/loss curve.
2. **Tilt** — minutes-since-last-loss + back-to-back loss detection.
3. **Time slot** — current hour-of-week vs the user's historical WR by slot.
4. **Top champion** — what they've been playing and how it's gone.

Each tile reads as a calm independent signal. None of them answer the question the user actually has: *"is now a good time to queue?"* The composite answers it.

The honest version of that answer is not a single number — it's a verdict + confidence band. *"+8 LP expected (low confidence — small sample on Tue 23:00 in this patch)"* reads as analysis. *"+8 LP expected"* alone reads as a guess and ages badly.

---

## Inputs

All available today, all computed by Pregame Ritual:

- Recent-form vector (last N outcomes, computed in `buildFormSignal`).
- Tilt indicator (boolean / scale, from `buildTiltSignal`).
- Current time-slot historical WR (`buildTimeSlotSignal`).
- Top-champion recent WR (`buildChampionSignal`).

Additional inputs that could feed the model:

- Champion-vs-account-average delta on the suggested champion (already on champion detail).
- Day-of-week WR pattern (Trends tile already computes it).
- Patch-aware win rate on the suggested champion (already exists on Champion detail).

---

## The confidence model — open decision

Two viable approaches.

### Option A — Naive equal-weight composite

- Each of the four signals maps to a -1..+1 score.
- Composite score = mean(score).
- Map composite to an expected-LP band: e.g. score 0.3 → "+5 to +15 LP", score -0.5 → "-15 to -5 LP".
- Confidence = function of sample sizes on time-slot and champion (low sample → "directional only").

**Pros:**
- Zero training data required.
- Transparent — every input contributes equally; easy to explain in a case-study write-up.
- Honest about uncertainty by design.

**Cons:**
- Not personalized to the user's actual pattern. A user whose form correlates strongly with results and whose time-slot WR is noise will be over-influenced by time-slot.
- Cannot improve over time.

### Option B — Lightweight linear fit on personal LP history

- For each completed ranked game, compute the four signal values *at queue time* (reconstructable from `MatchSummary` + the user's match history at that point).
- Fit a small linear regression `predicted_lp_delta = β₀ + β_form·form + β_tilt·tilt + β_slot·slot + β_champ·champ` on the user's own games.
- Predicted LP for the next queue = model output; confidence = fitted standard error or cross-validated MAE.

**Pros:**
- Personalized — the user whose tilt actually predicts losses gets a tilt-weighted model.
- More honest verdict: *"your form is the dominant predictor on this account; tilt barely correlates."*
- Strong case-study material — a real (if tiny) personal-model story.

**Cons:**
- Needs months of LP-history snapshots to be meaningful. Today we have rank snapshots accumulating but not enough — Phase 4 of [views-roadmap.md](../archive/views-roadmap.md) is "shipped (code)" with no rank snapshots having accumulated yet. **The data prerequisite is the limiting factor.**
- More moving parts; the case-study story has to handle "this model is fitting on N=37 games and overfit risk is real."
- Naïve fit on small samples will overstate confidence unless regularized.

### Recommendation — ship Option A now, evolve to Option B later

Phase LP1 ships the naive composite. It works at any data scale, prints an honest "directional only" verdict on low-sample paths, and the math is explainable. Phase LP3 (months out, once LP history has accumulated) revisits with the linear fit and presents the comparison — *"the naive model said +5; the personal fit on your data says -3, because tilt is your dominant signal."* That's the case-study write-up.

---

## Tile placement — open decision

Three candidates:

### Option A — Profile, paired with Pregame Ritual

A sibling tile next to (or below) Pregame Ritual. The four input signals are visually adjacent — the composite reads as the natural summary.

- **Pro:** the visual story (4 signals → 1 composite) is the strongest argument for the tile.
- **Pro:** doesn't disturb existing layout.
- **Con:** double-counts visual real estate; the user sees the four signals *and* the composite.

### Option B — Inside Pregame Ritual itself

Pregame Ritual becomes "4 signals + 1 composite line". The composite reads as the verdict over the signals.

- **Pro:** densest version. The signals become the *evidence* for the composite verdict.
- **Pro:** matches the `ConclusionCard` pattern (verdict → evidence → prescription).
- **Con:** changes an established component. Need to keep the four signals navigable as their own reads.

### Option C — Standalone on Profile, far from Pregame

A `ConclusionCard`-shaped tile elsewhere on Profile (e.g. above LP history). Reads as a standalone "the read on your next queue" surface.

- **Pro:** declutters Pregame Ritual.
- **Con:** loses the visual link to the inputs that drove it.

**Recommendation:** Option B. The composite is the verdict; Pregame's four signals are the evidence. Re-renders the existing component as a verdict-shaped block rather than a four-signal grid. Strongest narrative payoff, fits the `ConclusionCard` mental model the rest of the app already uses.

---

## Phasing

### Phase LP1 — Naive composite, Option B placement — **shipped 2026-05-14**

- Helper: [`apps/web/src/lol/profile/pregame-composite.ts`](../../../apps/web/src/lol/profile/pregame-composite.ts) — `buildComposite()` maps each signal's tone to a {-1, 0, +1} score, averages, and produces an LP band centred at `score * 20` with ±5 width.
- Tile: [`profile-pregame-ritual.tsx`](../../../apps/web/src/lol/profile/profile-pregame-ritual.tsx) renders a verdict row (`Composite read · next ranked` label + LP band) above the four signal tiles, tone-tinted by composite sign.
- Confidence label is gated on count of non-neutral firing signals: 3–4 → no label, 2 → "directional only", 1 → "low confidence — small sample".
- Empty path: zero firing signals → muted "Play a few games and we'll have a read".
- **LP1 shortcut to revisit in LP2/LP3:** confidence currently ignores each signal's *internal* sample size (e.g. time-slot's `slot.games`). It only counts how many signals had a non-neutral read. The honest version threads sample-size into per-signal weight.

### Phase LP2 — Confidence calibration — **shipped 2026-05-20**

- Helpers: [`packages/shared/src/lol/pregame-signals.ts`](../../../packages/shared/src/lol/pregame-signals.ts) — tone-only signal builders, `replayHistory()`, and `computeCalibration()`. The shared module walks every match with valid `snapshotLpBefore`+`snapshotLp`, slices history to matches strictly before that match's `playedAt`, and reruns the four signal builders with `now = match.playedAt`. The API side caches calibration per `(account, queue-set)` keyed on the latest match's `playedAt` so a no-op call costs a single `findFirst`. The client consumes it through `usePregameCalibration` ([`apps/web/src/lol/profile/use-pregame-calibration.ts`](../../../apps/web/src/lol/profile/use-pregame-calibration.ts)); `calibrateConfidence()` (web-only, in `pregame-replay.ts`) swaps the heuristic confidence string for a calibration-grounded one once the sample crosses `MIN_CALIBRATION_SAMPLE = 30`.
- UI: `CompositeVerdict` now shows a `<details>` "How is this computed?" disclosure (signal-tone breakdown, dominant signal aligned with composite tone, band derivation, and source of confidence). Heuristic string flows through unchanged when N < 30.
- Signal builders (`buildFormSignal` / `buildTiltSignal` / `buildTimeSlotSignal` / `buildChampionSignal`) now accept an optional `now: Date` so the replay can recompute signals at historical points; default behaviour at the live render is unchanged.
- Deferred from LP2: per-signal sample-size weighting (the LP1 shortcut). Re-evaluate once the calibration has had a few weeks to read on Agurin's data — if directional accuracy is uneven across signal compositions, that's the trigger to thread per-signal weight in.

### Phase LP3 — Personal linear fit

- Once 100+ ranked games of LP history have accrued, fit a small linear regression on the four-signal vector.
- Render both the naive and personal-fit verdicts side-by-side for a release; collect feedback on which reads as more useful.
- Decide whether to retire the naive model or keep both as transparency layer.
- Write up as a case study (target: [case-study-topics.md](../cross-cutting/case-study-topics.md)).

---

## Why this is portfolio-worthy

The composite is interesting structurally because it demonstrates:

1. **Composition of existing signals into a new abstraction.** The cleanest example in the codebase of "the parts already exist; the verdict is the new thing."
2. **Honest uncertainty.** Confidence labels and "directional only" tags push back on the genre's tendency to assert single numbers.
3. **A path to a personal model.** Phase LP3 is the rare consumer-app moment where a tiny per-user regression is both technically defensible and narratively interesting.

---

## Status

- **2026-05-13** — design note drafted, not yet started. Blocked on nothing for Phase LP1; LP3 is data-blocked until rank snapshots accumulate (see [views-roadmap.md](../archive/views-roadmap.md) Phase 4 caveat).
- **2026-05-14** — Phase LP1 shipped (naive equal-weight composite + verdict row above Pregame Ritual signals). LP2 next (confidence calibration once LP history has accrued); LP3 still data-blocked.
- **2026-05-20** — Park reversed after data check. The BEFORE/AFTER snapshot pipeline pre-dates LP1 ship (shipped earlier as part of [views-roadmap.md](../archive/views-roadmap.md) Phase 4), so the relevant clock isn't "days since LP1 shipped" — it's "matches with valid LP delta." Agurin#DND has 174 such matches in DB (`SELECT COUNT(*) FROM "Match" WHERE puuid = <agurin> AND "queueType" = 'Ranked Solo' AND "snapshotLpBefore" IS NOT NULL AND "snapshotLp" IS NOT NULL`), and per-account validation is the honest unit (mixing accounts mashes different personal patterns together). LP2 stays in open-work; next-action is the retroactive signal-replay on Agurin's history.
- **2026-05-20** — LP2 shipped. Retroactive signal-replay + directional-accuracy calibration + "How is this computed?" disclosure land in one chunk; per-signal sample-size weighting deferred until calibration data shows uneven contribution. Per-signal weighting moves to LP2.5 / LP3 territory rather than blocking the LP2 ship.
- **2026-05-20** — LP2 data-scope fix. The initial client-side replay only saw the loaded match window (Agurin's 18 visible games), so the disclosure read "have 18, need 30" against a DB that has 174. Replay + calibration moved server-side: tone-only signal builders and `replayHistory`/`computeCalibration` live in `@vyoh/shared`, the API exposes `GET /lol/.../pregame-calibration` with a per-account cache keyed on the latest match's `playedAt`, and the client consumes it through `usePregameCalibration`. The UI behaviour is unchanged at the boundary (heuristic until `N ≥ MIN_CALIBRATION_SAMPLE`); only the sample size now reflects full DB history.
- **2026-05-20** — LP2 per-queue split. Solo and Flex are independent LP ladders, so collapsing them into one directional-accuracy number was dishonest (a strong-Solo / weak-Flex player would average out to noise, or worse, the smaller sample would dominate via the larger ladder's variance). API now returns `PregameCalibrationByQueue = Record<queueType, CalibrationStats>`; the headline confidence text reads from the queue with the largest sample, and the disclosure shows every queue's `n` and directional-accuracy on its own line. Signal *inputs* still mix across queues (player state — tilt, time-of-day — transfers between ladders); only the LP-delta accuracy is partitioned.

---

## Open questions

1. **LP band width.** ±5? ±10? Should it scale with confidence (low confidence → wider band)? Probably yes.
2. **What counts as "the next queue"?** The active hour, or the user's most-likely-to-queue hour today? The simpler answer is "the current hour"; the smarter answer is "the next hour we predict you'll queue in."
3. **Does the composite respect the user's queue choice?** A user about to queue Flex vs Solo has different LP expectations. The pregame signals don't currently distinguish. Probably defer — pregame doesn't either.
4. **What does the tile do on a cold-start account?** Render muted, or hide entirely. Recommendation: muted. Consistency with the rest of the app's empty-state language.
5. **Cross-account composite — does one show on the unified-identity view (vNext)?** Park until multi-account compare is on the table.

---

## Connections to existing notes

- [`vnext-ideas.md`](../cross-cutting/vnext-ideas.md) — promoted from "Goal setting + projection".
- [`app-state-analysis.md`](app-state-analysis.md) — Phase 4 in the recommended phasing; broader-app gap #2.
- [`views-roadmap.md`](../archive/views-roadmap.md) — Phase 4 LP history is the data prerequisite for Phase LP3.
- [`post-game-close-the-loop.md`](post-game-close-the-loop.md) — sibling arc. Pregame composite + post-game read are the bookends of the play loop.
- [`case-study-topics.md`](../cross-cutting/case-study-topics.md) — Phase LP3 is the case-study moment.
