# Visual-excellence audit — 2026-06-12

**Status:** Active — V1 (full sweep) + V2 (enforcement test) + V3 (patches identity, all 5 chunks) + V5 (head/meta completeness) + V8 (chart theming) shipped 2026-06-12; V4 (subtab transition) + V6 (theme-colored focus ring, incl. cross-engine Firefox fix) shipped + closed 2026-06-13. V7 (status page) deferred — gated on owner-auth / status-admin restructure (its own section). Remaining: V9–V12 design decisions, unscoped.

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

### V3 — Patches route identity pass *(shipped 2026-06-12 — all 5 chunks)*

[/lol/patches](../../../apps/web/src/routes/lol/patches/index.tsx) + `$version` is the plainest recurring surface in the app: no splash claim, no entrance stagger, no hover elevation, plain collapsibles. Palette grammar shipped, visual identity didn't. Patches are champion-centric — a splash claim keyed to the selected patch's headline champion reuses existing `SplashProvider` machinery. Mind the per-route paint budget table when adding frost/blur.

**Chunk plan (acked 2026-06-12).** Direction: splash claim is O(1); frost lives at section level only, never per change-row, so blur-layer count stays constant (~3) regardless of patch size. Fallback ladder if the re-probe blows budget: demote frosted sections to `/50` first; the splash is the cheap part and goes last.

0. ✅ **Baseline** — `lol-patches` perf-probe scenario added, pinned to patch 26.3 (41 champ / 9 item / 3 rune changes — largest in DB) with `?as=ahri` lens. 3-run bracket: load = 19 layers / 42–50 ms raster / 0–2 long tasks / dropped=0; scroll-bottom = 16–24 layers / 7–11 ms raster / dropped=0.
1. ✅ **Splash claim** — `useSplashChampion(championAliasFromName(sortedChampions[0]))` (owner's most-played changed champion, else alpha-first); null claim on loading/empty, gated on `championsReady` (pre-load aliasFromName falls back to wiki display name — not a splash key). Splash also drives the route theme color for free via `SplashProvider`'s `useThemeColor` wiring.
2. ✅ **Tile recipes** — adjusted from the original sketch: wrapping bordered `/50` rows in a frosted wrapper would nest chrome inside chrome, so the rows lost their own borders instead. One frosted card (`bg-card/60 backdrop-blur-sm`) carries toolbar-as-header-strip + bare `divide-y` rows — mirrors `PatchEntrySection`'s internal structure, single blur layer at any patch size. No `CardTitle` inside: the page `h1` already titles the region. Item/rune collapsibles promoted `/50` → frosted. Empty/filtered message renders inside the persistent card so the "My champions only" toggle stays reachable. Skeleton updated to mirror (header / tall card / two collapsed bars). The art-backed `ChampionCardChrome` row treatment (match-list/champion-list idiom) was considered and rejected: dense multi-line changelist text would sit over the art zone left of the 45% gradient stop.
3. ✅ **Motion** — adapted to the chunk-2 composition: page rides the CSS mount cascade (bento surface → `data-mount-stagger`, not Motion variants). Header text uses the shared opacity stagger (`--i` 0–2); the three frosted cards use a **new frost-safe `data-mount-stagger-frosted`** opt-in in motion.css (translate-only, same `--i` clock, reduced-motion-disabled) because animating opacity on a frosted element suppresses its backdrop-filter ([[ancestor-opacity-suppresses-backdrop-filter]]). Hover: in-card divided rows get a glass-family scan-aid tint (`hover:bg-card/40`, no cursor-pointer — rows aren't clickable; champion-list's art-card lift doesn't fit divided rows), collapsible header buttons get `hover:bg-card/50`; cards gained `overflow-hidden` so fills clip to the radius.
4. ✅ **Re-probe + budget row** — post-change 3-run bracket: load 22–27 layers / raster 56–266 median ~230 / dropped=0; scroll-bottom raster ~620–720 ms with dropped=0 and longTasks=0. The scroll raster is the multi-viewport frosted champion card re-sampling the animated splash — 8× recap's scroll raster (83 ms), ~2× lol-overview's (168–377 ms). Per-row CV gating (champion-table pattern) was tried and kept but only bought ~5%; the cost lives in the blur region, not row content. **Accepted as GPU energy, not user-felt jank** (same reasoning as [[feedback_panel_close_raster_floor]]): the documented scroll-phase gates are dropped frames and long tasks, both at 0. Budget row added to repo-conventions with the fallback documented (demote champion card to `/50`, splash stays) if a future dataset drops frames. Owner verified the look on the live page 2026-06-13 — the deferred chunk-0 "needs eyes" check is now cleared; V3 fully closed.

### V4 — Match-detail subtab transition polish *(shipped 2026-06-13)*

Recap / Review / Timeline / Your-game swaps were instant content swaps inside an otherwise highly choreographed panel — the contrast with the parent's motion is what read as unfinished. Skeleton-per-tab already existed ([match-detail-skeleton.tsx](../../../apps/web/src/lol/matches/match-detail-skeleton.tsx) branches on tab); the gap was the *transition* between loaded tabs.

**Shipped:** an entrance-only, **transform-only** settle on the `<Outlet/>` wrapper in [$matchId.tsx](../../../apps/web/src/routes/lol/$accountSlug/matches/$matchId.tsx) (~L343) — keyed on `tab` so each swap re-mounts and replays `y:10→0` over 0.24s (`[0.32,0.72,0,1]`), `reduced`-gated. Two deliberate constraints drove the shape:

- **No opacity / no AnimatePresence.** The tab bodies carry frosted tiles; an opacity-animating ancestor flattens them into one buffer and kills `backdrop-filter` mid-swap ([[ancestor-opacity-suppresses-backdrop-filter]] — same trap the body-wrapper comment at L318–328 already avoids). Transform-only (y) is the sanctioned frost-safe entrance.
- **Entrance-only, not enter/exit.** `<Outlet/>` always renders the *current* route, so on tab change the outgoing subtree is already gone — there is nothing to exit-animate. Wrapping Outlet in `AnimatePresence` would not capture it. Entrance-only matches the app's mount-cascade idiom.

No new backdrop claim or persistent layer (transform promotes a layer only for the 0.24s window), so the [panel-compositor-load.md](panel-compositor-load.md) budget is unaffected; there is no match-detail probe scenario (closest baselined is `lol-champion-panel`). **Needs eyes:** owner to confirm the settle reads right and the frosted tiles don't flicker mid-swap on a real tab-through.

### V5 — head/meta completeness

~~Steam layout/index and match-detail subtabs rely on parent titles~~ — **shipped 2026-06-12.** The scout claim was half-stale: `routes/steam.tsx` already carried `routeMeta`; the real gaps were `steam/index.tsx` (now "Steam profile · vyoh.gg") and the four match-detail subtabs (recap / your-game / review / timeline — `$matchId/index.tsx` is a redirect, needs none). Each subtab emits a per-tab title + description **and re-emits the per-match `og:image`** — required because the subtabs are the shareable URLs (index redirects to `/recap`) and a child `routeMeta` without `ogImage` would override the parent's `twitter:card` down to `summary` while the parent's `og:image` persisted. The OG URL moved to a shared helper, [match-og.ts](../../../apps/web/src/lol/matches/match-og.ts), so the hosting-gated localhost base (frontend-2026-gaps item O) stays a single grep-able site instead of five copies.

### V6 — Focus-visible ring audit *(shipped 2026-06-13; cross-engine fix 2026-06-13 — owner-confirmed grey in Firefox)*

Global ring was `outline-ring/50` on `*` ([index.css](../../../apps/web/src/index.css#L489)) — a neutral gray (`--ring`) at 50% opacity, too subtle over busy splash backdrops and the one interactive-affordance subsystem that didn't join the per-entity theme cascade (`accent-color` + `::selection` right below it already pull from `--theme-fg`).

**Shipped (owner picked theme-colored ring over /75 and two-tone halo):** swapped to `outline-theme-ring`, pointing the global `*` outline at the existing `--theme-ring` token (`--color-theme-ring`, [index.css](../../../apps/web/src/index.css#L325)). That token was already defined but only consumed as a glow `box-shadow` (motion.css L123, fetch-progress) — this activates it for focus. Wins: (1) ring now follows the champion/route hue like selection + accent-color; (2) baked opacity 0.6 (light) / 0.7 (dark) is *more* opaque than the old /50, a contrast gain on top of the color; (3) `prefers-contrast: more` already bumps `--theme-ring` to 0.95 ([index.css](../../../apps/web/src/index.css#L441)), so high-contrast users get a near-solid ring for free; (4) off-theme routes (`/status`) fall back to the default `--theme-color` blue (`oklch(0.6 0.16 240)`), a conventional, visible focus color. Adjacent cascade comment extended to name the ring.

**Cross-engine fix (2026-06-13):** the initial swap set only `outline-color` on `*`, which was insufficient — owner reported a grey/white ring. A Playwright Chromium+Firefox probe (tab-through, read computed `outline*` on each `:focus-visible` element) pinned two causes: (1) the browser's native focus ring is `outline-style: auto`, which paints a UA grey ring and *ignores* a custom `outline-color`, so bare elements (links/buttons with no own focus utility) never showed the theme hue; (2) **in Firefox the universal `outline-color` lost to `currentColor` on some elements** (wordmark, back-home link), drawing a *white* ring (their text color) — this was the owner's "grey," since the owner runs Firefox. Both fixed by writing the full themed outline directly on the focused element in `@layer base`: `*:focus-visible { outline: 2px solid var(--theme-ring); outline-offset: 2px; }` — color included so it can't fall back to currentColor. Kept in `base` so component `focus-visible:outline-*` utilities (the `outline-none` opt-outs, bespoke widths) still win via the utilities layer. Re-probe confirmed every focused element resolves `outline-color` to `--theme-ring` in both engines (red `oklch(0.62 0.2 25 / 0.7)` under a forced red theme; default-blue on unclaimed routes). **Verification method worth reusing:** headless splash doesn't load, so `--theme-color` stays the default blue in-probe — force `--theme-color` via `documentElement.style` to preview the themed ring. V6 closed.

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
