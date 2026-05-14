# Home deck — bento self-portrait surface

The site's home page (`/`) is currently a stub: an `<h1>` plus a single muted paragraph pointing visitors at `/lol`. This note tracks the arc that turns the home page into the **self-portrait deck itself** — a bento mosaic of `ConclusionCard` tiles rendering verdicts about the owner, not a navigational entry hall.

Direction inherits from [self-portrait-surfaces.md](self-portrait-surfaces.md). This note is the *implementation* arc; the parent note is the *content* candidate list.

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

### Chunk 1 — bento primitive + minimum-viable tile set

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

### Chunk 2 — chronotype as headline tile (sketch only)

Adds the first new derivation. Promoted to the `2×2` hero slot in the bento. Chunk 2 will need its own session because it has a server-side derivation component (cron pattern? on-demand query? where derivation jobs live in this repo?) that hasn't been oriented to yet.

Anticipated scope: ~4–5 files. Server-side best-hour-by-outcome derivation against existing match timestamps → `tile-chronotype.tsx` → promote to hero in `routes/index.tsx`.

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
