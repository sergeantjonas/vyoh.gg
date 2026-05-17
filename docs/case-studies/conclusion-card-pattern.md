# A stats site that talks — the ConclusionCard pattern

## TL;DR

Every league companion app — op.gg, u.gg, blitz, mobalytics — sits the user in front of charts and tables and trusts them to derive meaning. The genre default is *metric → judgment*: render the numbers, the user does the inference. Vyoh inverts that. Each tile renders a structured `{ verdict, evidence, prescription? }` triple via a single `ConclusionCard` primitive ([apps/web/src/lol/trends/_shared/conclusion-card.tsx](../../apps/web/src/lol/trends/_shared/conclusion-card.tsx)) — a sentence saying what's happening, the chart demoted to a receipt under it, a one-line action only when the data warrants one. The shape is load-bearing: the TypeScript interface itself constrains every tile to one of three exits — *verdict* / *muted-directional* / *empty* — with no neutral middle. The pattern composes across 22 call sites (19 in [apps/web/src/lol/trends/](../../apps/web/src/lol/trends/), 3 in [apps/web/src/lol/champions/](../../apps/web/src/lol/champions/)) plus a sibling `RitualSignal` shape used by Pregame Ritual and the Post-game close-the-loop section. Companion to [motion-without-gimmicks.md](./motion-without-gimmicks.md) (visual layer) and [frontend-perf.md](./frontend-perf.md) (the showpiece framing the verdict pattern is the *content* of).

## The genre default

Open any companion app on a player's profile and the first surface is a table of champions. Each row is a name, a games count, a win-rate percentage, and a KDA. *"Aurelion Sol — 12 games, 50% WR, 3.2 KDA."* Below the table is a row of cards: KDA over time, queue distribution, time-of-day heatmap. Each is a chart. None says anything.

This is not a critique of the rendering. The numbers are correct, the charts are well-built, and the layout is dense in the way a power-user expects. The critique is that the *work of asking "is that good?"* is unloaded onto the reader. The site shows; the reader interprets. For a player who already knows what to look for that's fine — they're using the app as a database. For everyone else (the larger population), the page reads as an undifferentiated grid where every cell looks equally important and nothing is foregrounded.

The vyoh equivalent of that same row is:

> **Workhorse champion** — Aurelion Sol, 12 games, +6pp above your account average. KDA on this champion (3.2) tracks your overall KDA almost exactly.

The chart is still there. It's just below the sentence, and the sentence is what the user reads first. The chart's job has changed from *headline* to *receipt*.

## The primitive

The whole pattern is one TypeScript interface and a small render component:

```tsx
// apps/web/src/lol/trends/_shared/conclusion-card.tsx
export interface ConclusionCardProps {
  title: string;
  sampleSize: number;
  verdict: string;
  verdictMarkdown?: string;
  evidence?: ReactNode;
  prescription?: string;
  prescriptionMarkdown?: string;
  className?: string;
  /** When true, renders the verdict in muted style — use for insufficient-data empty states. */
  empty?: boolean;
}
```

Five things in the body of a tile, in order: `title`, `sampleSize`, `verdict`, `evidence`, `prescription`. The render component is 65 lines of layout. The `verdictMarkdown` / `prescriptionMarkdown` siblings exist because the same `summarize(stats)` function each tile uses to produce its UI verdict also feeds the planned weekly-digest markdown export — one source of truth, no parallel parser, no copy drift.

The interesting load-bearing part is what's *not* in the interface. There is no `tone` enum. No `severity`. No `score`. No `colorIntent`. No way to render a tile that says "this is a 7/10." The card has one foreground voice (verdict text), one supporting layer (evidence — the chart), and one optional second voice (prescription — the action). That's it.

The shape is the design. A tile that wants to be a leaderboard entry can't be built from this primitive without forcing a different one — and the forcing function is the discipline.

## The three exits — no neutral middle

Every tile that uses `ConclusionCard` resolves to exactly one of three outputs:

1. **Verdict + prescription.** The signal is strong enough to act on. Verdict says what happened, prescription says what to do.
2. **Verdict only (muted-directional).** The signal exists but is small or ambiguous. Verdict says what happened; no prescription, because the data doesn't earn one.
3. **Empty.** The sample is too thin to say anything honest. Verdict text says *what would unlock the read*, rendered in muted style via the `empty` prop.

The cleanest example is [trend-tilt-indicator.tsx](../../apps/web/src/lol/trends/trend-tilt-indicator.tsx). The full decision tree, condensed:

```tsx
if (current.length < 5) {
  return <ConclusionCard verdict="Not enough games yet to detect tilt patterns." empty … />;
}
if (afterWin.games < 5 || afterLoss.games < 5) {
  return <ConclusionCard verdict="Need 5+ games after a win and after a loss…" empty … />;
}

const diffPp = Math.round((wrWin - wrLoss) * 100);
const verdict =
  Math.abs(diffPp) < 1
    ? "Win rate is stable regardless of your last result."
    : diffPp > 0
      ? `Win rate drops ${diffPp}% after a loss.`
      : `Win rate drops ${Math.abs(diffPp)}% after a win — fresh sessions help.`;

const prescription = diffPp >= 8 ? "Consider stepping away after a loss." : undefined;

return <ConclusionCard verdict={verdict} prescription={prescription} … />;
```

Three exits, all reachable. Note the *muted-directional* path — `Math.abs(diffPp) < 1` returns *"Win rate is stable regardless of your last result"* with no prescription. That's the case the genre default would render as a "neutral" tile with a 50/50 split bar. Here it's a sentence: stable. Nothing to do. The user reads one line and moves on.

The same pattern appears across every tile, with different sample-size gates and different prescription thresholds. [trend-worst-matchup.tsx](../../apps/web/src/lol/trends/trend-worst-matchup.tsx) has *three* distinct empty paths (no Rift games at all, no losing matchups with ≥3 games, no matchup data after sort) and one verdict path that fires the prescription only when win-rate against the worst matchup is ≤25%. [trend-game-length.tsx](../../apps/web/src/lol/trends/trend-game-length.tsx) and [trend-comeback-resilience.tsx](../../apps/web/src/lol/trends/trend-comeback-resilience.tsx) follow the same skeleton.

The constraint earns its weight on the second-order use. A junior change to a tile can either tighten the prescription threshold, soften the verdict copy, or add an additional empty branch. It cannot accidentally introduce a "neutral middle" tile because the primitive doesn't have one. The shape rules it out.

## Sample-size honesty as a UI primitive

The verdicts only land if the user trusts them. Trust calibration sits in a 14-pixel SVG in the top-right of every card.

```tsx
// apps/web/src/lol/trends/_shared/sample-size-badge.tsx
const level = count < 10 ? "empty" : count < 30 ? "partial" : "full";
const pathLength = level === "empty" ? 0 : level === "partial" ? 0.5 : 1;
```

A partial-circle ring (Motion `pathLength` 0 → final fill on first paint) plus a Radix tooltip with three labels:

- **Small sample — directional only** (<10 games)
- **Moderate sample** (10–30)
- **Confident estimate** (30+)

The thresholds are values per [trends-rework.md](../working-notes/archive/trends-rework.md) Phase T2 decision, "tunable after dogfooding." The badge is the same component on every tile — the ring shows you how much weight the sentence above it should carry, and the same tooltip text appears wherever you hover. The reader internalizes the calibration once and applies it to every card on the page.

The asymmetry with the genre default is real. Op.gg-class tools render small-sample numbers exactly the same way as large-sample numbers — the user has to do the mental math of "this is one game, ignore it." Here the number is shown, the verdict is fired (or muted, or replaced with an empty-state read), *and* the badge encodes the confidence level visibly. The honest answer to "how much should I trust this" is in the same eye-fixation as the answer.

## The personal-baselines dependency

The pattern would not survive a global percentile.

If the verdict on the tilt tile read *"Your post-loss win rate is in the 32nd percentile of platinum mid-laners"* the tone would collapse back into scoreboard. Percentile-against-the-population is competitive by construction. The voice is the leaderboard's: better-or-worse than strangers. The reader's response is to compare, not to act.

Vyoh's verdicts are nearly all *you-vs-you*. *"Your post-loss WR drops 12 points compared to your post-win WR."* *"+6pp above your own ADC average."* *"Down on patch 26.9 — 8% of your 28 games (vs 16% on 26.8)."* The unit of analysis is the player, not the cohort. [personal-baselines.md](../working-notes/personal-baselines.md) tracks this explicitly — every tile file in the LoL section carries a top-of-file `// Baseline: <kind>` marker so the choice is grep-able. 26 files audited; the great majority are `personal`, two are `fixed-reference`, a small handful are `role-population` (used only when there's no personal alternative — comparing your damage share to your *own* damage share on the same role would be vacuous).

The role-population exception is the principled one. The Phase T4 Phase-A trio (damage role consistency, vision investment, first-blood gold conversion) reads against static per-role baselines from [role-baselines.ts](../../apps/web/src/lol/_shared/role-baselines.ts) (TOP 22%, JUNGLE 19%, MID 28%, BOT 30%, SUP 8% damage share). Even there, the verdict reads as "you vs the baseline for *your* role," not "you vs the world." The baseline is a reference, not a frame.

The cost of the personal-baseline frame is real. Every personal-baseline tile depends on the user having enough of their own history to be meaningful — small-sample players see more empty-state cards. Global percentile would never empty out. We accept the empty cards as the cost of staying out of leaderboard tone.

## Composition across surfaces

The pattern composes. As of this write-up:

- **22 `ConclusionCard` call sites** total (LSP `findReferences` on the export, 75 references across 23 files including the declaration):
  - 19 in [apps/web/src/lol/trends/](../../apps/web/src/lol/trends/) — the full trends grid plus the death-matchup heatmap.
  - 3 in [apps/web/src/lol/champions/](../../apps/web/src/lol/champions/) — `champion-pool-drift`, `champion-build-sankey`, `champion-position-heatmap`.
- **8 sibling `RitualSignal` tiles** ([ritual-tile.tsx](../../apps/web/src/lol/profile/ritual-tile.tsx)) across Pregame Ritual and Post-game close-the-loop, 4 signals each. Same `{ label, verdict, tone, detail? }` shape, no sample-size badge — the ritual context is "quick read of four things" rather than "sample-gated insight."

The reuse is structural. The same `summarize(stats): { verdict, prescription? }` function shape appears in every tile. The same three-exit decision tree. The same Radix tooltip on the badge. When a Trends tile and a Champion-detail tile and the Post-game section all read like one app, it's because they were built from the same primitives, not because the copywriter unified the voice in a content review.

Concretely, the composition shape across the play loop is:

| Surface | Window | Verdict shape | Sample primitive |
|---|---|---|---|
| Profile — Pregame Ritual | last ~30 days | "Most played champion: Vex (24%, 14 games)." | RitualSignal |
| Profile — Post-game | most-recent match | "First loss after 3 — break the streak with a strong matchup." | RitualSignal |
| Trends (12 active tiles) | range selector — `30d vs prior 30d`, etc. | "WR drops 12% after a loss. Consider stepping away." | ConclusionCard |
| Champions list | last 14d vs prior 14d | "Up on Vex — 18% of your 28 games (vs 10% on 26.8)." | ConclusionCard (drift) |
| Champion detail tiles | per-champion, all-time | "vs Yasuo — your weakest matchup, 18pp below baseline on this champion." | ConclusionCard |

Five surfaces, two primitives, one tonal vocabulary. The next surface (the [composite LP forecast tile](../working-notes/app-state-analysis.md), broader-app gap #2) slots into the same shape: a verdict ("Composite read for your next ranked: +14 expected LP — confidence moderate"), evidence (the four sub-signal contributions), an optional prescription. No new primitive needed.

## The grid is part of the primitive

A second-order benefit of the verdict-first shape: the page itself can re-rank tiles by *how much they have to say*, because every tile knows whether its verdict is firing or empty.

Trends declares its tiles as a single data array with a `designPriority` per tile and an `active` boolean computed from each tile's data window — `worst-matchup` is `active` only when there are ≥3 same-pair games, `comeback-resilience` is `active` only when the user has been down ≥5k gold at 15 min on a meaningful sample, and so on. Inactive tiles get a 1000-point penalty so they sink to the bottom of the grid, preserving the design order within each band. When the user changes the range selector, Motion's `m.div layout` springs each tile into its new position; the verdict text cross-fades via `AnimatePresence mode="popLayout"` keyed on the verdict string. The most-relevant verdicts physically rise to the top.

The reflow only works because the primitive is verdict-first. A tile that exposed a chart-only API would have no honest signal for "how interesting is this right now." The `{ verdict, evidence, prescription? }` shape gives the parent grid one bit (active / inactive) and one ordinal (designPriority within the active band), and that's enough to drive the layout. The motion is documented in [motion-without-gimmicks.md](./motion-without-gimmicks.md); the *legibility* of the motion is downstream of the primitive's shape.

## Where the pattern stops being right

The pattern is not universal. Three places in the app deliberately don't use it.

**Score-of-game badges on match detail.** The match detail hero shows per-player score-of-game (kills/deaths/assists, damage, vision, gold). These are deliberately verdict-free. A "verdict" on a single game would either be empty (one game is always small sample) or scoreboard-toned (you vs the lobby). The match-detail surface is *the receipt of one event*, and the user is the one who decides whether they played well — the app's job is to make that judgment cheaply by laying the numbers next to lane-opponent comparisons, not to render a sentence. Honest match-level verdicts come *one layer up* in the Post-game close-the-loop section, which reads patterns across the most-recent match plus history.

**The live in-game page.** The Live route renders the 5v5 grid for an active game. There are no verdicts because there is nothing yet to be retrospective about. The surface is real-time picks, bans, summoners, mastery — a tactical read for the next 30 seconds, not a calm-coaching surface. Putting a `ConclusionCard` here would be tonally wrong: you don't tell a player what just happened while it's still happening.

**Population-baseline tiles.** The Phase T4 Phase-A trio uses role-population baselines because there's no personal alternative on the same role. Even there, the verdict tone is held: *"On Vex (your main mid), you're averaging 32% damage share — 4pp above the MID role's 28% baseline."* The phrasing keeps the user as the unit of analysis ("On Vex," "your main mid") and uses the population number as a reference, not a frame. If the verdict had read *"32% damage share, 64th percentile of mid-laners"* the cohort would have crept into the foreground and the tone would have flipped.

The discipline is honest about all three: the pattern stops being right when (a) there's no retrospective claim to make, (b) the timeframe is the wrong shape (single event, live event), or (c) honest analysis would force a population frame. In practice, "no neutral middle" means tiles that can't earn a verdict get rejected from the surface — not given a fake one.

## A read on the genre

The genre's homepage element is the champions table — a sortable grid of the user's most-played champions, decorated with rank flags, win/loss streaks, and KDA pills. It is dense, factually correct, and silent about what any of the rows *mean*. The companion-app market converged on this shape because the data shape is convenient (one row per champion) and because the user population that lands on these sites is, on the median, expert enough to do the inference themselves.

The verdict-first approach is a different bet. It assumes the marginal user — the one who would otherwise bounce off the dense grid — is the audience worth designing for, and that the expert user can still drill into the chart under the verdict if they want the receipt. The chart is not removed; it is reframed as *evidence for an already-stated claim*. The expert pays no cost (the chart is one click below the sentence). The marginal user gains a sentence to anchor the page.

What op.gg / u.gg / blitz / mobalytics could not adopt cheaply is the *constraint* — the no-neutral-middle rule. Their data architecture is built around population aggregates (rank-tier averages, role-percentile distributions) because those are what's tractable from a stranger's-eye-view dataset. A verdict shape forces commitments at the tile level: "is this firing, is this muted, is this empty." That commitment is structurally easier when the baseline is *the same player's own history* (you-vs-you), and structurally harder when the baseline is global percentile across millions of players (where there's always *something* to render). The personal-baseline frame and the verdict-first primitive are two halves of the same architectural choice.

The screenshot pair to put under this section: the same player's most-played champion as it appears on op.gg ("Vex — 28 games, 53% WR, 2.4 KDA, ranked solo, S24 split 1") next to the same data through the vyoh stack ("Workhorse champion — Vex, 28 games, +4pp above your account average. Up on patch 26.9 — 18% of your games (vs 10% on 26.8)"). [evidence: side-by-side capture pending — owner to add post-draft]

## Looking back

A pattern is portfolio-relevant when it carries weight beyond the page it was first built for. `ConclusionCard` started as the visual anatomy of a single Trends rework ([trends-rework.md](../working-notes/archive/trends-rework.md) Phase T2), formalizing the verdict / evidence / prescription idea so retrofitted tiles all rendered the same way. Twelve months of feature work later it's reachable from 22 distinct call sites across two top-level routes, plus a sibling shape in two more surfaces. The single most-reused, most-distinctive abstraction in the LoL section is a 65-line component and a 9-field interface.

A few things to call out about the design-as-engineering frame:

1. **The interface is the design language.** Five fields, one optional `empty` flag, no `tone` / `severity` / `score`. The omissions are what shape the surface. A primitive that exposed a tone enum would have produced color-coded leaderboard tiles by the second sprint.
2. **The constraint compounds.** Every new tile that uses `ConclusionCard` reinforces the three-exits rule, which makes the next tile easier to write to the rule, which keeps the tonal voice consistent across 20+ files written months apart.
3. **Trust calibration is a primitive, not a footnote.** The 14-pixel sample-size badge with three Radix-tooltip labels is shared across every card; readers internalize the partial-circle vocabulary once and apply it everywhere. *This* is what lets the verdicts carry weight: the badge is always next to them, saying how much trust the sentence earns.
4. **The pattern depends on a deeper architectural choice.** You-vs-you baselines are what keep the verbs honest; a percentile frame would force scoreboard tone within a sprint. The personal-baselines decision (documented separately, audited via per-file `// Baseline: <kind>` markers) is the load-bearing infrastructure underneath the visible primitive.
5. **"No neutral middle" is the constraint that makes the surface possible.** Tiles that cannot earn a verdict on a window's data sink to the bottom of the magazine grid via activation-priority sort, or render an explicit empty state ("Need 5+ games"). Neither path admits a "show the chart anyway" fallback. The honest empty card is the cost; the verdict density of the page is the payoff.
6. **Restraint vs the genre is explicit, not dismissive.** Op.gg / u.gg / blitz / mobalytics are well-built and serve their audience. The vyoh divergence is a different bet on what the marginal reader needs, not a claim that the genre default is wrong. The case study works because the divergence is concrete (two primitives, one constraint, one architectural choice underneath) rather than aesthetic.

The remaining open question is at what scale the pattern saturates. Twenty-two call sites is enough to validate the shape; a hundred would test whether the verdict copy stays distinctive or starts repeating. The next two surfaces (composite LP forecast, post-game peer-route artifact) will be the read on whether the primitive carries one more layer of composition without losing voice.

## Where the code lives

| Concern | File |
|---|---|
| `ConclusionCard` primitive (65 lines) | [apps/web/src/lol/trends/_shared/conclusion-card.tsx](../../apps/web/src/lol/trends/_shared/conclusion-card.tsx) |
| `SampleSizeBadge` primitive | [apps/web/src/lol/trends/_shared/sample-size-badge.tsx](../../apps/web/src/lol/trends/_shared/sample-size-badge.tsx) |
| Sibling `RitualSignal` shape + `SignalTile` | [apps/web/src/lol/profile/ritual-tile.tsx](../../apps/web/src/lol/profile/ritual-tile.tsx) |
| Cleanest three-exits worked example | [apps/web/src/lol/trends/trend-tilt-indicator.tsx](../../apps/web/src/lol/trends/trend-tilt-indicator.tsx) |
| Multi-empty-path verdict tile | [apps/web/src/lol/trends/trend-worst-matchup.tsx](../../apps/web/src/lol/trends/trend-worst-matchup.tsx) |
| Champion-detail verdict tile (drift) | [apps/web/src/lol/champions/champion-pool-drift.tsx](../../apps/web/src/lol/champions/champion-pool-drift.tsx) |
| Pregame Ritual surface | [apps/web/src/lol/profile/profile-pregame-ritual.tsx](../../apps/web/src/lol/profile/profile-pregame-ritual.tsx) |
| Post-game close-the-loop surface | [apps/web/src/lol/profile/profile-post-game.tsx](../../apps/web/src/lol/profile/profile-post-game.tsx) |
| Static role baselines (the principled population exception) | [apps/web/src/lol/_shared/role-baselines.ts](../../apps/web/src/lol/_shared/role-baselines.ts) |
| Personal-baselines framing note | [docs/working-notes/personal-baselines.md](../working-notes/personal-baselines.md) |
| Trends-as-conclusions rework (where the primitive was first formalized) | [docs/working-notes/archive/trends-rework.md](../working-notes/archive/trends-rework.md) |
| Post-game close-the-loop arc | [docs/working-notes/post-game-close-the-loop.md](../working-notes/post-game-close-the-loop.md) |
| App-state-analysis (where the pattern is identified as the differentiator) | [docs/working-notes/app-state-analysis.md](../working-notes/app-state-analysis.md) |

## Open

- **Side-by-side genre screenshots.** The single highest-leverage piece of evidence for the case study is a paired capture of the same player's data through op.gg / u.gg / blitz / mobalytics next to the vyoh rendering. [evidence: pending — owner to capture post-draft and slot into the *A read on the genre* section]
- **Composite LP forecast as the next composition test.** The fifth surface to use the verdict shape — composing the four pregame signals into one verdict + confidence — is tracked in [app-state-analysis.md](../working-notes/app-state-analysis.md) as broader-gap #2. Lands as a single tile next to Pregame Ritual; doesn't require new primitive work, only a confidence-model decision (naive equal-weight vs. tiny linear fit on the user's own LP-history snapshots).
- **Post-game peer-route artifact (PG4).** The static Post-game section on Profile is shipped (PG1–PG3); the peer route at `/lol/$accountSlug/post-game/$matchId` is intentionally deferred to v2 per [post-game-close-the-loop.md](../working-notes/post-game-close-the-loop.md). When it lands it becomes the densest single-page application of the verdict pattern in the app — a per-game calm-Wrapped that's the natural OG-image surface.
- **Verdict-copy review at saturation.** Twenty-two call sites validate the shape; the next read is at fifty, on whether verdict copy stays distinct enough that two tiles never feel like duplicates of each other. The `summarize(stats)` per-tile pattern keeps the copy parameterized by data, but the *templates* are still hand-written. A retrospective on which templates aged well vs which ones started feeling formulaic would inform the next round of tile authoring.
