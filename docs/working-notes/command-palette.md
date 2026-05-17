# Command palette (⌘K) — expansion plan

**Status:** Active — v1 shipped, untouched since the lazy-load split (2026-05-12). Promoted from the [vnext-ideas.md](./vnext-ideas.md) stub on 2026-05-17 because the palette is the right surface for several open-friction items (filter-from-deep-scroll, find-a-match-by-anything, discoverability of the shortcut itself) and the current scope ships nothing beyond static nav. Phases A–E ahead — see [open-work.md](./open-work.md).

## What v1 does today

[apps/web/src/components/command-palette.tsx](../../apps/web/src/components/command-palette.tsx) is a 28-line eager shell that listens for `⌘K` / `Ctrl+K`, gates render on `hasOpened`, and lazy-imports the dialog body.

[apps/web/src/components/command-palette-dialog.tsx](../../apps/web/src/components/command-palette-dialog.tsx) renders the dialog with three static groups:

- **Pages** — Home, LoL, Steam.
- **Accounts** — every `me.data.lol` Riot ID (gameName#tagLine).
- **Current account** — Profile / Matches / Trends / Champions, only when path matches `/lol/<slug>`.

Mounted once in [apps/web/src/routes/\_\_root.tsx:55](../../apps/web/src/routes/__root.tsx#L55). Footer carries a "Press ⌘K anywhere" hint, but only after the palette has already been opened — which is the wrong moment to discover the shortcut.

## Goals (in priority order)

1. **Make the shortcut discoverable from the chrome**, not from the dialog itself.
2. **Make it the primary surface for filtering long match/champion lists** — the explicit handoff recorded in [project-history.md:93](./project-history.md#L93) and [vnext-ideas.md:235](./vnext-ideas.md#L235) when the sticky-controls bar was reverted.
3. **Find-anything inside the loaded match cache** — by champion, win/loss, queue, role, KDA threshold, patch, date range, duo.
4. **Keep the eager shell slim.** The 7.75 kB lazy split documented in [docs/case-studies/frontend-perf.md:94-125](../case-studies/frontend-perf.md#L94-L125) is a feature; new scope must not migrate code into the eager shell.

## Phased plan

Each phase is independently committable and fits one context window.

### Phase A — Discoverability affordance (small)

Add a visible trigger so users learn the shortcut exists.

- Render a `⌘K` / `Ctrl K` chip in [components/nav.tsx](../../apps/web/src/components/nav.tsx), right-aligned (after the page links, before the right edge). Clicking opens the palette.
- Style the chip to match the existing `<CommandShortcut>` rendering in [command-palette-dialog.tsx:99-103](../../apps/web/src/components/command-palette-dialog.tsx#L99-L103) — `rounded border bg-muted/50 px-1.5 py-0.5` — so the chrome teaches the dialog's own visual language.
- Platform-aware label: `⌘K` on macOS (`/Mac/i.test(navigator.platform)`), `Ctrl K` elsewhere. Compute once at module scope; the value is stable per session.
- Wrap in a Radix `TooltipPrimitive` ("Open command palette") per the project's tooltip convention — never native `title=`.
- `aria-label="Open command palette"` on the button; visible label is the keys themselves, which doubles as both affordance and instruction.
- **Architecture:** the chip needs to dispatch `setOpen(true)` into state that currently lives inside `<CommandPalette />`. Lift it into a `CommandPaletteProvider` context exposed via `useCommandPalette()`. The shell still owns the keyboard listener and the lazy boundary; the provider just exposes `{ open, setOpen }` so the nav chip — and any future surface ("Filter from here", deep-link buttons) — can open it without import cycles.
- **Mobile fallback** (no keyboard, no hover): the chip is the only entry point. Render the keys label on `sm:` and up; below `sm`, render a search-glyph icon button (`Search` from lucide) with the same aria-label and tooltip. The dialog itself already works on touch — `CommandInput` autofocuses, virtual keyboard slides over the modal.

Files: `nav.tsx`, `command-palette.tsx` (extract provider), `__root.tsx` (wrap with provider). Roughly 3-4 files.

### Phase B — Match search mode (medium)

Make "find a match by what happened in it" a real palette mode.

- Trigger: when the user types into the palette and there's a current account slug, surface a **Matches** group below Pages/Accounts/Current account.
- **Data source:** read from the existing TanStack Query cache — the matches list query is already populated on Profile/Matches/Trends visits. Do not fire a new fetch on palette open; degrade gracefully if cache miss ("Visit Matches to enable search" empty state, or kick off the prefetch).
- **Per-match item:** champion icon + win/loss pip + KDA + queue + role + relative time. Selecting navigates to `/lol/<slug>/matches/<matchId>`.
- **Default ranking:** most recent first, but boost matches whose champion name fuzzy-matches the input.
- **Filterable axes (Phase B baseline = champion + win/loss):** champion name (substring + Riot's lowercase-no-spaces variants), `wins` / `losses` keyword.
- The remaining axes (queue / role / KDA threshold / patch / date / duo) ship in Phase C as typed grammar to avoid an exploding flat result set in B.

### Phase C — Typed verb grammar (medium)

Promote freeform input to a small structured grammar. Three styles for one feature:

| Verb | Example | Meaning |
|---|---|---|
| `with:` | `with:nidalee` | Matches I played as Nidalee |
| `vs:` | `vs:khazix` | Matches where the lane opponent was Kha'Zix (uses `MatchSummary.laneOpponent.championName`) |
| `queue:` | `queue:soloq` / `queue:flex` / `queue:aram` | Filter by queue |
| `role:` | `role:jungle` | Filter by `MatchSummary.teamPosition` |
| `patch:` | `patch:14.20` | Reuses [lol/_shared/patch-version.ts](../../apps/web/src/lol/_shared/patch-version.ts) `truncatePatch` |
| `since:` / `until:` | `since:7d` | Relative or ISO date bounds |
| `kda>` / `kda<` | `kda>4` | Threshold filter |
| `duo:` | `duo:tagline#EUW` | Matches played with this duo (Phase 4 duo data already exists) |
| `wins` / `losses` | bare keyword | Shorthand (no colon) |

Verbs compose: `with:nidalee wins kda>3 since:14d`. Show parsed chips in the input row so the user sees how the query was interpreted (and can click-remove individual chips).

**Implementation note:** parse incrementally on each keystroke; keep the parser pure and unit-tested in `packages/shared` so the same grammar can later power a URL-state encoding (`/matches?q=with:nidalee+wins`).

### Phase D — Global account + champion search (small-medium)

- **Champion mode** (when account is active): "Type a champion name → jump to `/lol/<slug>/champions/<champion>`." Source: the existing champion list query from Champions page, or a static champion roster from the patch fetcher. Same fuzzy matching as Phase B.
- **Cross-account scope:** if the user is on Steam or Home and types a Riot ID fragment, surface their accounts as today *plus* a "Search matches in <account>" affordance that switches scope and opens Phase B inside that account.

### Phase E — Recent commands + result persistence (small)

- Persist the last ~5 selected items in `localStorage` (debounced; per-account namespace).
- Surface them as a "Recent" group at the top when the input is empty.
- Honors the per-stream isolation memory ([feedback_no_cross_stream_mixing](../../../home/node/.claude/projects/-workspaces-vyoh-gg/memory/feedback_no_cross_stream_mixing.md)) — Steam recents don't leak into LoL context and vice versa.

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
- **Steam search.** Steam has games + playtime; the palette extension here is LoL-shaped. Worth a `with:` / `played:` parallel grammar for Steam? Track in [steam-integration.md](./steam-integration.md), not here.

## Acceptance criteria

- Phase A: a new user lands on the site, sees the ⌘K chip in the nav within first paint, clicking it opens the palette, the lazy chunk loads on click (not on first paint), no extra bytes shipped in the main bundle (`size-limit` budget unchanged).
- Phase B: from `/lol/<slug>/matches` scrolled past row 30, ⌘K → typing "nida" surfaces all Nidalee games in the cached window within one frame of typing.
- Phase C: `with:nidalee wins kda>3 since:14d` returns the correct intersection; parsed chips are visible in the input row; backspacing a chip widens the result set.
- Phase E: closing and reopening the palette without typing shows the last 5 selections.

## References

- [docs/working-notes/vnext-ideas.md:114](./vnext-ideas.md#L114) — the original one-paragraph stub (replace with a pointer to this file when Phase A lands).
- [docs/working-notes/project-history.md:93,277-279](./project-history.md#L93) — original ship + the explicit handoff from sticky-controls revert.
- [docs/working-notes/archive/views-roadmap.md:192,219](./archive/views-roadmap.md#L192) — current routing into Profile.
- [docs/case-studies/frontend-perf.md:94-125](../case-studies/frontend-perf.md#L94-L125) — lazy-load architecture; the perf budget the expansion must respect.
- [docs/working-notes/perf-baseline.md:16-18,30](./perf-baseline.md#L16-L18) — bundle ceilings.
- Tooltip convention: project `CLAUDE.md` + `feedback_radix_tooltip` auto-memory.
