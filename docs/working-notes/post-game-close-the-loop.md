# Post-game close-the-loop surface — roadmap

After-game counterpart to [Pregame Ritual](../../apps/web/src/lol/profile/profile-pregame-ritual.tsx). Promoted from [vnext-ideas.md](vnext-ideas.md) ("Top tier — eye-catching wins") and [app-state-analysis.md](app-state-analysis.md) (broader-app gap #1) into a tracked arc because it is the **single highest-payoff missing surface** in the LoL section and the strongest case-study candidate currently in the backlog.

Read this when starting the arc, or when the question is "what's the next big visible-payoff feature."

---

## Premise

The app currently helps the user *before* and *during* a game:

- **Pregame Ritual** (4 signals: form, tilt, time slot, top champion) frames the decision to queue.
- **Live page** (server-side polling + SSE) covers the in-game read.

There is no equivalent for *after* a game. The most emotionally charged moment in the play loop — the minutes after a win or a loss — is currently a blank space in the app. Every other companion app shares this gap. The verdict pattern (`ConclusionCard`), the calm-coaching tonal bet, and the SSE infrastructure that already pushes new-match events to the client all point at the same thing: this is a surface waiting to be built on primitives that already exist.

The frame for the surface itself: **"that one just landed, here's the read."** Not gamified, not celebratory, not a scoreboard — a one-glance after-game block that surfaces what the user would otherwise have to assemble manually from form, tilt, time-slot, and champion deltas.

---

## What signals exist

Most of the work is composition, not new computation. Inputs available today:

| Signal | Source | Notes |
|---|---|---|
| Outcome | `MatchSummary.win` | Trivially derived. |
| Streak break / extension | Form computation in [`profile-pregame-ritual.tsx`](../../apps/web/src/lol/profile/profile-pregame-ritual.tsx) `buildFormSignal` | Mirror it for post-game framing. |
| Game length | `MatchSummary.gameDurationSec` | Cluster by short / normal / long for verdict shading. |
| Tilt risk after this game | `buildTiltSignal` logic | Same primitive; phrasing flips ("you tilt 30% more after this kind of loss"). |
| Performance vs personal baseline | `damageShare`, `visionScore`, KDA, `csAt15` | Already present on `MatchSummary` via Phase A/B trends backfill. |
| Champion delta vs account average | Champion detail delta tiles | Re-use the per-champion vs personal-baseline computation. |
| Next time slot read | `buildTimeSlotSignal` | "Your next ranked is in your worst slot — Tue 23:00, 38% historical WR." |
| First-blood, lane-phase, comeback | Phase B fields (`teamGoldDiffAt15`, `deathTimings`) | Adds depth where the user lost in lane but won the game, or vice versa. |

**No new schema, no new Riot calls.** Everything composes from `MatchSummary` + the existing pregame primitives.

---

## Design — what the surface actually is

A `ConclusionCard`-shaped block with 3–4 signals, mirroring Pregame Ritual's structure but inverted in tone — what *happened* rather than what to *consider*. Reuses the existing `RitualSignal` model so the visual language matches the pregame surface and the user reads them as a paired set.

**Candidate signals for v1 (pick 3 or 4):**

1. **Outcome read** — *"4-game win streak now"*, *"first loss after 3"*, *"your seventh ranked game today — you usually stop at 5"*.
2. **Performance vs your baseline** — *"+18% damage share above your ADC average"*, *"vision investment below your norm (-12)"*. One highlight, not a dump.
3. **Tilt forecast** — *"you go -X% in the next game after a 30+ minute loss; consider stepping away"*. Same data as pregame tilt, framed as a forward read.
4. **Champion read** — *"your worst result on Vex in 14 games — patch 14.20"* or *"matches your Vex average exactly"*.
5. **Next-slot framing** — *"your next ranked window is Tue 23:00, your weakest slot"*.

Pick the 3–4 with the highest signal-to-noise per game; deterministically choose which signals fire based on data presence (the existing `RitualSignal.tone` model already supports "muted" empty paths).

**Prescription field (optional, only on high-confidence cases):**

- "Take a break" (after consecutive losses or a long loss).
- "One more is fine — your form is up." (after a win streak inside the user's historical comfort range).
- "Check the matchup tab — your last 3 vs Yasuo went poorly." (after a recurring lane loss).

The prescription must never be ambient. If there's no clear read, it's omitted — same rule as the trends tiles.

---

## Surface placement — open decision

Three viable homes:

### Option A — Profile section, always visible

A new block on Profile, paired visually with Pregame Ritual. Pregame on the left, Post-game on the right (or above/below depending on rank-snapshot density). Reads the most-recent match for the active account.

- **Pro:** zero new routing, zero new triggers, lands as a static dashboard read every time the user opens Profile.
- **Pro:** pairs visually with Pregame Ritual — symmetrical bookends.
- **Con:** less moment-aware; reads the same yesterday's loss as a fresh one until a new match arrives.

### Option B — Route segment that opens on SSE arrival

A peer route at `/lol/$accountSlug/post-game/$matchId` that the app auto-navigates to (or opens as a modal layer) when the SSE backfill worker reports a new completed match. Closes back to wherever the user was.

- **Pro:** moment-aware; appears exactly when the user finishes a game.
- **Pro:** strong "this app is alive" signal — a calm artifact that materializes after each match.
- **Con:** auto-navigation is intrusive; needs an explicit opt-in or a non-blocking entry.
- **Con:** more routing surface area; deeper interaction with the SSE invalidation flow.

### Option C — Static Profile section + auto-expand on SSE

Hybrid: section always exists on Profile, but on SSE arrival the section animates open / pulses / highlights without forcing navigation. User sees the read where they expect it.

- **Pro:** moment-aware without being intrusive.
- **Pro:** the easiest of the three to back out of if the framing doesn't land.
- **Con:** the "open this artifact after a game" moment is muted compared to Option B.

**Recommendation:** Option C for v1. Lowest risk, easiest to evolve to Option B if the "open after a game" moment proves to be the right framing. Keep the route reserved (`/lol/$accountSlug/post-game/$matchId` as a peer route) for a v2 promotion.

---

## Phasing

### Phase PG1 — Static section on Profile

Ship as a sibling block to Pregame Ritual, reading the most-recent match. No SSE awareness yet. All 3–4 signals deterministically chosen per match.

- New component: `apps/web/src/lol/profile/profile-post-game.tsx`.
- Reuse `RitualSignal` model + `SignalTile`-style tile component.
- New helpers: `buildOutcomeSignal`, `buildBaselineSignal`, `buildTiltForecastSignal`, `buildChampionReadSignal`.
- Self-contained PR.

### Phase PG2 — SSE-driven highlight

Wire the section to highlight / pulse / animate-open when a new match arrives via the existing `MatchEventsService` SSE stream. The signal computation already updates because `useCachedMatchesWindow` invalidates on SSE.

- New `useNewMatchNotice` hook keyed on the most-recent `matchId` from the windowed query; emits a one-shot "new match arrived" event for a few seconds.
- Motion: `layout` + slight `scale` lift on the post-game card; existing `useReducedMotion` discipline.

### Phase PG3 — Lane-phase / comeback depth

Add 1–2 signals that pull from Phase B timeline fields: lane-phase outcome read (*"won the game but lost lane: -1.2k gold at 15"*), comeback flag (*"down 5k at 15 — came back"*). These read directly from `csAt15`, `goldAt15`, `teamGoldDiffAt15`.

- No backend changes. New helpers in the same module.
- Gate on the "timeline projected" sentinel so historical rows without backfilled timelines fall back to v1.

### Phase PG4 (optional) — Peer-route artifact

Promote to `/lol/$accountSlug/post-game/$matchId` as a peer route opened via a "View the read" link on the Profile section. Becomes the share-friendly artifact (calm Wrapped, but per-game).

- Reuses the same component shell, denser layout, OG-image variant. Ties to the recap-density expansion arc.

---

## Cross-cutting decisions to make before Phase PG1

1. **How many signals on v1?** 3 is calm; 4 is denser. Recommendation: build the helpers for 4, render 3 deterministically per match by priority order (outcome → baseline → tilt → champion), drop the lowest-priority muted tile.
2. **Most-recent match scope.** Reads from `useCachedMatchesWindow(account, 100)` and takes index 0. ARAM games — include or skip? Recommendation: include but the baseline signal sits out (ARAM has no role baseline). Matches pregame ritual's treatment.
3. **Match-card morph back to detail.** If the user clicks the post-game card, should it morph into the full match detail page (the `layoutId` morph from match list)? Recommendation: yes, reuse the same `layoutId` so the post-game card *is* the match card visually.
4. **Empty state.** When the account has no matches in the window — muted "Play a game and we'll have a read after it" empty card. Use the existing `EmptyMatchesIllustration`.

---

## Why this is a case-study candidate

The arc embodies the tonal bet of the whole app: stats sites describe; vyoh.gg *talks*. A post-game close-the-loop block is the single clearest demonstration of the verdict pattern applied where it matters most. The write-up frame writes itself:

- The pattern (`ConclusionCard` + signal tile model) is a generalizable abstraction, not a one-off.
- The reuse story is concrete: pregame and post-game share 80% of the computation surface and 100% of the visual language.
- The SSE story comes along for free — the post-game section is the most visible application of the existing real-time invalidation work.

Companion to (or replacement for) the open ConclusionCard-pattern case study tracked in [case-study-topics.md](case-study-topics.md).

---

## Status

- **2026-05-13** — arc framed, promoted from vNext. Not yet started.

---

## Open questions

1. **Surface placement — A, B, or C above.** Recommendation in this doc is C, but Option B (route segment, auto-open on SSE) is the more demoable choice and may justify the routing complexity.
2. **Pulse / highlight cadence on SSE.** How long should the "new match arrived" emphasis last — a few seconds, until the user interacts, or until the next page change? Probably 6–8 seconds with a fade.
3. **Multi-account post-game.** When two whitelisted accounts both finish a game close together, does each Profile show its own post-game card independently (yes — it's per-account already), or does a global "two games finished" surface appear? Defer; per-account is fine.
4. **Notification beyond Profile.** Toast on other tabs when a new match lands? Currently the only signal is the SSE-driven list refresh. A toast might be the cheapest moment-aware add for users who aren't on Profile. Park.

---

## Connections to existing notes

- [`vnext-ideas.md`](vnext-ideas.md) — promoted from "Other gaps in the broader app" / top-tier.
- [`app-state-analysis.md`](app-state-analysis.md) — Phase 2 in the recommended phasing.
- [`motion-backlog.md`](motion-backlog.md) — Phase PG2 motion work belongs there once specced.
- [`case-study-topics.md`](case-study-topics.md) — strongest current case-study candidate.
- [`trends-rework.md`](trends-rework.md) — re-uses the `ConclusionCard` pattern established there.
