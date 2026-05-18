# Command palette (⌘K) — expansion plan

**Status:** Active — Phases A (provider lift + nav chip), B (match search mode), C1–C3 (parser + verb wiring + parsed chips), and D1 (champion mode) shipped 2026-05-18. 2 commit-boundary chunks remaining (D2 cross-account, E recents persistence) — see [open-work.md](../open-work.md). Promoted from [vnext-ideas.md](./vnext-ideas.md) stub on 2026-05-17.

## Current state (Phases A+B shipped 2026-05-18)

[apps/web/src/components/command-palette-context.tsx](../../../apps/web/src/components/command-palette-context.tsx) — `CommandPaletteProvider` + `useCommandPalette()` hook, exposing `{ open, setOpen }`. Wrapped around the app in [\_\_root.tsx](../../../apps/web/src/routes/__root.tsx) (A1).

[apps/web/src/components/command-palette.tsx](../../../apps/web/src/components/command-palette.tsx) — slim eager shell; reads context via `useCommandPalette()`, owns the `⌘K` / `Ctrl+K` keyboard listener, gates render on `hasOpened`, lazy-imports the dialog body (A1).

[apps/web/src/components/command-palette-dialog.tsx](../../../apps/web/src/components/command-palette-dialog.tsx) — dialog body with four groups:

- **Pages** — Home, LoL, Steam.
- **Accounts** — every `me.data.lol` Riot ID (gameName#tagLine).
- **Current account** — Profile / Matches / Trends / Champions, only when path matches `/lol/<slug>`.
- **Matches** — champion + win/loss filter over the cached matches query when an account is active; cache-miss state renders a "Load matches" affordance (B).

[apps/web/src/components/nav.tsx](../../../apps/web/src/components/nav.tsx) — `⌘K` / `Ctrl K` chip (`sm:` and up) and mobile search-glyph icon button, both calling `useCommandPalette().setOpen(true)` (A2).

## Goals (in priority order)

1. **Make the shortcut discoverable from the chrome**, not from the dialog itself.
2. **Make it the primary surface for filtering long match/champion lists** — the explicit handoff recorded in [project-history.md:93](../project-history.md#L93) and [vnext-ideas.md:235](./vnext-ideas.md#L235) when the sticky-controls bar was reverted.
3. **Find-anything inside the loaded match cache** — by champion, win/loss, queue, role, KDA threshold, patch, date range, duo.
4. **Keep the eager shell slim.** The 7.75 kB lazy split documented in [docs/case-studies/frontend-perf.md:94-125](../../case-studies/frontend-perf.md#L94-L125) is a feature; new scope must not migrate code into the eager shell.

## Phased plan

Each chunk below is independently committable and fits one context window. Phases group related chunks; the chunk is the unit of work.

**Commit-boundary chunks:**

1. ~~**A1 — Provider lift.**~~ ✅ shipped 2026-05-18
2. ~~**A2 — Nav chip.**~~ ✅ shipped 2026-05-18
3. ~~**B — Match search mode.**~~ ✅ shipped 2026-05-18
4. ~~**C1 — Parser foundation.**~~ ✅ shipped 2026-05-18 — `parseMatchQuery` in [packages/shared/src/lol/match-query.ts](../../../packages/shared/src/lol/match-query.ts) with `with:`, `vs:`, `wins`, `losses` + 20 unit tests. No UI changes.
5. ~~**C2 — Full verb set.**~~ ✅ shipped 2026-05-18 — parser extended with `queue:`, `role:`, `patch:`, `since:`/`until:`, `kda>`/`kda<`, `duo:` (multi-occurrence verbs union as arrays; `since`/`until`/`kda` are last-wins); `since`/`until` accept `Nh`/`Nd`/`Nw` relative offsets or ISO dates. `matchesQuery(match, parsed)` in [apps/web/src/components/command-palette-matcher.ts](../../../apps/web/src/components/command-palette-matcher.ts) wires structured filtering into the dialog; cmdk's auto-filter switched off via `shouldFilter={false}` and groups filter manually. `duo:` parses for grammar completeness but the matcher no-ops it until duo data is plumbed into the palette.
6. ~~**C3 — Parsed chips UI.**~~ ✅ shipped 2026-05-18 — chip row renders between input and results when any verb is parsed. Pure chip-builder + token-remover in [apps/web/src/components/command-palette-chips.ts](../../../apps/web/src/components/command-palette-chips.ts) (16 unit tests). Click-to-remove drops the exact token for union verbs (`with:`/`vs:`/`queue:`/…); for last-wins verbs (`since:`/`until:`/`kda><`) it drops all occurrences of the prefix so shadowed values don't silently re-activate.
7. ~~**D1 — Champion mode.**~~ ✅ shipped 2026-05-18 — `useChampions()` data filtered by freeText against name + alias, sorted by display name, top 6 results rendered as a "Champions" group between Current account and Matches. Gated on active `currentSlug`, non-empty freeText, and no structured verbs in play. Navigates to `/lol/<slug>/champions/<alias>` (matches the route param shape used by [champion-table.tsx](../../../apps/web/src/lol/champions/champion-table.tsx)).
8. **D2 — Cross-account scope.** From Steam/Home, surface a "Search matches in <account>" affordance that switches scope and pre-opens Phase B.
9. **E — Recents.** Persist last ~5 selections in `localStorage` (per-account namespace); show as a Recent group when input is empty.

### Phase A — Discoverability affordance (small) ✅ shipped 2026-05-18

Add a visible trigger so users learn the shortcut exists. Two commits: **A1** (provider refactor) before **A2** (chip consumer).

- Render a `⌘K` / `Ctrl K` chip in [components/nav.tsx](../../../apps/web/src/components/nav.tsx), right-aligned (after the page links, before the right edge). Clicking opens the palette.
- Style the chip to match the existing `<CommandShortcut>` rendering in [command-palette-dialog.tsx:99-103](../../../apps/web/src/components/command-palette-dialog.tsx#L99-L103) — `rounded border bg-muted/50 px-1.5 py-0.5` — so the chrome teaches the dialog's own visual language.
- Platform-aware label: `⌘K` on macOS (`/Mac/i.test(navigator.platform)`), `Ctrl K` elsewhere. Compute once at module scope; the value is stable per session.
- Wrap in a Radix `TooltipPrimitive` ("Open command palette") per the project's tooltip convention — never native `title=`.
- `aria-label="Open command palette"` on the button; visible label is the keys themselves, which doubles as both affordance and instruction.
- **Architecture (A1):** the chip needs to dispatch `setOpen(true)` into state that currently lives inside `<CommandPalette />`. Lift it into a `CommandPaletteProvider` context exposed via `useCommandPalette()`. The shell still owns the keyboard listener and the lazy boundary; the provider just exposes `{ open, setOpen }` so the nav chip — and any future surface ("Filter from here", deep-link buttons) — can open it without import cycles. Land A1 with no new consumers so the refactor is reviewable on its own.
- **Mobile fallback** (no keyboard, no hover): the chip is the only entry point. Render the keys label on `sm:` and up; below `sm`, render a search-glyph icon button (`Search` from lucide) with the same aria-label and tooltip. The dialog itself already works on touch — `CommandInput` autofocuses, virtual keyboard slides over the modal.

Files: `nav.tsx`, `command-palette.tsx` (extract provider), `__root.tsx` (wrap with provider). Roughly 3-4 files across A1+A2.

### Phase B — Match search mode (medium) ✅ shipped 2026-05-18

Make "find a match by what happened in it" a real palette mode. Single chunk **B**.

- Trigger: when the user types into the palette and there's a current account slug, surface a **Matches** group below Pages/Accounts/Current account.
- **Data source:** read from the existing TanStack Query cache — the matches list query is already populated on Profile/Matches/Trends visits. Do not fire a new fetch on palette open.
- **Cache-miss behavior — decided 2026-05-18:** render a "Match history not loaded yet" empty state in the Matches group with a "Load matches" `CommandItem` that fires the same prefetch the Matches route uses. User stays in the palette; the group populates once data arrives. Auto-prefetch on open is ruled out — it blurs data ownership and violates the "cache hit before fetch" architecture note.
- **Per-match item:** champion icon + win/loss pip + KDA + queue + role + relative time. Selecting navigates to `/lol/<slug>/matches/<matchId>`.
- **Default ranking:** most recent first, but boost matches whose champion name fuzzy-matches the input.
- **Filterable axes (Phase B baseline = champion + win/loss):** champion name (substring + Riot's lowercase-no-spaces variants), `wins` / `losses` keyword.
- The remaining axes (queue / role / KDA threshold / patch / date / duo) ship in Phase C as typed grammar to avoid an exploding flat result set in B.

### Phase C — Typed verb grammar (medium)

Promote freeform input to a small structured grammar. Three chunks: **C1** (parser + minimal verbs), **C2** (remaining verbs + wiring), **C3** (chips UI).

| Verb | Example | Meaning |
|---|---|---|
| `with:` | `with:nidalee` | Matches I played as Nidalee |
| `vs:` | `vs:khazix` | Matches where the lane opponent was Kha'Zix (uses `MatchSummary.laneOpponent.championName`) |
| `queue:` | `queue:soloq` / `queue:flex` / `queue:aram` | Filter by queue |
| `role:` | `role:jungle` | Filter by `MatchSummary.teamPosition` |
| `patch:` | `patch:14.20` | Reuses [lol/_shared/patch-version.ts](../../../apps/web/src/lol/_shared/patch-version.ts) `truncatePatch` |
| `since:` / `until:` | `since:7d` | Relative or ISO date bounds |
| `kda>` / `kda<` | `kda>4` | Threshold filter |
| `duo:` | `duo:tagline#EUW` | Matches played with this duo (Phase 4 duo data already exists) |
| `wins` / `losses` | bare keyword | Shorthand (no colon) |

Verbs compose: `with:nidalee wins kda>3 since:14d`. Show parsed chips in the input row so the user sees how the query was interpreted (and can click-remove individual chips).

**Chunk split:**
- ~~**C1**~~ ✅ shipped 2026-05-18. `parseMatchQuery(input)` in `@vyoh/shared` returns `{ withChampions, vsChampions, outcome, freeText }`; outcome resolves last-keyword-wins on conflict; empty verb values are ignored; freeText is lowercased and whitespace-normalised. No UI consumer yet — B's Matches group keeps its current free-text behavior until C2 lands.
- ~~**C2**~~ ✅ shipped 2026-05-18 — see commit-boundary chunk above.
- ~~**C3**~~ ✅ shipped 2026-05-18 — see commit-boundary chunk above.

**Implementation note:** parse incrementally on each keystroke; keep the parser pure and unit-tested in `packages/shared` so the same grammar can later power a URL-state encoding (`/matches?q=with:nidalee+wins`).

### Phase D — Global account + champion search (small-medium)

Two independent chunks; ship in either order:

- ~~**D1 — Champion mode**~~ ✅ shipped 2026-05-18 — typed champion name surfaces a Champions group above Matches, navigates to `/lol/<slug>/champions/<alias>`. Source: `useChampions()` (already query-cached `Infinity` for the Champions page). Gated on active `currentSlug` and non-empty freeText so the palette doesn't dump 160+ champions when first opened.
- **D2 — Cross-account scope:** if the user is on Steam or Home and types a Riot ID fragment, surface their accounts as today *plus* a "Search matches in <account>" affordance that switches scope and opens Phase B inside that account.

### Phase E — Recent commands + result persistence (small)

- Persist the last ~5 selected items in `localStorage` (debounced; per-account namespace).
- Surface them as a "Recent" group at the top when the input is empty.
- Honors the per-stream routing rule ([repo-conventions.md § Per-stream routes](../../repo-conventions.md)) — Steam recents don't leak into LoL context and vice versa.

## Non-goals

- **Server-side search.** v1 of all phases reads from the loaded cache only — no new Riot calls or DB queries from palette input. If we discover the match cache window isn't deep enough, expand the cache, not the palette.
- **Replacing the Matches page filters.** The page-level controls and the palette serve different moods (browse vs. find). Keep both; the palette is the answer to "I'm at scroll depth 30 and want to refilter," not a wholesale replacement.
- **Custom shortcut binding by the user.** Single hardcoded `⌘K` / `Ctrl K` stays the contract through at least Phase D.

## Architecture notes

- **Keep the eager shell at ≤2 kB gzip.** Anything that grows it — date parsers, fuzzy-match libs, the champion roster — belongs in `command-palette-dialog.tsx` or behind further lazy splits inside the dialog (e.g. dynamic-import the parser on first non-empty input).
- **Cache hit before fetch.** The palette must never trigger a network request on open. Phase B/C should only see cached data, or render an "open Matches to enable search" empty state.
- **Context provider, not event bus.** Lifting palette state into context (Phase A) is the load-bearing refactor — Phases B/C/D all need other surfaces to be able to "open with this query pre-filled" (think: "Filter from here" buttons on a champion-detail page).
- **Parser in `@vyoh/shared`.** Keeps the grammar consistent if a URL-state encoding ever lands; cross-package import is fine via the workspace alias.

## Open questions

- **Fuzzy match library or hand-rolled?** `cmdk` ships its own scoring; consider whether it's enough for "nida" → "Nidalee" / "kha" → "Kha'Zix" before pulling in `fuse.js` or similar. Default: try `cmdk`'s built-in first, escalate only if recall is bad.
- **First-visit nudge — should there be one at all?** Open discussion, no lean yet.
  - *For:* the chip alone is passive — a one-shot `sonner` toast on first session ("Press ⌘K to jump anywhere") is the cheapest way to actively teach the shortcut, and it's a self-dismissing surface.
  - *Against:* the site is a portfolio; uninvited UI on first paint can read as pushy or "tutorial-y." The chip may be enough on its own, and a toast competes with the splash backdrop / first-impression chrome for the visitor's attention.
  - *Alternate shapes if we do want one:* in-chip pulse animation on first session, a one-time tooltip auto-opened on the chip, a subtle keycap-press animation triggered after N seconds of inactivity. Each is a different point on the active↔passive axis.
  - *If we ship any variant:* gate behind a `localStorage` key, namespace per visitor (not per account), and ensure it never re-fires after dismissal.
- **Result count cap.** Show top N per group with "+M more" footer, or scroll the whole list? Lean: cap at 8 per group, total scroll length stays bounded.
- **Steam search.** Steam has games + playtime; the palette extension here is LoL-shaped. Worth a `with:` / `played:` parallel grammar for Steam? Track in [steam-integration.md](../steam/steam-integration.md), not here.

## Acceptance criteria

- **A1:** provider is in place; ⌘K still opens the palette via the keyboard listener exactly as before; no visible UX change; no new bytes in the eager shell beyond the context object itself.
- **A2:** a new user lands on the site, sees the ⌘K chip in the nav within first paint, clicking it opens the palette, the lazy chunk loads on click (not on first paint), `size-limit` budget unchanged.
- **B:** from `/lol/<slug>/matches` scrolled past row 30, ⌘K → typing "nida" surfaces all Nidalee games in the cached window within one frame of typing. Cache-miss path renders the agreed empty state.
- ~~**C1:**~~ ✅ shipped — `with:nidalee`, `vs:khazix`, bare `wins`/`losses` parse correctly in `@vyoh/shared` tests; no behavior change in the palette.
- ~~**C2:**~~ ✅ shipped — `with:nidalee wins kda>3 since:14d` returns the correct intersection inside the Matches group via `matchesQuery`.
- ~~**C3:**~~ ✅ shipped — parsed chips render in the input row; clicking a chip rewrites the query string and widens the result set.
- ~~**D1:**~~ ✅ shipped — typing a champion fragment surfaces a Champions group that navigates to `/lol/<slug>/champions/<champion>`.
- **D2:** from `/steam` or `/`, typing a Riot ID fragment surfaces "Search matches in <account>" that switches scope.
- **E:** closing and reopening the palette without typing shows the last 5 selections, namespaced per account.

## Extending the palette is part of new feature work

Once A2 lands and the palette has a discoverable entry point, it becomes the default surface for new filter, find-by-X, and deep-link affordances. Don't ship a leaf-page dropdown, sticky controls bar, or one-off filter chip when the same intent could route through the palette's existing grammar.

Concrete cases:

- New filterable match attribute (objective participation, ping count, vision score) → extend the C2 verb grammar in the same PR. Don't add a parallel sort dropdown to Matches.
- Champion-detail "filter to my games on this champion" button → dispatch `useCommandPalette().setOpen(true)` with `with:<champ>` pre-filled, not a new dropdown.
- Cross-stream "find" intent (Steam, future verticals) → either add a stream-specific palette group or a parallel grammar in the same parser (see Open questions on Steam).

**Why:** The palette is the explicit handoff from the reverted sticky-controls bar — scattering filter UI across leaf pages re-invents the problem that handoff was meant to solve, and dilutes the discoverability story the chip in A2 buys us. The parser in `@vyoh/shared` (C1) exists precisely so the grammar has one home; bypassing it for a leaf-page filter forks the vocabulary.

**How to apply:** When scoping any task that touches a filterable surface or adds a "find by X" intent, include an "extend palette" sub-chunk in the plan. If the new affordance genuinely doesn't fit the palette (spatial selection, live-preview range slider, drag-to-reorder), call that out in the working-note before adding parallel UI. Cross-link from the working-note back to this file's chunk list so the addition slots into the right phase.

## References

- [docs/working-notes/vnext-ideas.md:116](./vnext-ideas.md#L116) — the original one-paragraph stub, now marked ✅ and pointing to this file.
- [docs/working-notes/project-history.md:93,277-279](../project-history.md#L93) — original ship + the explicit handoff from sticky-controls revert.
- [docs/working-notes/archive/views-roadmap.md:192,219](../archive/views-roadmap.md#L192) — current routing into Profile.
- [docs/case-studies/frontend-perf.md:94-125](../../case-studies/frontend-perf.md#L94-L125) — lazy-load architecture; the perf budget the expansion must respect.
- [docs/working-notes/perf-baseline.md:16-18,30](./perf-baseline.md#L16-L18) — bundle ceilings.
- Tooltip convention: project `CLAUDE.md` + `feedback_radix_tooltip` auto-memory.
