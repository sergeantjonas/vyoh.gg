# Working notes

**Status:** Index — folder map. Read first when landing in `docs/working-notes/`.

Planning surface for vyoh.gg. Each file is one arc, one bug, one idea, or one reference. This folder is internal: working notes are where ideas live *before* they ship; [case studies](../case-studies/) are where they go public *after* they ship.

## Where to start

- **What's the next thing to do?** → [open-work.md](open-work.md)
- **What's deliberately paused?** → [parked.md](parked.md)
- **What's already shipped?** → [archive/](archive/) for fully-resolved notes; otherwise skim each active note's `**Status:**` line.
- **Why is it the way it is?** → [project-history.md](project-history.md) (append-only ship log) or the relevant note's own decision log.
- **Browse before scoping** → [vnext-ideas.md](cross-cutting/vnext-ideas.md), [idea-pool-2026-06.md](cross-cutting/idea-pool-2026-06.md), [self-portrait-surfaces.md](cross-cutting/self-portrait-surfaces.md), [lol-owner-data-features.md](lol/lol-owner-data-features.md), [motion-backlog.md](cross-cutting/motion-backlog.md), [library-shortlist.md](cross-cutting/library-shortlist.md).

## Read before scoping

Per-note summaries with **read-before** triggers. Auto-memory already points at `open-work.md`, `steam-integration.md`, `tft-integration.md`, `self-portrait-surfaces.md`, `owner-auth.md`, `hosting.md`; these are the rest.

- `project-history.md` — recent shipped arcs, repo evolution.
- `lol/match-depth-roadmap.md` — match-detail expansion arc. Phases A/B/C fully shipped (2026-05-16); **Phase D complete 2026-09-01** (LP-overlay per duo last, owner-only); Phase E partial. Remaining items (full rune page panel, composite "Score-of-game" S grade) live in [open-work.md](open-work.md); parked sub-items in [parked.md](parked.md). Read this for context before scoping any remaining D/E item.
- `cross-cutting/elevation-arcs.md` — index of "elevate past boring app" arcs (View Transitions, scroll-driven shell, accent system, editorial type, data viz densification, ambient hero, etc.). Pick from here when scoping the next polish/wow pass.
- `cross-cutting/self-portrait-recap-arc.md` — shipped 2026-06-07 (R-1→R-15): `/` as always-on Wrapped, multi-band editorial **chapters** over the atmosphere substrate. Reference for the recap shape; R-7i lane A/B secondary detectors parked pending real activity patterns. Supersedes [atmosphere-arc.md](cross-cutting/atmosphere-arc.md) A-3+.
- `cross-cutting/r13-exit-dissolve.md` — historical post-mortem of the R-13 beat exit-dissolve thrashing arc. Resolution shipped 2026-06-04 via IntersectionObserver-triggered Motion `animate()` (Lane 3). Read only if revisiting a similar scroll-coupled effect; the load-bearing lesson is captured in [[feedback_scroll_driven_on_compositor_thread]].
- `cross-cutting/multi-beat-chapter-arc.md` — historical: architecture + choreography plan for the multi-beat chapter experience. Shipped fully (multi-beat primitives are first-class in [apps/web/src/home/recap/](../../apps/web/src/home/recap/), no flag remaining), under a different model than the note's v2/v3 pitches. The choreography toolkit section is still a useful reference for art-direction vocabulary.
- `cross-cutting/subject-chapter-design-spec.md` — design vocabulary crystallized from the shipped R-2 Ahri chapter and applied to the shipped Steam chapter. **Read before scoping any new per-subject chapter or any editorial/hero surface** (future LoL champions, moment chapter variants, typographic statement bands outside the recap). Covers mature primitives, editorial composition rules, animation cascade, hover/interaction patterns, list-row patterns, per-subject hooks, and rejected experiments worth not re-discovering.
- `cross-cutting/accent-color-system.md` — shipped 2026-05-26: OKLCH token cascades (route-level `--theme-color` → derived `--theme-*` tiers in `index.css`; per-subject `--accent-base` → `--accent-*` tiers via relative-color syntax), `useThemeColor()` route wiring. **Read before** adding per-route theme color, a new accent consumer, or extending the token tiers.
- `cross-cutting/quick-wins.md` — atomic CSS/HTML/config improvements (one commit each) surfaced during the elevation sweep; grab one when you have ≤30 min focus.
- `cross-cutting/motion-backlog.md` — animation/polish ideas.
- `cross-cutting/library-shortlist.md` — shipped, rejected, and parked library ideas.
- `cross-cutting/frontend-2026-sweep-queue.md` — queue of **two-phase domain sweeps**: Phase 1 audits this project against KB recommendations in a frontend-2026 domain (writes to gaps/quick-wins/library-shortlist), Phase 2 distills findings into KB updates at `~/.claude/knowledge/frontend-2026/`. **Do not skip Phase 1** — it's the load-bearing step that makes the KB refresh concrete instead of generic.
- `cross-cutting/case-study-topics.md` — README/write-up topics and portfolio narrative.
- `lol/lol-image-pipeline.md` — splash-resolver fix, build-time prefetch, automated patch refresh, runtime fallback.
- `cross-cutting/perf-baseline.md` — Lighthouse/bundle baselines for evidence claims.
- `cross-cutting/panel-compositor-load.md` — diagnosis arc + architectural fix for the LoL detail-panel open/close glitches on Chrome (shipped 2026-06-09). The "panels don't claim the page-wide backdrop" rule is now convention. **Read before** touching any panel/overlay surface that claims a page-wide visual backdrop or reaching for an engine-bypass gate on a panel. Universal audit-queue items mostly absorbed into [progressive-paint-audit.md](cross-cutting/progressive-paint-audit.md).
- `cross-cutting/progressive-paint-audit.md` — 2026-06-09 baseline + chunks 0a/0b/0c/2/4/6 shipped, chunk 3 hit measurement floor (monitor-only), chunks 1/5 deprioritised. Live value is the **per-route paint budget table** (encoded as convention in [repo-conventions.md](../repo-conventions.md)) and the trace-level diagnostic shape for layer-dominance analysis. **Read before** adding a new top-level route or any layer-promoting CSS (`backdrop-filter`, `will-change`, `isolate`, `transform: translateZ(0)`, transitions on `transform`).
- `cross-cutting/command-palette.md` — ⌘K palette: reference for the shipped expansion (Phases A–G all landed 2026-05-18 → 2026-05-25 — discoverability chip, match search, typed verb grammar, champion mode, recents persistence, `/patches` navigation grammar, Steam dev/pub/franchise grammar). One open design question (first-visit nudge) remains. **Read this — and the [extending-the-palette convention](../repo-conventions-web.md#extend-the-command-palette-when-adding-filterable-surfaces) — before adding any new filter / find-by-X / deep-link surface**, so the new affordance routes through the palette grammar instead of forking it.
- `cross-cutting/steam-lol-parity.md` — historical: cross-section parity audit. All six items (scroll-reset skip-pairs, skeletons, EmptyState port, backdrop primitive extraction, tile-parity hover chrome, per-game accent color) shipped between 2026-05-24 and 2026-05-28. One trigger-gated item parked (Steam nav account-showcase, blocked on Steam gaining a nav dropdown). Read before adding a new Steam surface that has a structural equivalent in LoL.
- `cross-cutting/steam-api-unused-data.md` — Steam Web API fields reachable with our key but not surfaced today (member-since, level + percentile, owned-games backlog %, 2-week activity, badges/XP); records confirmed dead ends. Probed live 2026-05-30.
- `cross-cutting/idea-pool-2026-06.md` — index of the 2026-06-12 future-features / differentiation exploration: 12 Reference notes (portfolio surfaces like colophon + case-study reader + Angular bridge, LoL timeline replay + data stories, Steam library economics, cross-stream detectors, visual pool). Nothing scoped; browse alongside `vnext-ideas.md` + `feature-candidates-2026-06.md` when picking post-current-scope work.

## Folder layout

| Folder | Contents |
|---|---|
| [lol/](lol/) | LoL feature arcs and LoL-specific reference (match-depth, LP forecast, personal-baselines, image pipeline, Riot rate-limit investigation, the [match-count cap](lol/match-count-cap.md), etc.). |
| [steam/](steam/) | Steam integration notes. |
| [tft/](tft/) | TFT integration notes. |
| [cross-cutting/](cross-cutting/) | Notes that span multiple streams or the app at large (vnext-ideas, self-portrait surfaces, command palette, motion backlog, library shortlist, perf baseline, case-study topics). |
| [ops/](ops/) | Pre-deploy, auth, security, and structural concerns (hosting, owner-auth, security, folder-structure-cleanup). |
| [archive/](archive/) | Fully-shipped notes whose planning detail no longer carries weight. |

Stream singletons (currently `steam/` and `tft/` carry one note each) sit in their own folder so new notes land in the right place by default as the integration grows. The indexes ([open-work.md](open-work.md), [parked.md](parked.md)), this README, and [project-history.md](project-history.md) stay at the root.

## Status convention

Every note carries a `**Status:** <state> — <one-line>` header right under its H1. Skim-scanning this folder should reveal active arcs from Status lines alone, without opening each doc.

| State | Meaning |
|---|---|
| **Active** | Has unshipped work. Appears as a tracked arc in [open-work.md](open-work.md). |
| **Shipped** | All planned work landed. Kept for reference until its decision log stops carrying weight, at which point it migrates to [archive/](archive/). |
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

[archive/](archive/) holds fully-shipped notes whose planning detail no longer carries weight. See [archive/README.md](archive/README.md) for the inventory and move criteria. After an archive move, repair inbound links in the same commit:

```sh
ugrep -rEn '\]\([^/)]*FILENAME\.md' docs apps packages
```

## Companion docs

- [../case-studies/](../case-studies/) — public write-ups; one per shipped arc worth a portfolio story.
- [../repo-conventions.md](../repo-conventions.md) — portable rules (architecture, environment, workflow) that survive across machines.
- [../../CLAUDE.md](../../CLAUDE.md) — repo-specific Claude Code instructions (gitignored; per-machine).
