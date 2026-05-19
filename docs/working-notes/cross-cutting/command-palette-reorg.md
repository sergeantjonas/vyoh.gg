# Command palette reorganization + Steam parity

**Status:** Planning, 2026-05-19. Follow-up arc to [command-palette.md](./command-palette.md) (D2 + E shipped 2026-05-18). This note captures the structural rework prompted by the post-launch read of the palette feeling unorganized, plus the Steam-parity work that should ride along to avoid solidifying LoL-shape into the new taxonomy.

## Why

Direct read of the shipped palette against the screenshots taken on 2026-05-19:

1. **Accounts group is doubled.** Every account spawns two near-identical rows: the account itself and its `Search matches in <id>` companion (D2's implementation). 4 accounts = 8 rows of visual rhyme, all starting with the same name. Dominant noise in the Accounts group.
2. **Matches "Load matches" CTA shows at empty input.** Two-row clutter (`Match history not loaded yet` + `Load matches`) on every fresh open, for an action the user hasn't asked for.
3. **Recents mirror companion rows.** Once `Search matches in <id>` is used, it's stored as `kind: "tab"` with that verbose label and reappears in Recents indistinguishable from the Accounts companion row. Reads like an action in a list of destinations.
4. **Two intents collapsed into one group.** Accounts conflates "jump to this account's profile" with "scope match search to this account" — different mental actions, presented as siblings.
5. **Group order doesn't match priority of use.** Empty input renders `Recent → Pages → Accounts → Current account`. The high-frequency surface (Current account tabs) is buried below 8+ rows of accounts the owner already navigates to less often.
6. **Steam is structurally under-represented.** `/steam` has 5 routes (`/steam`, `/steam/library`, `/steam/wishlist`, `/steam/achievements`, `/steam/game/<appid>`) plus a full owned-games catalog cached via `useOwnedGames()`, but the palette exposes exactly one Steam row: the top-level page link. The shipped arc explicitly flagged this as an [open question](./command-palette.md#L130) — addressed here.

## Goals (priority order)

1. **Kill the doubled-row pattern in Accounts.** Secondary actions become a chord + hint chip, not a sibling row.
2. **Suppress the empty-input Matches CTA.** Only render the Matches group when the user has signaled intent (input, verbs, or cached data).
3. **Reorder groups so the high-frequency surface leads.** Current section above Pages/Accounts at empty input.
4. **Bring Steam to parity with LoL inside the palette.** Generalize "Current account" → "Current section" and ship a Games group as the Steam analogue of Champions.
5. **Preserve the "extend the palette rather than ship parallel UI" rule.** This rework strengthens the convention by reducing the friction that pushed scattered filter UIs onto leaf pages historically.

## Phased plan

Each chunk independently committable. Sequencing matters: S1 lands before F3 because F3's group-order assertions need Steam to already be a first-class branch, otherwise S1 has to re-modify the same code immediately after.

### F1 — Account row: chord + hint, remove doubling

- One `CommandItem` per account in the Accounts group. `Enter` → navigate to `/lol/<slug>` (profile). `⌘↵` / `Ctrl↵` → `goAndKeepOpen` to `/lol/<slug>/matches`.
- Right-aligned hint chip on each account row using the existing `CommandShortcut` style: `⌘↵ matches`. Platform-aware label, computed once at module scope (mirrors the nav-chip pattern from A2).
- Companion `Search matches in <id>` row is removed entirely from empty input. Kept only when input is non-empty *and* the account matches by name — touch + cross-account scope-switch remains discoverable while typing, just not at idle.
- **Implementation note for the chord:** `cmdk`'s `onSelect` doesn't expose the original event. Lift `value` into local state via `<Command value onValueChange>` and attach a `keydown` listener on `CommandInput` that checks `event.metaKey || event.ctrlKey + Enter` against the highlighted account `value`.
- **Files:** [command-palette-dialog.tsx](../../../apps/web/src/components/command-palette-dialog.tsx).
- **Tests:** [command-palette-dialog.test.tsx](../../../apps/web/src/components/command-palette-dialog.test.tsx) — remove the doubled-row assertion if present; add a chord-keydown test (`fireEvent.keyDown` with `metaKey: true` on the input while an account is highlighted).

### F2 — Suppress Matches group at empty input

- Gate the entire `{currentAccount && (<CommandGroup heading="Matches">…)}` block on `(parsed.freeText || hasStructuredVerbs || (allMatches && allMatches.length > 0))`.
- The "Load matches" CTA's prefetch behavior is unchanged; only its visibility is restricted.
- **Files:** [command-palette-dialog.tsx](../../../apps/web/src/components/command-palette-dialog.tsx).
- **Tests:** assert the Matches group is absent at empty input on `/lol/<slug>`, present after typing.

### S1 — Generalize "Current account" → "Current section"

- The group's job is "tabs of the active top-level route." Today only fires for `/lol/<slug>`. Make it section-aware:
  - On `/lol/<slug>`: Profile / Matches / Trends / Champions (today, unchanged).
  - On `/steam/...`: Library / Wishlist / Achievements (+ `Game: <title>` row when on `/steam/game/<appid>`, resolving appid → title via the owned-games cache).
- Implementation: derive section + tab list from a single helper (`useCurrentSectionTabs(pathname)`) instead of the current inline `currentSlug` branch. Helper returns `{ section: "lol" | "steam" | null, tabs: Tab[] }`.
- Heading text becomes section-aware: `"Current account"` for LoL (slug-scoped), `"Current section"` for Steam. Keeps the existing label discoverable for the LoL flow that already shipped.
- **Files:** [command-palette-dialog.tsx](../../../apps/web/src/components/command-palette-dialog.tsx), new helper at `apps/web/src/components/use-current-section-tabs.ts`.
- **Tests:** unit-test the helper for `/lol/<slug>`, `/lol/<slug>/matches`, `/steam`, `/steam/library`, `/steam/game/<appid>`, `/` (returns null).

### F3 — Group order for empty-input prioritization

- **Empty input** (`!input.trim()`): `Recent → Current section → Pages → Accounts` (Matches gone per F2).
- **With freeText, no structured verbs:** `Current section → Champions/Games → Accounts → Matches → Pages`.
- **With structured verbs:** Matches only (unchanged via existing `showNonMatchGroups` gate).
- **Files:** [command-palette-dialog.tsx](../../../apps/web/src/components/command-palette-dialog.tsx) — JSX reorder only, no logic changes.
- **Tests:** assert group-heading order at each of the three states.

### S2 — Games group (Steam equivalent of Champions)

- Read `useOwnedGames()` from cache (already populated on `/steam/library` and `/steam` visits — same "cache hit before fetch" rule as Champions per D1).
- Filter by game name against freeText, top 6, navigate to `/steam/game/<appid>`.
- Gated on `pathname.startsWith("/steam")` and non-empty freeText, mirroring the D1 Champions gate to avoid dumping the full library at empty input.
- Cache-miss state: `Library not loaded yet` + `Load library` affordance, mirroring the Matches/Load matches pattern post-F2 (only renders when freeText is non-empty).
- **Files:** [command-palette-dialog.tsx](../../../apps/web/src/components/command-palette-dialog.tsx).
- **Tests:** assert Games group visibility gating (pathname + freeText), assert cache-miss "Load library" affordance fires the prefetch.

### F4 — Recents label cleanup for cross-account scope

- After F1's chord path replaces the companion row, the scope-switch recording becomes `{ kind: "account", label: "<gameName>#<tagLine> — matches", path: "/lol/<slug>/matches" }`.
- Path is still unique (distinct from the profile `/lol/<slug>`) so Recents dedup-by-path keeps both as separate entries when both have been visited.
- **No migration.** Existing localStorage entries with `kind: "tab"` + `Search matches in <id>` still parse via `isValidRecent`; they age out naturally within the 5-entry buffer.
- **Files:** [command-palette-dialog.tsx](../../../apps/web/src/components/command-palette-dialog.tsx) — call-site change only.
- **Tests:** optional dialog-level test asserting the recorded entry's shape after a `⌘↵` chord.

### F5 — Update [command-palette.md](./command-palette.md) + extract lesson

- Mark D2's companion-row implementation as superseded in the original arc note.
- Add a "Lessons" subsection in [command-palette.md](./command-palette.md): *"Secondary actions on a row should be a chord + hint chip, not a sibling row. Doubling rows pollutes the group it lives in and reads as visual rhyme — the first hit of this was D2 (Accounts companion rows), revised in F1–F4 on the dates this arc lands."*
- Mark this note's chunks ✅ as they ship; link back from [command-palette.md](./command-palette.md) once F5 lands.
- **Files:** [command-palette.md](./command-palette.md), this note.

## Non-goals

- **Steam grammar (`played:` / `unlocked:` / etc.).** Parallel to LoL's `with:` / `vs:`. Belongs in [steam-integration.md](../steam/steam-integration.md), not here — promoting `parseMatchQuery` to a stream-agnostic `parseStreamQuery` is a refactor that shouldn't ride along with this structural rework.
- **Re-architecting the parser as stream-agnostic.** Same reasoning — separate arc.
- **Migrating existing Recents entries to F4's new label format.** Letting them age out is cheap; migration code adds risk for cosmetic gain.
- **TFT.** TFT integration hasn't shipped its own routes yet; when it does, S1's `useCurrentSectionTabs` should extend naturally — no preemptive scaffolding here.

## Architecture notes

- **Chord on touch / no-keyboard:** `⌘↵` is invisible on touch. Mitigated by keeping the companion `Search matches in <id>` row visible *on non-empty input only*. Touch + cross-account scope-switch is a rare flow; empty-input touch users tap the account row → profile, which is the right default.
- **Cmdk event surface:** `onSelect` doesn't pass the original event. F1's chord requires lifting `value` into local state and intercepting `keydown` on the input. This is a known cmdk constraint, not a project-side one.
- **`useCurrentSectionTabs` colocation:** keep the helper next to the dialog rather than promoting to `@vyoh/shared` — it's React-flavored (`pathname` consumer, returns JSX-ready tab list) and only the palette consumes it. Promote later if a second consumer appears.
- **Lazy-shell budget unchanged.** All new code lives in `command-palette-dialog.tsx` (already lazy-loaded). Eager `command-palette.tsx` shell stays at its current size — the chord listener is inside the dialog body, not the shell.

## Open questions

- **Should the chord exist for Pages too?** E.g. `⌘↵` on the `League of Legends` page row could go to `/lol/<default-slug>/matches` instead of `/lol`. Lean: no — Pages are top-level entry points without a clear secondary action, and adding chords to every row dilutes the affordance. Revisit only if a concrete second case emerges.
- **Heading text for the generalized group.** `"Current account"` (LoL-correct, Steam-wrong) vs `"Current section"` (generic, LoL feels less personal) vs branch the text on section (lands above). Lean: branch the text — preserves the shipped LoL framing.
- **`Game: <title>` resolution timing.** S1's Game row depends on resolving appid → title from cache. If the user lands directly on `/steam/game/<appid>` via deep link and the owned-games cache hasn't populated yet, the row label has no title. Acceptable fallback: render `Game` without the title; the row is still navigationally correct because the appid is in the path.

## Acceptance criteria

- **F1:** At `/lol/<slug>`, opening the palette shows one row per account in Accounts, with a `⌘↵ matches` hint chip on the right. `Enter` on a highlighted account navigates to profile; `⌘↵` opens that account's matches with the palette still open. Typing a fragment that matches an account name additionally surfaces the companion `Search matches in <id>` row.
- **F2:** Opening the palette at `/lol/<slug>` with no cached matches shows no Matches group. Typing anything surfaces the `Match history not loaded yet` + `Load matches` pair.
- **S1:** On `/steam`, palette shows a Current section group with Library / Wishlist / Achievements rows. On `/steam/game/<appid>` with the cache populated, a `Game: <title>` row appears. `useCurrentSectionTabs` returns `null` for `/` and unknown paths.
- **F3:** Group order at empty input on `/lol/<slug>` is `Recent → Current account → Pages → Accounts`. At empty input on `/steam`, order is `Recent → Current section → Pages → Accounts`.
- **S2:** On `/steam/library` with the owned-games cache populated, typing a game name fragment surfaces a Games group navigating to `/steam/game/<appid>`. Cache-miss state renders only on non-empty input.
- **F4:** After using `⌘↵` on an account row, the next palette open at empty input shows the entry in Recents as `<gameName>#<tagLine> — matches` with the user icon (kind: account), not the verbose `Search matches in <id>` label.
- **F5:** Original [command-palette.md](./command-palette.md) carries the Lessons subsection and chunk-list cross-links to this note.

## References

- [command-palette.md](./command-palette.md) — original arc note, D2 implementation being revised.
- [command-palette.md:130](./command-palette.md#L130) — the open question this arc advances.
- [docs/repo-conventions.md § Per-stream routes; `/` is synthesis-only](../../repo-conventions.md) — the convention backing the Steam-parity work.
- [docs/repo-conventions.md § Extend the command palette when adding filterable surfaces](../../repo-conventions.md) — the rule this arc strengthens by reducing palette friction.
- [steam-integration.md](../steam/steam-integration.md) — destination for the deferred Steam grammar (S3).
- [docs/case-studies/frontend-perf.md:94-125](../../case-studies/frontend-perf.md#L94-L125) — lazy-shell budget that constrains the new code.
