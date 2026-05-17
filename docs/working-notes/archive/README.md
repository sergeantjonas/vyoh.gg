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

## Maintenance rule

When archiving a note: `git mv` it here, add the row above, and update inbound links in [open-work.md](../open-work.md), [parked.md](../parked.md), `CLAUDE.md`, and any sibling note that points at it. Reviving (rare): `git mv` back to `working-notes/`, flip `**Status:**`, remove the row above.
