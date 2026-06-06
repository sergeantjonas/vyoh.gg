# Working notes archive

**Status:** Index — fully-shipped working notes kept for historical context only.

Notes move here when **every phase has shipped** *and* the planning detail is no longer load-bearing for active work. The archive exists so the live `working-notes/` folder stays a list of *what's in flight or pending*, not a mix of planning records and shipped decision logs.

## Criterion for archiving

A note belongs here when **all** of the following hold:

1. `**Status:**` is `Shipped` (no open phases, no parked sub-items being actively considered).
2. The decision log it preserves is referenced rarely — typically only when chasing "why did we build it this way" archaeologically.
3. Active follow-ups have moved out — into [open-work.md](../open-work.md), [parked.md](../parked.md), or sibling working notes — so removing the file from the live folder wouldn't drop anything live.

A note **stays in the live folder** even if shipped when:

- It carries an ongoing reference role (idea backlogs, framing decisions, baselines).
- Some part is still actively considered (e.g. a parked tier that could be revived).
- New follow-up work routinely lands against it.

## Inventory

| File | Shipped | Why archived |
|---|---|---|
| [home-deck.md](home-deck.md) | 2026-05-14 | Chunks 1 + 2 both shipped; the home page has since grown additional tiles directly in `apps/web/src/home/` and future tile candidates live in [self-portrait-surfaces.md](../cross-cutting/self-portrait-surfaces.md), not here. |
| [section-layout-extraction.md](section-layout-extraction.md) | 2026-05-15 | All five chunks landed; future TFT composition will just compose `<SectionShell>` without re-opening the design log. |
| [trends-rework.md](trends-rework.md) | 2026-05-16 | T1 + T2 + T3 + T4 all shipped; new trends tiles enter via [vnext-ideas.md](../cross-cutting/vnext-ideas.md) or [personal-baselines.md](../lol/personal-baselines.md), not here. |
| [views-roadmap.md](views-roadmap.md) | 2026-05-16 | Phases 0–6 all shipped; Profile additions now route through [home-deck.md](home-deck.md) and [self-portrait-surfaces.md](../cross-cutting/self-portrait-surfaces.md). |
| [lol-patch-notes.md](lol-patch-notes.md) | 2026-05-17 | PN1–PN7 all landed; "Open questions" (historical backfill, change-type classification) deferred without active arcs. |
| [view-transitions-rollout.md](view-transitions-rollout.md) | 2026-05-24/25 | All catalogued morphs shipped (champion/match/Steam library list↔detail, Steam row hero/logo, screenshot strip → lightbox, patches cross-version reflow, Steam library + LoL champion-table sort/filter reorder) or closed as abandoned (LoL multi-element refinement, LoL match-list queue-filter reorder). Rect-morph fallback stays; remaining candidate surfaces (wishlist↔detail, achievements sort, trophy-case expand) gated on UX that doesn't exist. New per-element morphs reuse the documented patterns. |
| [nav-condensation-arc.md](nav-condensation-arc.md) | 2026-05-31 | Every chunk landed: three-layer chrome → two; Model 3 master→detail with breadcrumb section-switcher; cinematic hero on Profile that morphs into section strip; hero-avatar activity ring; topbar `AccountRow` showcase; narrow-viewport polish pass; display headline + animated rank crest. Trailing items homed elsewhere ([steam-lol-parity.md](../cross-cutting/steam-lol-parity.md) Steam single-card, [pointer-parallax-splash.md](../cross-cutting/pointer-parallax-splash.md) avatar hover). |
| [command-palette-reorg.md](command-palette-reorg.md) | 2026-05-28 | All chunks shipped (Matches gate, Steam "Current section" tabs, group reorder, chord label cleanup, lessons writeback). Palette grammar lives in [command-palette.md](../cross-cutting/command-palette.md). |
| [mount-and-overlay-motion.md](mount-and-overlay-motion.md) | 2026-05-27 | Chunks 1/4/5 landed (bento `.stagger-children`, virtualizer-safe `data-mount-stagger`, Radix popper `@starting-style`); Chunks 2+3 descoped (existing Motion stagger was richer); Chunk 6 sweep clean. |
| [data-viz-densification.md](data-viz-densification.md) | 2026-05-27 | All three parts shipped (inline sparklines pipeline + a11y, `:has()` parent-aware sibling dim, OKLCH ambient hue drift). Trends summary cards reclassified as non-fit. |
| [editorial-typography.md](editorial-typography.md) | 2026-05-27 | All chunks shipped plus cross-app extension sweep + primitive bifurcation. `HeroNumber`/`HeroLabel`/`HeroPair` + `SectionTitle`/`CardTitle` slot pattern codified in [repo-conventions.md](../repo-conventions.md). Remaining percent sites tracked in [quick-wins.md](../cross-cutting/quick-wins.md). |
| [page-composition.md](page-composition.md) | 2026-05-27 | Chunks 1, 2, 4, 5 shipped; Chunk 3 (owner-run visual capture) deferred non-blocking. Compositional container rule codified in [repo-conventions.md](../repo-conventions.md) § "Page composition". Secondary-surface backlog remains as standing reference inside the archived note. |
| [champion-accent-color.md](champion-accent-color.md) | 2026-05-26 | Iconic-color picker shipped; drives the per-champion theme-color cascade. Future-extensions backlog (alternative extraction libs to shrink the 3-entry override list) closed as not worth chasing — current overrides cover the visual gap. |

## Maintenance rule

When archiving a note: `git mv` it here, add the row above, and update inbound links in [open-work.md](../open-work.md), [parked.md](../parked.md), `CLAUDE.md`, and any sibling note that points at it. Reviving (rare): `git mv` back to `working-notes/`, flip `**Status:**`, remove the row above.
