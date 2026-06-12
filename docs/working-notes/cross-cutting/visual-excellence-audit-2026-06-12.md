# Visual-excellence audit — 2026-06-12

**Status:** Active — V1 (full sweep) + V2 (enforcement test) + V5 (head/meta completeness) + V8 (chart theming) shipped 2026-06-12; the session plan is complete. Remaining: V3/V4/V6/V7 surface passes and V9–V12 design decisions, unscoped.

Code-level audit of visual consistency, surface treatment gradient, and hygiene. **Not a rendered-page review** — items marked "needs eyes" require looking at the running app before acting ([[feedback_dont_guess_visual_content]]). Chunk IDs are V1–V12 (work) and H1–H4 (hygiene appendix), following the [audit-2026-06-11.md](audit-2026-06-11.md) fan-out-index shape.

**Meta-finding (load-bearing):** every convention backed by a primitive or helper held under audit (tooltip recipes, `useChampionName`, shared formatters); every convention enforced only by review drifted (header primitives, tile recipes, `excludeRemakes`). V2 exists to close that loop — without it, V1 is the *second-to-last* sweep, not the last.

---

## Verified drift (all spot-checked, not just scout claims)

### V1 — Consistency sweep (one PR, mechanical)

1. ~~**Inline remake filters ×3** bypassing the `excludeRemakes()` invariant~~ — **shipped 2026-06-12.** Pickup grep found 5 aggregation-filter sites, not 3: the audit's three (`recap-top-insight.tsx`, `profile-lp-history.tsx`, `champions/$championKey.tsx`) plus two combined-predicate filters in `use-habits-stats.ts` (`computePoolStats`) and `profile-pregame-ritual.tsx` (`buildChampionSignal`). All five now route through `excludeRemakes()`. Single-match display checks (`match-row.tsx`, `match-record.tsx`, `profile-post-game.tsx`'s `.find`) are not aggregations and stay inline — V2's assertion must target `.filter(` predicates only.
2. ~~**`/lol/recap` forked the design system it predates.**~~ — **shipped 2026-06-12.** Decision: blessed as a third exported recipe, `ChapterLabel` (+ `CHAPTER_LABEL_CLASS` for motion elements that can't swap the component, mirroring the `lib/tooltip.ts` const pattern) in [chapter-label.tsx](../../../apps/web/src/components/ui/chapter-label.tsx). 17 sites migrated, not ~15: 14 across the seven `lol/recap/recap-*.tsx` chapters (signature-game's two `m.h2` eyebrows use the exported const), 2 in `steam-chronotype-tile.tsx` (`as="h3"`; color normalized from full `text-muted-foreground` to the recipe's `/70`), 1 month-group header in `recent-unlocks-virtual.tsx` (normalized: dropped its `font-semibold` + full color; spacing kept via `className` override).
3. ~~**Hand-rolled frosted recipe ×7 in recap**~~ — **shipped 2026-06-12.** Deviation from the audit's `CardShell` suggestion: `CardShell` is an opinionated verdict-card (fixed title/verdict/evidence slots, plain `div`, own `CardTitle`) and can't host the chapter outers, which are `m.section` wrappers with viewport-entry choreography. Consolidated instead into a recap-local [chapter-shell.tsx](../../../apps/web/src/lol/recap/chapter-shell.tsx): `ChapterShell` component (`populated` prop picks the y:32/0.7s/[0.32,0.72,0,1] variant vs the y:16/0.6s/easeOut empty entrance; internal `useReducedMotion`) + exported `CHAPTER_SHELL_CLASS` / `CHAPTER_SHELL_EMPTY_CLASS` consts. 13 occurrences migrated (the audit's ×7 counted only the empty variant): empty+populated pairs in patch-verdict, top-insight, duo-of-year, rank-arc, most-improved (all five dropped their now-unused `m`/`useReducedMotion` imports); empty-only in champion (its populated outer stays bespoke transparent + baked splash); signature-game's two `variants`-driven m.sections take the class consts. `rounded-xl` blessed as deliberate for chapter outers — recorded as a "Radius exception" note in repo-conventions § tile background.
4. ~~**Retired opacity rungs ×15**, concentrated in empty states~~ — **shipped 2026-06-12.** Canonical empty-state recipe defined on the primitive: `EMPTY_FRAME_CLASS` (`rounded-lg border border-dashed bg-card/50`) exported from [empty-state.tsx](../../../apps/web/src/components/empty-state.tsx) plus an opt-in `framed` prop on `EmptyState`. Migrated: `profile-duos.tsx` (dropped the ad-hoc wrapper div, `framed` prop), `profile-synergy.tsx:224`, `profile-pregame-ritual.tsx:316`, `routes/steam/achievements.tsx` loading + error placeholders. Rung fixes: recap-teaser link on `routes/lol/$accountSlug/index.tsx` promoted `/30`→frosted (`hover:bg-card/80`), `live.tsx` participant rows + `section-nav.tsx` dropdown trigger promoted `/60`-no-blur→frosted (both face splash/panel chrome directly), `profile-synergy.tsx:203` detail-link button demoted to `/50` (nested inside accordion chrome), `accordion.tsx` hover/open states demoted `/60`→`/50`. **Two audit false positives, do not re-flag:** `match-review-view.tsx:357` and `champions/$championKey.tsx:787` — their `backdrop-blur-sm` lives in the cn() base string one line above the tone-branch `bg-card/60`, so both were already the frosted recipe. Original site list: [profile-duos.tsx:24](../../../apps/web/src/lol/profile/profile-duos.tsx#L24) (`bg-card/20`), [profile-synergy.tsx:224](../../../apps/web/src/lol/profile/profile-synergy.tsx#L224) (`bg-card/20`), [profile-pregame-ritual.tsx:316](../../../apps/web/src/lol/profile/profile-pregame-ritual.tsx#L316) (`bg-card/30`), [routes/steam/achievements.tsx:56,64](../../../apps/web/src/routes/steam/achievements.tsx#L56) (`bg-card/30`), [routes/lol/$accountSlug/index.tsx:213](../../../apps/web/src/routes/lol/$accountSlug/index.tsx#L213); plus `bg-card/60`-without-blur on [profile-synergy.tsx:203](../../../apps/web/src/lol/profile/profile-synergy.tsx#L203), [match-review-view.tsx:357](../../../apps/web/src/lol/matches/match-review-view.tsx#L357), [routes/lol/$accountSlug/live.tsx:142](../../../apps/web/src/routes/lol/$accountSlug/live.tsx#L142), [section-nav.tsx:211](../../../apps/web/src/_shared/section-layout/section-nav.tsx#L211), [ui/accordion.tsx:15](../../../apps/web/src/components/ui/accordion.tsx#L15). The empty-state cluster means: define ONE canonical empty-state recipe on the `EmptyState` primitive in this chunk, migrate the dashed-border improvisations to it.

### V2 — Conventions enforcement test

~~Grep-shaped assertions in a `conventions.spec`~~ — **shipped 2026-06-12** by extending the existing [apps/api/src/conventions.spec.ts](../../../apps/api/src/conventions.spec.ts) (which already carried the remake-filter and native-`title=` assertions). Two new assertions, both mutation-tested with a canary file: (1) **no re-typed header recipes** — token-based (all distinctive classes present on one line, order-independent so Tailwind reordering can't dodge it) for the SectionTitle / CardTitle / ChapterLabel signatures, allowlisting each primitive's own file; editorial variants with different tracking (`0.18em`, `-wider`) are deliberately not flagged. (2) **no retired bg-card rungs** — `/20|/30|/70` flat-banned; `/60` must have `backdrop-blur` within a ±12-line window (the blur legitimately sits in a cn() base string a few lines from tone-branch usages); lines without a string delimiter are prose comments and skipped. V1 was the last manual sweep.

---

## Surface treatment gaps (steepest gradient vs siblings)

### V3 — Patches route identity pass *(needs eyes first)*

[/lol/patches](../../../apps/web/src/routes/lol/patches/index.tsx) + `$version` is the plainest recurring surface in the app: no splash claim, no entrance stagger, no hover elevation, plain collapsibles. Palette grammar shipped, visual identity didn't. Patches are champion-centric — a splash claim keyed to the selected patch's headline champion reuses existing `SplashProvider` machinery. Mind the per-route paint budget table when adding frost/blur.

### V4 — Match-detail subtab transition polish

Recap / Review / Timeline / Your-game swaps are instant content swaps inside an otherwise highly choreographed panel — the contrast with the parent's motion is what reads as unfinished. Skeleton-per-tab exists ([match-detail-skeleton.tsx](../../../apps/web/src/lol/matches/match-detail-skeleton.tsx) branches on tab); the gap is the *transition* between loaded tabs. Check [panel-compositor-load.md](panel-compositor-load.md) before adding anything that claims backdrop or promotes layers inside the panel.

### V5 — head/meta completeness

~~Steam layout/index and match-detail subtabs rely on parent titles~~ — **shipped 2026-06-12.** The scout claim was half-stale: `routes/steam.tsx` already carried `routeMeta`; the real gaps were `steam/index.tsx` (now "Steam profile · vyoh.gg") and the four match-detail subtabs (recap / your-game / review / timeline — `$matchId/index.tsx` is a redirect, needs none). Each subtab emits a per-tab title + description **and re-emits the per-match `og:image`** — required because the subtabs are the shareable URLs (index redirects to `/recap`) and a child `routeMeta` without `ogImage` would override the parent's `twitter:card` down to `summary` while the parent's `og:image` persisted. The OG URL moved to a shared helper, [match-og.ts](../../../apps/web/src/lol/matches/match-og.ts), so the hosting-gated localhost base (frontend-2026-gaps item O) stays a single grep-able site instead of five copies.

### V6 — Focus-visible ring audit *(needs eyes — keyboard, not mouse)*

Global ring is `outline-ring/50` ([index.css](../../../apps/web/src/index.css) ~L487–525); scout flagged it as possibly too subtle over busy splash backdrops. One manual tab-through session across LoL profile, a panel, and Steam library; if confirmed, try `/75` or a two-tone ring. A11y polish is portfolio signal in itself.

### V7 — Status page polish

Plain tables, text-only state indicators, no skeletons. Lowest priority of the surface passes, but publicly visible. **Sequence with** the status-page admin surface + owner-auth items already tracked in [open-work.md](../open-work.md) § Pre-deploy — don't polish a layout that the admin-surface work is about to restructure.

---

## System gaps (per-surface where it should be centralized)

### V8 — Chart theming consolidation ✅ shipped 2026-06-12

Three chart families (TrendKda, MatchGoldLead, ProfileLpHistory) each hand-roll the same tooltip pattern (`bg-popover/85 backdrop-blur-md` + AnimatePresence + spring) — convergent but copy-shaped (pickup found a 4th copy in `match-lane-phase.tsx`). Chart palettes are hardcoded hex per chart and never consume `--theme-color`/`--accent`, so data viz is the one subsystem that doesn't participate in the per-entity theme cascade (selection, scrollbar, form controls all do). **Primitives shipped 2026-06-12**: [chart-tooltip.tsx](../../../apps/web/src/components/chart-tooltip.tsx) (`ChartTooltipShell`, AnimatePresence-owning, children-nulled-while-inactive API) + [chart-palette.ts](../../../apps/web/src/lib/chart-palette.ts) (role-keyed slots; `CHART_SERIES` = `var(--accent, #34d399)` so the cascade participation is wired with zero visual change on unclaimed routes; positive/negative stay fixed emerald/rose because semantics must not follow decoration; deeper theme-following of `CHART_TREND` flagged as a needs-eyes design decision, not flipped silently). Migration shipped same day: all four tooltip copies (trend-kda, lp-history-tooltip, gold-lead, lane-phase) now render `ChartTooltipShell`; series/gradient/streak hex routed through the palette slots; grid/axis/cursor on those charts use the chrome slots. One deliberate visual delta: lp-history streak bands + tier markers consolidated `#f87171` (red-400) → `CHART_NEGATIVE` `#fb7185` (rose-400), matching the app-wide emerald/rose W/L pairing the other charts already used. `QUEUE_COLOR` per-queue strokes left as-is (semantic per-queue identity, not drift). Conventions chart row updated to point at the primitives. The KB file-20 Recharts-audit pairing and gaps item G remain with the [frontend-2026-kb-expansion.md](frontend-2026-kb-expansion.md) arc. **Sequence with** the vyoh Recharts audit that opens KB file 20 ([frontend-2026-kb-expansion.md](frontend-2026-kb-expansion.md)) and gaps item G (charting decision tree) — same files, one pass. Strong case-study paragraph.

### V9 — Empty states as editorial voice *(design pass, after V1)*

V1 fixes the empty-state *recipe*; this chunk gives `EmptyState` the editorial *tone*. The patch-verdict empty-state copy ("Once you've played at least 5 games on two or more patches…") is already the right voice — audit all empty states against it. Turns a hygiene fix into a visible signature.

---

## Decisions / avenues (not tracked anywhere else — checked against quick-wins, elevation-arcs, motion-backlog, parked, vnext)

### V10 — Make dark-only a decision, not an accident

`html class="dark"` is hardcoded, no `prefers-color-scheme: light` handling. Dark-only is a defensible art direction for this app — but currently it's unstated. Decide it; if the answer is dark-only, say so in repo-conventions + the case study (the deliberate-choice framing is itself signal). Pairs with frontend-2026-gaps Round 2 item F (`color-scheme` pilot).

### V11 — 404/not-found art direction

Error handling exists at root (orb glyph fallback) and LoL scope; a bespoke `notFoundComponent` is the cheapest "this person sweats details" moment a visitor can stumble into. Quick-win sized — also listed in [quick-wins.md](quick-wins.md).

### V12 — Per-match share card

Champion / profile / Steam-game OG cards shipped 2026-06-07 (og-image-pipeline C1–C4). The remaining gap is a per-*match* card — pairs with the WebShare quick-win (its open question "what's the share payload" is answered by this card).

---

## Stale claims killed during the audit — do NOT re-discover these

Scout output asserted each of these; targeted verification disproved them. Recorded so a future audit doesn't re-raise them:

- ~~"Steam routes have no backdrop"~~ — [profile-backdrop.tsx](../../../apps/web/src/steam/profile-backdrop.tsx) leases the page-wide backdrop from the Steam section root; route-level grep misses it because the claim lives in the layout.
- ~~"Wishlist is plain tabs"~~ — stale; imminent-hero subject chapter with backdrop lease + capsule hero shipped 2026-06-08→11.
- ~~"theme-color meta is static `#0a0a0a`"~~ — that's the index.html fallback; per-route `theme-color` is driven by `useThemeColor` (shipped 2026-05-28 with iOS PWA polish).
- ~~"Hardcoded hex colors are drift"~~ — all ~40–50 are deliberate chart/SVG/accent constants. (V8 may *choose* to theme-derive them, but they're not accidents.)
- Scout route-matrix "Motion ✗ / Error ✗" columns were unreliable (checked route files only, missed layout-level wiring) — don't trust that matrix without re-verification.

**Clean bills** (audited, zero violations — conventions that held): native `title=`; inline tooltip classNames (2026-06-11 sweep held); raw champion aliases; cross-package duplicate formatters; cross-package relative imports; kebab-case naming (100%); `cursor-pointer` on buttons; TODO/FIXME markers (zero in src); unjustified suppressions (all 50 carry explanations); dead CSS (spot-checks all live); skeleton↔layout mirroring (spot-checked); API N+1 patterns (none found).

---

## Hygiene appendix (from the A− hygiene scout — lower confidence, re-verify scope at pickup)

- **H1 — Tailwind primitive extraction.** Five >60-char class strings repeated 3–8×: `text-6xl font-semibold leading-[0.95] text-foreground sm:text-7xl` (×8, hero heading), the stats-label flex+tracking string (×7), the recap frosted string (×7 — this one is V1 item 3, not a new primitive), `text-2xl font-semibold tabular-nums…` (×6), the masthead-interactive string (×6).
- **H2 — `routes/` components carry zero tests.** The one that matters: [routes/lol/$accountSlug/live.tsx](../../../apps/web/src/routes/lol/$accountSlug/live.tsx) (~493 lines, interactive). Convention says interactive surfaces get same-commit tests; these predate it.
- **H3 — `img.controller.ts` (~676 lines)** hardcodes 4 Steam CDN bases + regex validators inline; extractable to a config module (~150 lines off the controller).
- **H4 — Repeated Prisma `include` shapes** across services; typed helpers (`withFullProfile()` etc.) would deduplicate. DX-only.

Not-issues (judged intentional, recorded to prevent re-flagging): 1,000-line recap chapter components (deliberate composition, 9 sub-components each); large api services (single-responsibility facades); `as any` in routeTree.gen + one documented palette-navigation cast.

---

## Sequencing

1. **V1 + V2** together (V2 locks in V1's sweep) — one session.
2. **V8** when the KB file-20 Recharts audit happens anyway — same files, one pass.
3. **V3** next time a visual-identity session is wanted — highest-visibility plain surface. Needs eyes first.
4. **V5, V6, V11** as ≤30-min quick-win pickups (V11 cross-listed in quick-wins.md).
5. **V4** when next inside the match-detail panel; **V7** only alongside the admin-surface work; **V9, V10, V12** are design decisions — pick up when the mood strikes, no dependencies.
