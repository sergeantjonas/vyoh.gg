# Patches as a global LoL surface — roadmap

**Status:** Shipped — all four chunks landed. Global `/lol/patches` and `/lol/patches/$version` routes exist; account-scoped patches routes removed; Patches dropped from the account TABS in [$accountSlug.tsx](../../../apps/web/src/routes/lol/$accountSlug.tsx); Chunk 4 (palette grammar) shipped 2026-05-23.

Read this before touching the LoL top-nav, the patches routes, or `PatchesPage`. The shape of `/lol/patches` here is also the template for future global LoL surfaces (champion DB, item meta, tier list, etc.) that have been considered for the dropdown.

---

## Premise

`/lol/$accountSlug/patches` is currently account-scoped in the route tree, sits as the 5th tab in the account subnav alongside Profile / Matches / Trends / Champions, and renders patch notes sorted by the active account's champion play counts with a "My champions only" toggle.

Two things are off:

1. **The label reads global, the content is personal.** Every other account-subnav tab is unambiguously "your X". "Patches" reads as neutral game-wide info, so the personalization (play-count sort, "my champions" filter) is hidden behind a generic noun.
2. **The patch notes themselves are a global resource.** They aren't owned by an account. Locking them behind `/lol/$accountSlug/...` means there is no link-shareable, account-free way to read them, and no natural slot for sibling global surfaces (champion DB, item meta, tier list) that are coming.

The fix is to promote Patches to a global LoL resource at `/lol/patches`, accessible via a dropdown on the top-nav LoL pill, while keeping the personalized lens reachable via an explicit `?as=<slug>` query param. The dropdown becomes the slot for future global LoL content.

---

## What this is NOT

- **Not removing personalization.** The play-count sort, "my champions only" toggle, and profile-side `ProfilePatchNotice` all survive. They activate when `?as=<slug>` is present.
- **Not implicit viewer-context.** No `?focus=me` or "guess the account from `useMe()` at render time". The account is named explicitly in the URL; "what is *me*" is answered by the slug in `?as=`.
- **Not a new top-nav pill.** Patches does not become a sibling of Home / LoL / Steam / Status. It lives under the LoL pill via a dropdown.
- **Not a per-stream rule violation.** Per [`docs/repo-conventions.md`](../../repo-conventions.md), `/lol/...` is the right home for global LoL content; only `/` is reserved for cross-stream synthesis. Patches at `/lol/patches` is on-pattern.

---

## Decision

### Route shape

- **`/lol/patches`** — canonical global index. Lists known patches, neutral framing, no account context required, link-shareable.
- **`/lol/patches/$version`** — canonical per-patch detail page. Neutral framing by default.
- **`?as=<accountSlug>`** — optional query param on both routes. When present, the page reads that account's matches, applies the play-count champion sort, and shows the "My champions only" toggle. When absent, the toggle is hidden (not disabled), and champions render in their canonical order.
- **`/lol/$accountSlug/patches[/$version]` — removed.** Optional redirect routes can `<Navigate replace />` to the global URL with `as` pre-filled, to avoid dead deep links in browser history.

### Why `?as=` instead of path-based per-account

- Explicit: the slug is named in the URL.
- Decoupled from path hierarchy: the same component handles both modes via search-param read.
- Survives copy-paste and link-sharing.
- Reads naturally in conversation: "patches as jonas-eune".
- The "no `?as=`" case is the default global view, not a degraded state.

### Top-nav LoL dropdown

The LoL pill in [apps/web/src/components/nav.tsx](../../../apps/web/src/components/nav.tsx) becomes a split affordance:

- The primary "LoL" label remains a `Link` to `/lol` (which redirects to the viewer's default account, unchanged).
- A chevron-trigger next to the label opens a Radix `DropdownMenu` with global LoL surfaces.
- For now the dropdown contains a single item — "Patches" — designed for future neighbours: champion DB, item meta, tier list, runes reference, etc.
- The "Patches" item pre-fills `?as=<default-slug>` from `useMe()` when a default account is available, otherwise links to the neutral `/lol/patches`.

A single-item dropdown is borderline heavy, but the dropdown is justified as the future slot for global LoL resources, not as a Patches-specific affordance. If the slot stays at one item for >3 months, revisit — a plain pill on the dropdown is cheaper.

### Entry points that pre-fill `?as=`

- `ProfilePatchNotice` on `/lol/$accountSlug` links to `/lol/patches/$version?as=$accountSlug`.
- The LoL dropdown's "Patches" item, when `useMe()` resolves a default account.
- Command palette grammar: `/patches 25.10` (neutral), `/patches 25.10 @jonas-eune` (with `?as=`).

---

## Chunk plan

Each chunk is independently committable and includes tests in the same commit per [repo conventions](../../repo-conventions.md). Chunks 1 → 3 are sequential; Chunk 4 can land any time after Chunk 1.

### Chunk 1 — Global `/lol/patches` routes + decouple `PatchesPage`

**Files**
- `apps/web/src/routes/lol/patches/index.tsx` (new) — `createFileRoute("/lol/patches/")`, mounts `<PatchesPage versionParam={undefined} />`.
- `apps/web/src/routes/lol/patches/$version.tsx` (new) — `createFileRoute("/lol/patches/$version")`, mounts `<PatchesPage versionParam={version} />`.
- `apps/web/src/lol/patches/patches-page.tsx` — replace `useParams({ from: "/lol/$accountSlug" })` with a `Route.useSearch()` read of `?as=<slug>`; gate match fetching, the play-count sort, and the "My champions only" toggle on `as` being present; update internal `navigate()` calls to point at the global routes.
- `apps/web/src/lol/patches/patches-page.test.tsx` — cover neutral mode (no `as`), personalized mode (`as=<slug>`), and version switching.
- `apps/web/src/routeTree.gen.ts` — regenerated.

Keeps the old account-scoped routes alive so this chunk lands without breaking links.

### Chunk 2 — `DropdownMenu` on the LoL top-nav pill

**Pre-step** — install the shadcn `dropdown-menu` wrapper, which doesn't exist in the repo yet:

```
pnpm dlx shadcn@latest add dropdown-menu
```

This lands `apps/web/src/components/ui/dropdown-menu.tsx` and adds `@radix-ui/react-dropdown-menu` to deps. Eyeball the generated file once against the existing wrappers (`popover.tsx`, `select.tsx`) for token alignment; usually shadcn's defaults match without edits.

**Files**
- `apps/web/src/components/ui/dropdown-menu.tsx` (new, generated by shadcn CLI).
- `apps/web/package.json` / `pnpm-lock.yaml` — `@radix-ui/react-dropdown-menu` added.
- `apps/web/src/components/nav.tsx` — split the LoL item into a `Link` (label + icon) plus a `DropdownMenuTrigger` (chevron), importing from `@/components/ui/dropdown-menu` (matching the rest of the codebase — *not* from `@radix-ui/react-dropdown-menu` directly). One "Patches" item for now. Pre-fill `?as=<default-slug>` from `useMe()` when available.
- `apps/web/src/components/nav.test.tsx` (new) — dropdown opens via chevron, primary "LoL" link still navigates, keyboard ↑/↓/Esc work, axe scan. Required per the "new interactive surface" rule (keyboard + ARIA + dialog/menu role).

Depends on Chunk 1's routes existing so the dropdown link target resolves.

> **Note on imports.** The project follows shadcn conventions — interactive UI primitives live under `apps/web/src/components/ui/` and are imported via `@/components/ui/<name>`. The Tooltip pattern documented in [`repo-conventions.md`](../../repo-conventions.md) ("Use `TooltipPrimitive` for all tooltip surfaces") is a deliberate exception that uses raw `@radix-ui/react-tooltip` directly. Do not generalize the Tooltip exception to other primitives; new interactive primitives go through shadcn.

### Chunk 3 — Migrate entry points, remove account-scoped patches routes

**Files**
- `apps/web/src/routes/lol/$accountSlug/patches/index.tsx` — delete (or replace with a `<Navigate replace />` redirect to `/lol/patches?as=$accountSlug`).
- `apps/web/src/routes/lol/$accountSlug/patches/$version.tsx` — delete (or redirect to `/lol/patches/$version?as=$accountSlug`).
- `apps/web/src/routes/lol/$accountSlug.tsx` — drop the Patches entry from `TABS` (line 73 today).
- `apps/web/src/lol/patches/profile-patch-notice.tsx` — point the link target at `/lol/patches/$version?as=$accountSlug`.
- `apps/web/src/lol/patches/profile-patch-notice.test.tsx` — update link assertion.
- `apps/web/src/routeTree.gen.ts` — regenerated.

After this chunk, the only ways to reach Patches are the top-nav dropdown, `ProfilePatchNotice`, the command palette, or a direct URL.

### Chunk 4 — Command palette grammar for `/patches`

**Shipped 2026-05-23.** Navigation-verb grammar lives in `@vyoh/shared` as a discriminated union so future global LoL surfaces (champion DB, item meta) plug in by adding a `kind` rather than re-inventing the parser.

**Files**
- `packages/shared/src/command-palette/parse-palette-verb.ts` (new) + colocated `.test.ts` — `parsePaletteVerb(input)` returns `{ kind: "patches", version, asSlug } | null`. Recognises `/patches`, `/patches <version>` (MAJOR.MINOR or MAJOR.MINOR.PATCH), and `@<slug>`; version and slug accept either order; unknown trailing tokens are ignored so a mid-keystroke fragment still surfaces the entry. Exported from `packages/shared/src/index.ts`.
- `apps/web/src/components/command-palette-dialog.tsx` — "Global LoL" `CommandGroup` with a Patches `CommandItem`. Without a verb, the item routes to `/lol/patches` with `?as=<default-slug>` from `useMe()` (mirrors the nav-dropdown fallback from Chunk 2). With `/patches …`, the parsed version drives the path and the parsed `@<slug>` (or default slug as fallback) drives `?as=`. Verb destinations collapse Pages / Accounts / Current account / Champions / Matches so the palette reads as a single routed result.
- `apps/web/src/components/command-palette-dialog.test.tsx` — 9 new tests cover default render, freeText hiding, default-slug fallback, neutral fallback, verb collapsing, version routing, `@<slug>` routing, combined version+slug, explicit-slug override, and Matches-group collapse on `/patches`.
- `docs/working-notes/cross-cutting/command-palette.md` — Phase F added to the chunk list.

---

## Open questions

- **Dropdown trigger affordance.** Chevron-icon next to the LoL label is the assumed shape, but split-button vs. whole-pill-as-menu-trigger (no separate primary link) is worth a 5-min look during Chunk 2 — the latter is simpler but loses the "LoL → my default account" quick path.
- **Patch-list index design at `/lol/patches`.** Today the page only renders when a `version` is selected; the index landing needs at least a version picker. Decide during Chunk 1 whether the index renders the latest patch by default (good for sharing "the current patch" link) or a list-only chooser (neutral, but one extra click).
- **Future siblings in the dropdown.** When (not if) champion DB, item meta, etc. land, they each get their own entry. Naming consistency: "Patches", "Champions", "Items" — single-noun, no "All" or "Browse" prefix. Worth confirming when the second item lands.

---

## Related notes

- [docs/repo-conventions.md](../../repo-conventions.md) — per-stream routes rule (`/lol/...` is fine for global LoL content); "extend the palette when adding filterable surfaces".
- [docs/working-notes/cross-cutting/command-palette.md](../cross-cutting/command-palette.md) — palette grammar and chunk list (extended in Chunk 4).
- [docs/working-notes/lol/match-detail-section-nav.md](match-detail-section-nav.md) — precedent for splitting one section into multiple navigation surfaces.
