# Visual-excellence audit — 2026-06-12

**Status:** Active — V1 in progress (picked up 2026-06-12 with V2, V5, V8 in the same session plan). V1.1 (remake filters) shipped; V1.2–V1.4, V2, V5, V8 next.

Code-level audit of visual consistency, surface treatment gradient, and hygiene. **Not a rendered-page review** — items marked "needs eyes" require looking at the running app before acting ([[feedback_dont_guess_visual_content]]). Chunk IDs are V1–V12 (work) and H1–H4 (hygiene appendix), following the [audit-2026-06-11.md](audit-2026-06-11.md) fan-out-index shape.

**Meta-finding (load-bearing):** every convention backed by a primitive or helper held under audit (tooltip recipes, `useChampionName`, shared formatters); every convention enforced only by review drifted (header primitives, tile recipes, `excludeRemakes`). V2 exists to close that loop — without it, V1 is the *second-to-last* sweep, not the last.

---

## Verified drift (all spot-checked, not just scout claims)

### V1 — Consistency sweep (one PR, mechanical)

1. ~~**Inline remake filters ×3** bypassing the `excludeRemakes()` invariant~~ — **shipped 2026-06-12.** Pickup grep found 5 aggregation-filter sites, not 3: the audit's three (`recap-top-insight.tsx`, `profile-lp-history.tsx`, `champions/$championKey.tsx`) plus two combined-predicate filters in `use-habits-stats.ts` (`computePoolStats`) and `profile-pregame-ritual.tsx` (`buildChampionSignal`). All five now route through `excludeRemakes()`. Single-match display checks (`match-row.tsx`, `match-record.tsx`, `profile-post-game.tsx`'s `.find`) are not aggregations and stay inline — V2's assertion must target `.filter(` predicates only.
2. **`/lol/recap` forked the design system it predates.** Verified [recap-patch-verdict.tsx:52](../../../apps/web/src/lol/recap/recap-patch-verdict.tsx#L52): ad-hoc `<h2 className="text-xs uppercase tracking-wide text-muted-foreground/70">` inside frosted chrome — a third header variant that is neither `SectionTitle` nor `CardTitle`. ~15 similar sites across `lol/recap/recap-*.tsx` + Steam achievement tiles ([steam-chronotype-tile.tsx](../../../apps/web/src/steam/achievements/steam-chronotype-tile.tsx), [recent-unlocks-virtual.tsx](../../../apps/web/src/steam/achievements/recent-unlocks-virtual.tsx)). **Decision required at pickup:** migrate to `CardTitle`, or bless the `text-xs` look as a third exported recipe — either way, encode it; don't leave it ad-hoc.
3. **Hand-rolled frosted recipe ×7 in recap** — `flex flex-col gap-3 rounded-xl border bg-card/60 p-6 backdrop-blur-sm` re-typed verbatim instead of `CardShell` (which defaults `frosted=true`). Also `rounded-xl` where the convention table says `rounded-md/lg` — decide whether chapter outers legitimately get `xl` and note it in repo-conventions, or normalize.
4. **Retired opacity rungs ×15**, concentrated in empty states: [profile-duos.tsx:24](../../../apps/web/src/lol/profile/profile-duos.tsx#L24) (`bg-card/20`), [profile-synergy.tsx:224](../../../apps/web/src/lol/profile/profile-synergy.tsx#L224) (`bg-card/20`), [profile-pregame-ritual.tsx:316](../../../apps/web/src/lol/profile/profile-pregame-ritual.tsx#L316) (`bg-card/30`), [routes/steam/achievements.tsx:56,64](../../../apps/web/src/routes/steam/achievements.tsx#L56) (`bg-card/30`), [routes/lol/$accountSlug/index.tsx:213](../../../apps/web/src/routes/lol/$accountSlug/index.tsx#L213); plus `bg-card/60`-without-blur on [profile-synergy.tsx:203](../../../apps/web/src/lol/profile/profile-synergy.tsx#L203), [match-review-view.tsx:357](../../../apps/web/src/lol/matches/match-review-view.tsx#L357), [routes/lol/$accountSlug/live.tsx:142](../../../apps/web/src/routes/lol/$accountSlug/live.tsx#L142), [section-nav.tsx:211](../../../apps/web/src/_shared/section-layout/section-nav.tsx#L211), [ui/accordion.tsx:15](../../../apps/web/src/components/ui/accordion.tsx#L15). The empty-state cluster means: define ONE canonical empty-state recipe on the `EmptyState` primitive in this chunk, migrate the dashed-border improvisations to it.

### V2 — Conventions enforcement test

Grep-shaped assertions in a `conventions.spec` (or extend the existing one if present): no inline `!m.remake` / `!match.remake` outside `excludeRemakes`; no ad-hoc `uppercase tracking-` headers outside `SectionTitle`/`CardTitle`/blessed recipes; no retired opacity rungs (`bg-card/20|/30|/70`, `/60` without `backdrop-blur-sm` on the same className). A few dozen lines of test; makes V1 the last manual sweep.

---

## Surface treatment gaps (steepest gradient vs siblings)

### V3 — Patches route identity pass *(needs eyes first)*

[/lol/patches](../../../apps/web/src/routes/lol/patches/index.tsx) + `$version` is the plainest recurring surface in the app: no splash claim, no entrance stagger, no hover elevation, plain collapsibles. Palette grammar shipped, visual identity didn't. Patches are champion-centric — a splash claim keyed to the selected patch's headline champion reuses existing `SplashProvider` machinery. Mind the per-route paint budget table when adding frost/blur.

### V4 — Match-detail subtab transition polish

Recap / Review / Timeline / Your-game swaps are instant content swaps inside an otherwise highly choreographed panel — the contrast with the parent's motion is what reads as unfinished. Skeleton-per-tab exists ([match-detail-skeleton.tsx](../../../apps/web/src/lol/matches/match-detail-skeleton.tsx) branches on tab); the gap is the *transition* between loaded tabs. Check [panel-compositor-load.md](panel-compositor-load.md) before adding anything that claims backdrop or promotes layers inside the panel.

### V5 — head/meta completeness

~17 routes use `routeMeta()`; the Steam layout/index and the match-detail subtabs appear to rely on parent titles (scout claim, unverified — confirm with `ugrep -l routeMeta apps/web/src/routes` before acting). Cheap completeness win; pairs with the shipped og-image-pipeline `head()` work.

### V6 — Focus-visible ring audit *(needs eyes — keyboard, not mouse)*

Global ring is `outline-ring/50` ([index.css](../../../apps/web/src/index.css) ~L487–525); scout flagged it as possibly too subtle over busy splash backdrops. One manual tab-through session across LoL profile, a panel, and Steam library; if confirmed, try `/75` or a two-tone ring. A11y polish is portfolio signal in itself.

### V7 — Status page polish

Plain tables, text-only state indicators, no skeletons. Lowest priority of the surface passes, but publicly visible. **Sequence with** the status-page admin surface + owner-auth items already tracked in [open-work.md](../open-work.md) § Pre-deploy — don't polish a layout that the admin-surface work is about to restructure.

---

## System gaps (per-surface where it should be centralized)

### V8 — Chart theming consolidation

Three chart families (TrendKda, MatchGoldLead, ProfileLpHistory) each hand-roll the same tooltip pattern (`bg-popover/85 backdrop-blur-md` + AnimatePresence + spring) — convergent but copy-shaped. Chart palettes are hardcoded hex per chart and never consume `--theme-color`/`--accent`, so data viz is the one subsystem that doesn't participate in the per-entity theme cascade (selection, scrollbar, form controls all do). Deliverables: shared `<ChartTooltip />` shell + one chart-palette module derived from theme tokens. **Sequence with** the vyoh Recharts audit that opens KB file 20 ([frontend-2026-kb-expansion.md](frontend-2026-kb-expansion.md)) and gaps item G (charting decision tree) — same files, one pass. Strong case-study paragraph.

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
