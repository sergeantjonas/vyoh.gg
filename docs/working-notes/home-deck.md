# Home deck — bento self-portrait surface

**Status:** Shipped — both chunks shipped: Chunk 1 (bento primitive + minimum-viable tile set: build-badge, domain-age, last-match, signature-game) and Chunk 2 (chronotype 2×2 hero tile, 2026-05-14). The deck has since grown beyond the original plan with additional self-portrait tiles wired in `apps/web/src/home/` (day-split, first-played, session-lengths, weekly-totals — most cross-stream synthesis once Steam landed). Future tile candidates live in [self-portrait-surfaces.md](self-portrait-surfaces.md), not here.

This note tracks the original arc that turned the home page from an `<h1>` stub into the **self-portrait deck itself** — a bento mosaic of `ConclusionCard` tiles rendering verdicts about the owner, not a navigational entry hall.

Direction inherits from [self-portrait-surfaces.md](self-portrait-surfaces.md). This note is the *implementation* arc; the parent note is the *content* candidate list.

---

## What belongs on `/` (sharpened 2026-05-16)

`/` is for **cross-stream synthesis**, not stream-deep feeds. Anything that's really "the latest commit" or "top tracks this week" belongs on its own per-stream route (`/code`, `/music`) — not as another tile here. The home deck can carry at most a single curated highlight per stream that links into the deep route.

The chronotype tile (chunk 2, shipped) is the canonical shape: hour-bucketing merged across whichever streams are wired produces a verdict no per-stream route could. Future tiles that pass the bar are similar — "what am I doing right now" across all live streams, "this week's dominant activity", a synthesis recap. Future tiles that *don't* pass the bar: a Spotify now-playing list, a GitHub contributions grid, a Steam recently-played feed. Those live on `/music`, `/code`, `/steam`.

Without this rule, `/` accumulates one stream-feed per integration and the self-portrait synthesis story drowns in feeds. See [self-portrait-surfaces.md § Routing principle](self-portrait-surfaces.md#routing-principle-sharpened-2026-05-16) for the parallel articulation.

---

## Framing decision

Two layouts were weighed against each other:

- **Vertical recap composition** — reuse the recap composer (`apps/web/src/routes/lol/$accountSlug/recap.tsx`) wholesale, render owner-scoped verdicts as a scroll. Cheap, forgiving, mobile-native. Cons: looks like every other recap surface on the site (especially `/lol/$accountSlug/recap`), hides everything below the fold, lacks editorial hierarchy.
- **Mosaic / bento grid** — varied-weight tiles in a CSS grid, visible at a glance. Cons: grid-layout work up front, hostile to empty/stale tiles, mobile collapses to vertical anyway.

**Chosen: mosaic.** Reasons:

1. The whole point of the self-portrait framing is freelance signal. Mosaic is the version that *does* that job; recap-vertical is the safe-ship version of an idea whose entire point was to take a swing.
2. The empty-state risk (named in the self-portrait hard filter: *"an empty or stale panel reads worse than no panel"*) is neutralised by an **always-fills floor** — at least three tiles guaranteed to render under any data condition (build/deploy badge, domain-age, last match).
3. `ConclusionCard` already supports an `empty` state (see [`conclusion-card.tsx:16`](../../apps/web/src/lol/trends/_shared/conclusion-card.tsx#L16)), so individual tiles degrade gracefully without the *grid* having to.

---

## Primitives the bento reuses

The deck does not introduce new card visuals. It composes existing primitives in a new layout.

- [`ConclusionCard`](../../apps/web/src/lol/trends/_shared/conclusion-card.tsx) — tile body. Props already cover title, verdict, evidence, prescription, sample-size, empty.
- Recap composers under `apps/web/src/lol/recap/` — owner-scoped tile content. Each requires `account` + `matches`.
- [`useMe()`](../../apps/web/src/identity/use-me.ts) — owner identity. First entry in `me.data?.lol` is the primary account; same convention used by [`apps/web/src/routes/lol/index.tsx:11`](../../apps/web/src/routes/lol/index.tsx#L11).

The only *new* primitive the deck needs is a bento layout grid. Placed in `components/bento/` (not under `home/`) so future surfaces (Steam home, cross-account view) can reuse without promotion churn.

---

## Chunk plan

Two chunks. Chunk 1 is independently committable — ships a complete home page on its own. Chunk 2 is planned at a sketch level only; detailed plan happens in a fresh session after chunk 1 lands.

### Chunk 1 — bento primitive + minimum-viable tile set *(shipped — chunk landed before chronotype on 2026-05-14)*

**Goal:** replace the home stub with a real bento deck. Zero new derivations — owner-scoped tiles reuse existing recap composers, site-level tiles read build-time constants.

**Files (new):**

| File | Purpose |
|---|---|
| `apps/web/src/components/bento/bento-grid.tsx` | CSS-grid layout primitive. Tile weights: `1×1`, `2×1`, `1×2`, `2×2`. Mobile collapses to single column. Auto-reflows when a tile renders `null`. |
| `apps/web/src/components/bento/bento-tile.tsx` | Span-aware wrapper. Collapses into `bento-grid.tsx` if the API stays small. |
| `apps/web/src/home/use-primary-account.ts` | Wraps `useMe()`, returns the first account or a loading/empty signal. |
| `apps/web/src/home/tile-build-badge.tsx` | Site-level. Reads `__BUILD_TIME__` + `__BUILD_COMMIT__` injected at build time. *"Last deployed 14h ago, commit `e1814c6`."* |
| `apps/web/src/home/tile-domain-age.tsx` | Site-level. Days since launch date (hardcoded constant). |
| `apps/web/src/home/tile-last-match.tsx` | Owner-scoped. Pulls primary account's most recent match. |
| `apps/web/src/home/tile-signature-game.tsx` | Wraps `RecapSignatureGame` with primary-account default. |

**Files (modify):**

| File | Change |
|---|---|
| `apps/web/src/routes/index.tsx` | Replace stub with `<BentoGrid>` composition. |
| `apps/web/vite.config.ts` | Inject `__BUILD_TIME__` and `__BUILD_COMMIT__` via `define`. (Verify config file location during chunk 1.) |
| `docs/working-notes/open-work.md` | Add a pointer to this note. |

**Always-fills floor:** build-badge + domain-age + last-match. These three render under any data condition — primary account missing, no recent matches, fresh deploy — and guarantee the page never looks broken.

**Validation:** `pnpm run check:cc`, `pnpm run typecheck:cc`. UI verification in dev server: desktop, mobile breakpoint, and an intentional empty-state for one owner-scoped tile.

**Out of scope:** chronotype, GitHub, Spotify, ambient accent color, `/changelog` route, mosaic editing UI, drag-to-reorder.

### Chunk 2 — chronotype as headline tile *(shipped 2026-05-14)*

Hour-of-day heatmap, 24 vertical bars, height = games played, color = win rate. Verdict-less by editorial choice (the bars *are* the verdict); `SampleSizeBadge` carries the n.

Shape decisions taken during implementation:

- **No cron / no pre-compute.** On-demand query against the indexed `Match` table matches the `getDuos` / `getChampionPairs` pattern. Default reach is the last 500 non-remake matches; the index `[puuid, playedAt]` makes this cheap.
- **Server-side bucketing in `Europe/Brussels`.** Riot stamps are absolute; the heatmap reads as a *self-portrait* only when bucketed in owner-local time. Implemented via `Intl.DateTimeFormat({ timeZone: "Europe/Brussels", hour: "2-digit", hourCycle: "h23" })`. Timezone is hard-coded on the server, returned in the response payload so the tile can render the label without re-knowing it.
- **No sample-size gate.** Reader sees the full 24 hours and the total-game `SampleSizeBadge`; they judge for themselves. Color thresholds were chosen so 50%±2.5pp reads as a neutral muted tone — only meaningful deviations tint emerald/rose.

**Files (new):**

- `packages/shared/src/lol/chronotype.ts` — `Chronotype` + `ChronotypeHour`.
- `apps/web/src/lol/profile/use-chronotype.ts` — react-query hook.
- `apps/web/src/home/tile-chronotype.tsx` — 24-bar heatmap tile.

**Files (modified):**

- `apps/api/src/lol/lol.service.ts` — `getChronotype(region, gameName, tagLine, count = 500)`.
- `apps/api/src/lol/lol.controller.ts` — `@Get("chronotype")`.
- `packages/shared/src/index.ts` — barrel export.
- `apps/web/src/routes/index.tsx` — promote `TileChronotype` to `2×2` hero, ahead of signature-game / last-match / build-badge / domain-age.

---

## Open questions

- **Build-time constants in vite.** Need to confirm vite config location (`apps/web/vite.config.ts` vs root) and whether `define` is already in use for other constants. Resolved during chunk 1.
- **Domain-age launch date.** Pick the first-commit date of the repo, the first-deploy date, or `vyoh.gg` registration date? Each tells a different story. Decide before writing `tile-domain-age.tsx`.
- **Mobile bento collapse.** Does the always-fills floor stay above the fold on mobile, or does the hero tile push it down? Worth verifying once the grid renders.

---

## Related arcs

- [self-portrait-surfaces.md](self-portrait-surfaces.md) — parent direction. Candidate list for future tiles beyond chunk 1.
- [trends-rework.md](trends-rework.md) — origin of the `ConclusionCard` primitive.
- [case-study-topics.md](case-study-topics.md) — the bento + self-portrait surface is a plausible freelance case-study topic; flag after chunk 1 ships, not before.
