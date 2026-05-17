# Working notes

**Status:** Index — folder map. Read first when landing in `docs/working-notes/`.

Planning surface for vyoh.gg. Each file is one arc, one bug, one idea, or one reference. This folder is internal: working notes are where ideas live *before* they ship; [case studies](../case-studies/) are where they go public *after* they ship.

## Where to start

- **What's the next thing to do?** → [open-work.md](open-work.md)
- **What's deliberately paused?** → [parked.md](parked.md)
- **What's already shipped?** → [archive/](archive/) for fully-resolved notes; otherwise skim each active note's `**Status:**` line.
- **Why is it the way it is?** → [project-history.md](project-history.md) (append-only ship log) or the relevant note's own decision log.
- **Browse before scoping** → [vnext-ideas.md](vnext-ideas.md), [self-portrait-surfaces.md](self-portrait-surfaces.md), [lol-owner-data-features.md](lol-owner-data-features.md), [motion-backlog.md](motion-backlog.md), [library-shortlist.md](library-shortlist.md).

## Status convention

Every note carries a `**Status:** <state> — <one-line>` header right under its H1. Skim-scanning this folder should reveal active arcs from Status lines alone, without opening each doc.

| State | Meaning |
|---|---|
| **Active** | Has unshipped work. Appears as a tracked arc in [open-work.md](open-work.md). |
| **Shipped** | All planned work landed. Kept for reference until its decision log stops being load-bearing, at which point it migrates to [archive/](archive/). |
| **Parked** | Deliberately deferred for a stated reason (cost, sequencing, dependency, marginal payoff). Appears in [parked.md](parked.md) with a trigger condition. |
| **Reference** | Living catalog, idea backlog, or append-only log. Never "completes" — consult when scoping new work, don't try to drain. |
| **Index** | Reserved for the two index files ([open-work.md](open-work.md), [parked.md](parked.md)), [archive/README.md](archive/README.md), and this file. |

## Two indexes, two purposes

- [open-work.md](open-work.md) carries **next action** for each tracked arc — what would you pick up if you sat down today.
- [parked.md](parked.md) carries **trigger condition** for each paused item — what has to be true for it to come back.

Both indexes are maintained in the **same commit** that ships, parks, promotes, or revives an item. Entries never grow beyond a sentence — detail lives in the owning note.

## Adding a new note

1. Pick the status state.
2. Write the H1, then the `**Status:** ...` line, then the body.
3. If **Active**, add a one-line entry to [open-work.md](open-work.md) with a link to the new note.
4. If **Parked**, add a one-line entry to [parked.md](parked.md) with the trigger condition.
5. Link inbound from neighbouring notes (decision log, parent arc) so the new note is reachable.

## Archive

[archive/](archive/) holds fully-shipped notes whose planning detail is no longer load-bearing. See [archive/README.md](archive/README.md) for the inventory and move criteria. After an archive move, repair inbound links in the same commit:

```sh
ugrep -rEn '\]\([^/)]*FILENAME\.md' docs apps packages
```

## Companion docs

- [../case-studies/](../case-studies/) — public write-ups; one per shipped arc worth a portfolio story.
- [../repo-conventions.md](../repo-conventions.md) — portable rules (architecture, environment, workflow) that survive across machines.
- [../../CLAUDE.md](../../CLAUDE.md) — repo-specific Claude Code instructions (gitignored; per-machine).
