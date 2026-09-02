# Web structure findings — 2026-06-11 audit

**Status:** Active — W5 shipped with the TanStack Start migration (2026-07-27: `queryOptions` factories in 15 hooks, `ensureQueryData` in 11 route loaders). W1 shipped 2026-09-02 (see § W1). W2–W3 remain quick wins (≤1 sub-session each), tracked under Adjacent maintenance in [open-work.md](../open-work.md); W4 is parked until chapter #3 is scoped ([parked.md](../parked.md)). Re-verified 2026-09-01: the sheen recipe is still inline at its 3 sites, `match-detail-recap-tab.tsx` is 908 lines.

Parent index: [audit-2026-06-11.md](audit-2026-06-11.md). Baseline verdict: `apps/web` is structurally healthy — clean lol/steam/home domain boundaries, two-tier `_shared/` strategy working, no circular imports, consistent `@/` imports, zero TODO debt. The items below are the residue.

## W1 — Dedupe `home/` utility functions

**Shipped 2026-09-02.** The two chapter copies of `formatRelative` were identical and became `formatElapsedCompact` in `packages/shared/src/format.ts` (the compact, suffix-less sibling of `formatTimeAgo`); the footer-chips variant was `formatTimeAgo` minus a months rung, so it now calls `formatTimeAgo` and a build older than 30 days reads "45d ago" instead of "1mo ago" (an unparsable build time would read "NaNd ago" rather than "just now", unreachable since `vite.config.ts` always defines a valid ISO). `firstSentence` moved to `apps/web/src/home/_shared/first-sentence.ts` with its own test — web-only, so the `home/_shared/` bucket below is now real. The local `formatDuration` in `lol-moment-beat.tsx`, which shadowed the shared export with different output, is renamed `formatWholeMinutes`.

Verified duplication (2026-06-11, `ugrep -l`):

- `formatRelative()` — 3 copies: [ahri-chapter.tsx](../../../apps/web/src/home/recap/ahri-chapter.tsx), [steam-chapter.tsx](../../../apps/web/src/home/recap/steam-chapter.tsx), [footer-chips.tsx](../../../apps/web/src/home/conclusion/footer-chips.tsx).
- `firstSentence()` — 2 copies: [steam-chapter.tsx](../../../apps/web/src/home/recap/steam-chapter.tsx), [steam-moment-beat.tsx](../../../apps/web/src/home/recap/steam-moment-beat.tsx).

The text below is the original scoping; the `formatRelative` copies went to shared after all, since `formatTimeAgo` already lived there. Per the [cross-package utilities convention](../../repo-conventions.md#cross-package-utilities-belong-in-packagessharedsrc), duplication is a defect, not style. These are web-only → extract to `apps/web/src/home/_shared/` (create the bucket; `home/` is the only domain without one). Move the existing tests with them. If the api ever needs `formatRelative`, promote to `@vyoh/shared` at that point, not pre-emptively.

## W2 — Extract the sheen-overlay recipe

The `--sheen-extent` sheen treatment (registered `@property` in [index.css](../../../apps/web/src/index.css)) has its ~300-char component class recipe copy-pasted across 3 sites: [library-tile.tsx](../../../apps/web/src/steam/library/library-tile.tsx), [steam-game-row.tsx](../../../apps/web/src/steam/_shared/steam-game-row.tsx), [hundred-percent-hall.tsx](../../../apps/web/src/steam/achievements/hundred-percent-hall.tsx). Same disease the 2026-06-11 tooltip consolidation cured (21 local copies + ~21 inline strings before `lib/tooltip.ts`).

Fix shape: same as tooltip — exported recipe constant(s) in `apps/web/src/lib/` (or a `<SheenOverlay />` component if the markup is identical too, decide at implementation). All current consumers are Steam-side, but the recipe is not Steam-specific — `lib/` over `steam/_shared/`. Keep the `[data-sheen]` reduced-motion silencing contract intact (see [reduced-motion-replacements.md](reduced-motion-replacements.md)).

## W3 — Decompose `match-detail-recap-tab.tsx`

[match-detail-recap-tab.tsx](../../../apps/web/src/lol/matches/match-detail-recap-tab.tsx) is 911 lines with 5+ inline sub-components (`ItemSlot(s)`, `StatBar`, `ObjectivePip`, `TeamObjectiveStrip`, …). Extract sub-components into `apps/web/src/lol/matches/recap/` (mirrors how `home/recap/` is bucketed). Pure file-move refactor — no behaviour change, no new tests required beyond moving colocated ones. Do it before the next Phase-D match-depth item touches this tab.

## W4 — Extract shared recap-chapter primitives

[steam-chapter.tsx](../../../apps/web/src/home/recap/steam-chapter.tsx) (1015 lines) and [ahri-chapter.tsx](../../../apps/web/src/home/recap/ahri-chapter.tsx) (945 lines) share patterns that [subject-chapter-design-spec.md](subject-chapter-design-spec.md) documents in prose but the code duplicates: list-row treatment, hover chrome, animation cascade scaffolding, relative-time chips (W1 overlaps here — land W1 first).

Trigger: **before scoping chapter #3** (next LoL champion chapter or moment-chapter variant). The design spec is the source of truth for *which* patterns count as mature primitives; extract exactly those into `home/recap/_shared/`, leave per-subject hooks bespoke. Chapter #3 then becomes the proving consumer — don't extract speculatively beyond what both existing chapters already share (per the "three similar lines beat a premature abstraction" rule).

## W5 — queryOptions factories + route-loader prefetch

**Shipped 2026-07-27** as part of [tanstack-start-migration.md](tanstack-start-migration.md) chunks 4a–5: the loader integration below is what the SSR cutover needed, so it landed there rather than as a standalone chunk. The text below is the original scoping.

Current state: ~7 hooks export `queryOptions` factories (Steam best, LoL mixed, `home/` zero — all inline `useQuery`). Query-key grammar is already consistent (`[domain, feature, ...params]`), so this is mechanical.

The payoff is not consistency, it's **loader integration**: `defaultPreload: "intent"` currently preloads route *code* only — no route uses `ensureQueryData`, so data fetch starts at render. Factories + `context.queryClient.ensureQueryData(...)` in route loaders gets hover-to-paint data prefetch, and is the committed migration-safe TanStack Start prep — this chunk **is** the "Round 5 N route-loader pilot" from [frontend-2026-gaps.md](frontend-2026-gaps.md) grown to full scope. Sequence: (a) pilot on match-detail (Round 5 N as written, ~1h), (b) factory sweep per domain (`home/` first — smallest, zero adoption), (c) loader fan-out across detail routes (the pending "loader half" of Round 5 P). Coordinate with [tanstack-start-migration.md](tanstack-start-migration.md) — don't land (c) in a shape Start would re-do.

## Explicitly not chunked

- **Component-test thinness in `components/` and recap chapters** — hooks and `_shared/` are well-tested; UI primitives are low-ROI (shadcn-shaped); recap chapters are art-heavy. The standing same-commit-tests rule covers new surfaces; no retroactive sweep scheduled. Revisit only if a chapter regression escapes to `main`.
- **command-palette-dialog.tsx size (745 lines)** — single responsibility, splitting would fragment the grammar wiring. Leave.
