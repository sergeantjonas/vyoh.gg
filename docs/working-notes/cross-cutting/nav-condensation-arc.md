# Nav condensation arc

**Status:** Active — **Chunk 1.1 SHIPPED 2026-05-30** (merged tiered strip, Model 3 master→detail nav, breadcrumb section-switcher, strip-action-icon parity). **Chunk 1.5 LoL portion SHIPPED 2026-05-30** (topbar `AccountRow` showcase: 44px avatar, last-played splash wash, open-stagger; Steam-card variant + live pill deferred — see the 1.5 entry). **Chunk 1.3a LoL portion SHIPPED 2026-05-30** — landed as a **cinematic champion-splash hero** (`LolIdentityHero`), not the bare block: signature-champion splash (sharp 1280px `splash` variant) brought into focus over the ambient backdrop, avatar + `Vyoh#Ahri` + rank crest + last-played, champion-accent glow, Ken-Burns + pointer parallax. Avatar/square icon proxies bumped to native 128px. **M2 (scroll-collapse morph into the strip) SHIPPED 2026-05-30**, plus a scope extension **M2b (the same identity morphs on Profile↔tab navigation) SHIPPED 2026-05-30** — see the 1.3a entry. (Perf-validated on host Chrome 2026-05-30: nav-morph INP 8ms, no regression.) **Chunk 1.3a Steam portion SHIPPED 2026-05-30** — landed as a cinematic Steam identity hero (`SteamIdentityHero`) with live-game-or-top-played backdrop, avatar + persona name + identity headline (`Member since · Level · top N%`) + presence line, plus a 4-cell `SteamStatBand` (recently played + total playtime + most played + library played with bar). See the 1.3a entry for Steam-specific decisions. **Steam M2/M2b morph parity remains as a follow-on** (the LoL portion ships both scroll-collapse and nav-morph; Steam's strip identity is plain inline today). **Chunk 1.2 retargeted from the abandoned seam-straddle ring to a hero-avatar activity ring** (Steam: 7-state presence palette aligned to Steam's brand vocabulary, in-game pulse; LoL: binary in-live-game emerald pulse); 1.3b is gated on external arcs. Promoted to [open-work.md](../open-work.md).

Condense top-of-page chrome from three layers (primary nav + identity header + secondary tabs) to two, restore section context inside detail pages, and elevate the avatar — currently a small static circle — into a piece of visible identity character. Multi-chunk arc; 1.1 lands first and unblocks 1.2 and 1.3.

Sister notes: [elevation-arcs.md](elevation-arcs.md) (this arc is added there at promotion time), [player-portrait.md](../steam/player-portrait.md) (1.3 sits *above* the Portrait/Anti-Portrait cards on Steam; same identity-block-then-deeper-content shape).

---

## Premise

The current chrome on `/lol/$accountSlug/*` and `/steam/*` stacks three sticky-ish layers — primary nav, identity header (avatar + name + account switcher), secondary tabs (Profile/Matches/Trends/Champions or Profile/Library/Wishlist/Achievements). On long pages, that's ~140px of always-visible chrome before the content begins. The identity header reads as a separate strip with a separate job, but it's actually serving the *same* purpose as the secondary tab strip — orienting you inside a section.

The fix is to merge identity + tabs into one strip and treat the showcase moment (big avatar, frame, rank, stats) as **page content** on the Profile tab rather than as section chrome that every tab pays for. (The earlier draft also dropped "Home" from the primary nav; the sizing pass showed that ~80px lives in the *unconstrained* primary nav, not the *constrained* section strip — removing it buys nothing for the strip budget and costs first-time-visitor discoverability, so **Home stays**. See sizing-pass result below.)

The avatar then gets two homes: a small seam-straddling anchor in the merged strip that's always visible, and a content-level identity block on the Profile tab that earns its space because it *is* the page's content.

---

## Surface decision

**Recommendation: edit the existing primary nav + section route layouts in place.**

This is a chrome refactor, not a new surface. The merged strip replaces today's separate identity header + secondary tabs in [`apps/web/src/routes/lol/$accountSlug.tsx`](../../apps/web/src/routes/lol/$accountSlug.tsx) and [`apps/web/src/routes/steam.tsx`](../../apps/web/src/routes/steam.tsx). The primary nav lives in [`apps/web/src/components/nav.tsx`](../../apps/web/src/components/nav.tsx). The Profile-tab content block lives in the respective Profile route files.

No new top-level surface; no new route.

---

## Pre-1.1 sizing pass

Before chunk 1.1 starts, two load-bearing things need a sketch + measurement, not just an "open decision" line. Both can sink the chunk mid-way if punted.

- **Width budget at 1280px.** Mock the merged strip with the longest realistic content: avatar + `Vyoh#Ahri ▾` + four tab labels (`Profile · Matches · Trends · Champions`) + refresh + filters. Measure against 1280px (small laptop) and 1024px (iPad landscape). If it overflows, decide the collapse strategy *before* writing components — icon-only fallback for tabs, truncated identity, hamburger collapse, etc. — and design the strip with that in mind from the start.
- **Mobile sketch at <768px.** The whole brainstorm was desktop-shaped. The merged-strip + seam-straddle pattern needs a deliberate small-viewport answer: scrollable horizontal tab strip below identity? Account picker collapsed into a sheet? Avatar shrinks or moves? Sketch this before 1.1 implementation; treat as a sub-chunk of 1.1, not as deferred work.

Both outputs feed into 1.1's component shape, not into a follow-up arc.

### Sizing-pass result — LOCKED (2026-05-29)

Iterated in a throwaway dev-server mock (`apps/web/src/routes/mock-strip.tsx`, **delete when 1.1's strip lands**), eyeballed across viewports and a "on /live" toggle. Outcome is the **F2 tiered strip**.

**Content width is 848px**, not the assumed ~896/1280. `__root.tsx` wraps the `Outlet` in `mx-auto max-w-4xl p-6` → `max-w-4xl` (896px) − `p-6` (2×24px) = **848px usable**. The strip is built against 848, and the breakpoints below are *viewport* widths (`min-[…]px:`) chosen so the strip never overflows that 848 content box. (Mock bug worth remembering: the mock first measured 800px because `StripFrame` added its *own* `mx-auto max-w-4xl px-6` on top of `__root`'s — double-padding. A strip component must not re-wrap in `max-w`/`px`; it lives inside `__root`'s container already.)

**Three tiers:**

- **≥880px — full row.** `avatar · Vyoh#Ahri · Profile Matches Trends Champions · ⟶ · [Live chip] · filters/refresh`. The four section *tabs* (with `layoutId` morph) render here. (Identity is static — no caret; switching is in the topbar, see 1.1 decision.) **Break nudged 820 → 880 (2026-05-30):** a long Riot ID like `Nine Tailed Fox#EUW` + 4 tabs + live chip crowded the 848 box at 820; collapse to the dropdown a bit sooner. Eyeball-tunable.
- **640–879px — inline single row.** `avatar · identity (protected, never shrinks) · [section dropdown, fills row, min-w so its label never truncates] · [Live chip] · actions`. Tabs collapse into a single **section dropdown** (current section shown as the trigger label).
- **<640px — own-row (F2).** Row 1: `avatar · identity · ⟶ · [Live chip] · actions`. Row 2: full-width section dropdown. **F2 was chosen over F1** (which kept row 1 name-only and pushed chip+actions down to row 2 alongside the dropdown) because F2 fills the dead space next to a short Riot ID by floating chip+actions up to row 1, and reads less asymmetric/messy at the narrowest widths.

**Live is a route-aware chip, NOT a tab.** Idle = subdued pulsing `● Live` (you have a live game; click to watch). Active = bright/filled when on `/live` (the section tabs/dropdown then show *nothing* selected). The justification is **semantic, not capacity** — pulling Live out of the tab row does *not* "free room for a 5th tab" (it still occupies width whenever a game is live); it's that Live is a transient special state that reads better as a presence chip and needs route-active treatment. Tab *growth*, if ever needed, is absorbed by the dropdown-overflow mechanism, not by the chip.

**Real-impl refinements (carry into chunk 2):**
- Make the inline→own-row break **live-aware**: break lower (~540px) when there's no live game, so the absent chip isn't reserving width and forcing an early wrap. With a live game present, keep the 640 break.
- The avatar sat too close to the left border in early mocks — keep it inset with the content gutter, not flush.
- Dropdown gets `min-w-[168px]` and wraps to its own row *before* it would ever have to truncate its label (rejected: horizontal-scroll tab strip — "not easy to use"; icon-only tabs — "users start guessing what a tab is").
- **Own-row tier (<640px) row gap** bumped `gap-y-2.5 → gap-y-3.5` (2026-05-30) — the identity row and the wrapped dropdown row read too cramped at 10px.

**Deferred to the end of this arc (NOT chunk 1.1):**
- **Primary-nav (`nav.tsx`) responsiveness at low widths.** The `logo · Home · LoL · Steam · Status · ⌘K` bar overflows/clips on narrow screens; its collapse strategy (scroll / menu / hide-labels) is a separate concern from the section strip and is scheduled after the arc's main chunks.
- **Topbar LoL account picker behaves oddly at small viewports** (flagged 2026-05-30 from screenshots; pre-existing, not caused by the merged-strip work). Pick up alongside the primary-nav responsiveness pass since they share the same `nav.tsx` surface.

## Chunks

Each chunk independently committable.

**Suggested order:** 1.1 first, then 1.3a, then 1.5 (picker showcase) and 1.3b (visual flair, dependency-gated) in either order, then 1.2 (avatar rings) with an evidence-based evaluation trigger (see below). 1.2 lands last *not* because it's deprioritised but because the question it answers ("does the merged-strip avatar feel visually inert without ring treatment?") is only honestly answerable once 1.1 has been in front of real eyes for a while. 1.5 can parallelize with 1.3 work — different surfaces, independent risk profiles.

### Chunk 1.1 — Core navigation rework

**Goal:** condense chrome from three layers to two; restore section context inside detail pages.

- **Primary nav: unchanged for 1.1.** The earlier plan dropped "Home" (logo doubles as the home affordance), but the sizing pass showed the ~80px gain is in the *unconstrained* primary nav, not the *constrained* section strip — so it does nothing for the budget that actually matters and costs first-time discoverability. **Home stays.** Primary-nav low-width responsiveness is handled at the end of the arc (see sizing-pass result).
- **Merged sticky strip** replaces today's identity header + secondary tabs in a single bar.
  - LoL: `[avatar] Vyoh#Ahri ▾   Profile · Matches · Trends · Champions   [⟳] [≡]`
  - Steam: `[avatar] Vyoh   Profile · Library · Wishlist · Achievements   [≡]`
- **DECISION (2026-05-30): no account picker in the section strip.** The original plan put a caret on the identity (`Vyoh#Ahri ▾`) opening a switcher. We prototyped it, then dropped it: the **top-nav LoL menu already owns account switching** with a richer surface (per-account summoner icon + rank emblem + `region · queue · rank` subline — see `AccountRow` in [`nav.tsx`](../../apps/web/src/components/nav.tsx)). A second picker in the constrained strip duplicates a better surface, forks the affordance, and fights the arc's whole condensation goal. The section identity is now a **static header** (`[avatar] Vyoh#Ahri`); switching lives in the topbar.
- **Region dropped from the strip.** Single-region by design (owner tracks only EUW alts), so there's no per-account region to disambiguate; the topbar picker rows still carry region for completeness. An always-visible region badge would just float between the name and the tab row.
- **Right cluster is route-aware:** `[refresh?] [filters?]`, both conditional per route. No picker on the right (the redundant right-side `AccountSwitcher` is removed entirely).
- **Switch-landing = profile root (topbar behaviour).** Picking an account from the topbar lands on `/lol/$accountSlug` (profile overview), not the prior sub-route. Subtree-preservation (switch account, stay on Matches with window state) was the section picker's one unique value; if it's missed, the small follow-up is to port `(prev) => prev` search + subtree inference into the topbar `AccountRow` — there'd still be only one picker.
- ~~**Logo-as-home usability check.**~~ Moot — Home stays in the primary nav (see above), so there's no logo-as-only-home affordance to validate.
- **Active-tab indicator with shared-layout morph.** The underline/pill that marks the active tab uses Motion `layoutId` to morph smoothly between tabs as the user navigates, instead of snapping. The project already has the `layoutId pills` pattern per [elevation-arcs.md](elevation-arcs.md) — this extends the existing primitive rather than introducing a new one. Folded into 1.1 because it lives inside the same merged-strip component being built here; not worth splitting into a separate chunk. Reduced-motion variant: indicator snaps to position (no morph) per [reduced-motion-replacements](reduced-motion-replacements.md) guardrail.
- **Avatar sits at the seam** between the primary nav and the merged strip — half above, half below the divider. Square crop preserved (avatars are platform identity per [feedback memory](~/.claude/projects/-workspaces-vyoh-gg/memory/feedback_avatars_are_identity.md)). Implementation is `margin-top` + `z-index`, no scroll state machine.
- **Both bars stay sticky.**
- **Detail pages adopt Model 3 (master→detail). SHIPPED (2026-05-30).** Supersedes the earlier same-day "restore section nav + inline detail tabs" pass. The realisation that unblocked it: the section strip is **not** `position: sticky` — it's a flex sibling above `<main>` (the scroll container) in [`__root.tsx`](../../apps/web/src/routes/__root.tsx), so it's always-on by construction and can't scroll away. There was never a "second sticky bar" to justify — only the `ChampionStickyStrip` (a true `position: fixed` overlay) is sticky. So instead of stacking two tab rows, the **single always-on strip carries the higher-frequency DETAIL tabs on a detail page**, and section scope collapses to a breadcrumb — the standard master→detail idiom.
  - On `isMatchDetail`, [`$accountSlug.tsx`](../../apps/web/src/routes/lol/$accountSlug.tsx) swaps the strip's `tabs` from the section tabs to the detail sub-tabs (Recap / Your game / Review / Timeline, built by `buildMatchDetailSectionTabs` in [`match-detail-tabs.tsx`](../../apps/web/src/lol/matches/match-detail-tabs.tsx)), passes a breadcrumb-switcher to `SectionShell`'s new **`leading`** slot, and swaps `tabIndicatorId` to `match-detail-tab-indicator`. **Identity is kept full (avatar + name)** — an early avatar-only trim was reverted (owner, 2026-05-30): the strip has ample width at ≥880px, so dropping the name only cost identity continuity while the champion splash shouts a *different* name.
  - **Section access on detail = breadcrumb-as-switcher** ([`matches-breadcrumb.tsx`](../../apps/web/src/lol/account/matches-breadcrumb.tsx), chosen 2026-05-30 over a two-row header / drill-down / ⌘K-only). A split control: the `‹ Matches` label is a one-click return to the list (most common move, stays prominent, seeds the card-morph back via `setOriginRect`); an appended caret opens a `DropdownMenu` of the sibling sections (Profile/Trends/Champions/Matches), so jumping out of a match isn't a forced two-hop. GitHub/VS Code breadcrumb idiom — segment navigates, caret reveals siblings. The canonical section list (`TABS`) is injected via a `sections` prop so it stays defined once in the route.
  - `SectionShell` gained an optional **`leading?: ReactNode`** slot (rendered between identity and the tab row; every non-detail consumer omits it, so LoL-listing and Steam are untouched). `SectionTab` gained **`replace?: boolean`** so the detail sub-tabs stay a single back-button entry; section tabs omit it and push.
  - [`$matchId.tsx`](../../apps/web/src/routes/lol/$accountSlug/matches/$matchId.tsx) drops its inline `MatchBreadcrumb` + inline `MatchDetailTabs` (both now in the strip); the standalone `MatchDetailTabs` **component was deleted** (its renderer is now the shared `SectionTabRow`). The detail sub-tabs are now `nav`-links, not a `role="tablist"` — correct, since each is a route, not an in-page panel.
  - **DECISION (owner, 2026-05-30): the `ChampionStickyStrip` is kept as a pure context caption** (champion icon + W/L + KDA + LP, no tabs). It pins below the header on deep scroll. The scrollspy aside offset in [`match-detail-view.tsx`](../../apps/web/src/lol/matches/match-detail-view.tsx) was corrected from `+88px` (stale two-row-strip clearance) to `+52px` (one-row caption ~42px + gap) — this also fixes the dead-gap-above-scrollspy the owner flagged. The richer `· Match · date vs X` breadcrumb is **not done** (deferred polish, non-blocking).

**Files in scope (estimated):**
- [`apps/web/src/components/nav.tsx`](../../apps/web/src/components/nav.tsx) — **no change in 1.1** (Home stays; low-width responsiveness deferred to end of arc).
- [`apps/web/src/routes/lol/$accountSlug.tsx`](../../apps/web/src/routes/lol/$accountSlug.tsx) — merge identity strip + secondary tabs into one component.
- [`apps/web/src/routes/steam.tsx`](../../apps/web/src/routes/steam.tsx) — same merge for Steam.
- ~~LoL account-picker dropdown component~~ — **deleted.** `apps/web/src/lol/_shared/account/account-switcher.tsx` (+ test) removed; the topbar `AccountRow` is the sole switcher.
- Match-detail route files — restore section nav, demote detail-tab chrome to inline.
- [`apps/web/src/_shared/section-layout/section-shell.tsx`](../../apps/web/src/_shared/section-layout/section-shell.tsx) — **reshape, not greenfield.** This already exists with `identity`/`actions`/`nav` slots, the `#section-header-slot` portal, the `compact`/`bandOpaque` scroll state, the ResizeObserver band-height sync, and `SectionShellProvider`. Chunk 2 collapses its current two-row render (identity+actions row, then nav row) into the single tiered merged strip above, preserving all of that machinery and the `layoutId` tab indicators. One change point propagates to both LoL and Steam.

**Libraries needed:**
- **Existing only.** Shadcn `DropdownMenu` (Radix-based, already in project at 103 import sites per [library-shortlist.md](library-shortlist.md)) for the collapsed section dropdown (<880px tiers). `TooltipPrimitive` for icon tooltips per [repo-conventions.md](../../repo-conventions.md). Shadcn `Tabs` for the inline detail-page tab nav.
- No new dependencies.

**Tests in scope (same commit):**
- Merged-strip component: keyboard navigation between tabs, ARIA tab roles. Axe scan. (No account-picker/region tests — picker dropped.)
- `SectionShell` `leading` slot — **shipped** in [`section-shell.test.tsx`](../../apps/web/src/_shared/section-layout/section-shell.test.tsx): renders the slot when passed, omits it otherwise (guards the breadcrumb mount + the non-detail/Steam "untouched" guarantee).
- Breadcrumb-switcher — **shipped** in [`matches-breadcrumb.test.tsx`](../../apps/web/src/lol/account/matches-breadcrumb.test.tsx): the `‹ Matches` back link points at the matches list, the section-switcher trigger is present + labelled (`aria-label="Switch section"`), axe-clean. (Radix `DropdownMenu` doesn't open in happy-dom, so the section items behind the trigger aren't asserted — same limitation as the section dropdown.)
- Detail sub-tab logic — **shipped** in [`match-detail-tabs.test.ts`](../../apps/web/src/lol/matches/match-detail-tabs.test.ts): `activeMatchDetailTab` maps each subpath (+ unknown-segment and trailing-slash fallbacks) to the right tab id; `buildMatchDetailSectionTabs` returns the four tabs in order, all `replace: true`, with exactly the active one flagged. Plus `matchIdFromPath` in [`account-tab-helpers.test.ts`](../../apps/web/src/lol/account/account-tab-helpers.test.ts) (extracts the id, drops the sub-tab segment, null off-subtree). Together these guard "the strip shows the right detail tabs, active-marked, on every detail URL."
- The deleted `MatchDetailTabs` component took its `match-detail-tab-nav.test.tsx` with it (the renderer is now the shared `SectionTabRow`, covered by the merged-strip tests above). The `$matchId.tsx` composition change (no inline tabs/breadcrumb) gets **no new full-route test, by decision** — mocking `createFileRoute` + ~10 data hooks to assert "tabs absent from body" was judged disproportionate and brittle.

### Chunk 1.5 — Picker dropdown as a showcase surface

> **LoL portion SHIPPED (2026-05-30).** The topbar LoL `AccountRow` ([`nav.tsx`](../../apps/web/src/components/nav.tsx)) now ships the three agreed visual moves: avatar 28→44px (`size-11`, rank emblem kept), a faint last-played-champion splash wash from `championBackdropSplashUrl(summary.lastPlayedChampionAlias, ddVersion)` (right-anchored mask, `opacity-0.12` + `blur-2px`, overscanned + clipped, `aria-hidden`), and a per-row open-stagger via the `.nav-account-row` keyframe (`--row-index` × 40ms, reduced-motion → `animation: none` in `index.css`). Tests added to `nav.test.tsx` (splash present/absent, per-row stagger var). **Still deferred (decisions, not open questions):** (a) the **Steam single-card variant** — blocked, the Steam nav is a plain `SimpleNavItem` with no dropdown yet; trigger-flagged at the Steam nav item in `nav.tsx` and in [steam-lol-parity.md](steam-lol-parity.md) § "Deferred — trigger-gated", pick up when Steam grows a nav menu. (b) the **live "in-game now" / last-active pill** — deferred from this pass; `summary.updatedAt` is refresh-time, not last-played, so a true last-active pill needs the live-presence plumbing (`PresenceMounts`/`useLiveGame`), out of scope for a visual-only chunk. **Perf gate — CLEARED 2026-05-30.** Host-Chrome re-baseline on the real ~7-account list (worst case): Performance record over the open showed no long task >50 ms / no dropped frames, second open is all cache hits, Web Vitals all green. Full numbers in [perf-baseline.md](perf-baseline.md) § "dropdown-open re-baseline". No fix sub-chunk needed. **The LoL portion of 1.5 is fully done**; only the deferred Steam single-card variant + live pill remain.

> **RETARGETED (2026-05-30):** 1.1 dropped the section-strip picker (the topbar owns switching — see the 1.1 decision note). So this chunk's target is no longer a new section picker but the **existing topbar `AccountRow`** ([`nav.tsx`](../../apps/web/src/components/nav.tsx)), which already ships the icon + rank-emblem + `region · queue · rank` row. The "plain menu list → magazine page" delta is therefore *smaller* than originally scoped: bigger avatars, splash-tint row backgrounds, and the open-stagger, layered onto rows that already exist. Re-read the goal below against the topbar component, not a `Vyoh#Ahri ▾` section caret. The Steam single-card variant still applies to the topbar Steam menu.

**Goal:** the account-switcher dropdown becomes a discoverable showcase moment, not a plain menu list — a small magazine page of the user's identity-per-account.

**Each account row carries:**
- Avatar at a meaningful size (~40–48px, not the 16–20px of a typical menu row).
- Inline rank crest + region flag.
- Last-active timestamp or live "in-game now" pill.
- Subtle splash-backdrop tint pulled from `useSplashChampion` for that account — the row's background is a faint, low-opacity wash of the account's last-played champion splash.

**Steam variant (single account, no multi-select):** the dropdown collapses to a single rich identity card rather than a list. Same visual treatment, no per-row stagger needed.

**Entry animation:**
- Per-row stagger on dropdown open (~30–50ms between rows on LoL multi-account).
- `@starting-style` + `transition-behavior: allow-discrete` for the open transition itself, per [mount-and-overlay-motion](mount-and-overlay-motion.md) (Planned).
- Reduced-motion variant: instant open, no stagger.

**Sequencing:** lands after 1.1 (the picker exists once 1.1 ships). Can parallelize with 1.2 / 1.3a / 1.3b — they touch different surfaces.

**Files in scope (estimated):**
- Enhance the topbar LoL `AccountRow` ([`nav.tsx`](../../apps/web/src/components/nav.tsx)) into the showcase shape (bigger avatar, splash-tint background, open-stagger) — the rank-emblem/region/queue row already exists.
- Steam variant of the same row in the topbar Steam menu.
- Possibly extract a shared `AccountPickerRow` primitive in `apps/web/src/_shared/` if both streams converge on similar row shape.

**Libraries needed:**
- **Existing only.** Shadcn `DropdownMenu` (Radix) is the headless base. Motion for the stagger. `useSplashChampion` plumbing already exists per [project CLAUDE.md](../../CLAUDE.md). No new dependencies.

**Tests in scope (same commit):**
- Dropdown opens with all rows rendered; per-row content (avatar, rank crest, region, timestamp) renders correctly.
- Keyboard navigation between rows works (Radix handles most of this).
- Reduced-motion variant skips stagger.
- Axe scan on the open state.

**Perf-baseline check before promoting to shipped:** the dropdown open path now does meaningful per-row paint work (avatars, splash-tint backgrounds, animated entry). Re-baseline against [perf-baseline.md](perf-baseline.md) — specifically dropdown-open responsiveness — before this chunk lands.

### Chunk 1.2 — Hero avatar activity ring

> **RETARGETED (2026-05-30):** the original chunk wrapped a *rank-tier-colored ring* around the *seam-straddling avatar* in the merged strip, with an animated live overlay as a third signal on the same ring. **Two premises went away during 1.1 implementation.** The seam-straddle was dropped (the shipped `LolIdentity` is plain inline, no boundary-straddle), and the rank-tier color cascade lost its justification once the cinematic Profile hero on 1.3a became the primary identity surface (the strip avatar is now a small inline anchor, not the identity star — tinting it with rank doubles up against the rank crest already visible in the hero and the existing rank tiles below). The "few days of soak" evaluation gate is moot for the same reason: the question the soak was meant to answer ("does the seam avatar feel inert without character?") doesn't apply when there's no seam. The chunk retargets to a much narrower premise: **a presence-state ring around the hero avatar** (Steam + LoL), driven by data already wired.

**Goal:** give the hero avatar an at-a-glance activity signal so the identity surface reads as live (or not) without having to parse the inline presence line. Uses presence data already polled — no new infrastructure.

**Sequencing:** ship-ready now. 1.1 + 1.3a have both landed; the data sources (`summary.personaState` + `playerState.currentGame` on Steam; `useLiveGame(account)` on LoL) are already wired and consumed by adjacent surfaces. Lands before the Steam M2/M2b morph parity follow-on (see 1.3a's "Remaining gap") so the ring + morph compose in one pass.

#### Steam: 7-state presence ring on the hero avatar

[`SteamIdentityHero`](../../../apps/web/src/steam/profile/steam-identity-hero.tsx) already maps `summary.personaState` to a colored dot in the `PRESENCE` record at the top of the file. The ring extends the same mapping to the avatar's `ring-*` treatment so dot and ring read from the same source of truth (can't drift).

**Color palette — realigned to Steam's brand vocabulary** (the existing `PRESENCE` map uses emerald for both online AND in-game, conflating "logged in" with "actively playing." Steam's actual client distinguishes them. This chunk fixes both the inline dot AND the new ring in one pass):

| State | Tailwind | Steam brand reference | Treatment |
|---|---|---|---|
| `online` | `sky-400` (#38BDF8) | ~#57CBDE light cyan-blue | Solid ring |
| `in-game` (`liveGame != null`) | `emerald-400` + outer pulse | ~#90BA3C yellow-green | `ring-2` + animated outer `animate-ping` layer |
| `busy` | `rose-400` | universal red vocab | Solid ring |
| `away` / `snooze` | `amber-400` | universal yellow vocab | Solid ring |
| `looking-to-trade` / `looking-to-play` | `sky-400` (same as online) | Steam treats these as online + intent label | Solid ring (label disambiguates) |
| `offline` | — (absent) | dimmed gray dot in Steam client | No ring (absence IS the signal) |

**Design decisions resolved up-front:**

1. **Replace the existing `ring-2 ring-white/15` on the hero avatar**, don't stack. The new ring carries presence semantics; the old white/15 was decorative and would muddy the signal.
2. **Pulse vocabulary for in-game**: mirror the existing inline presence-dot pattern at [`steam-identity-hero.tsx:213-217`](../../../apps/web/src/steam/profile/steam-identity-hero.tsx#L213-L217) — solid ring + an absolutely-positioned `animate-ping` outer layer. Same pattern, scaled to avatar size.
3. **Keep the inline presence dot** (don't drop it once the ring is added). Dot + label is one parseable unit ("● Online · checked just now"); the ring is a separate identity-glance signal at a different reading scale. Not redundant — complementary.
4. **Offline = no ring**, not a muted neutral ring. Absence is the cleanest signal that nothing is active.
5. **Reduced motion**: `animate-ping` collapses to no animation per the global `MotionConfig reducedMotion="user"` (shipped 2026-05-28 per [reduced-motion-replacements.md](reduced-motion-replacements.md)); the solid inner ring stays bright so the in-game state is still distinguishable.

#### LoL: binary in-game ring on the hero avatar

[`LolIdentityHero`](../../../apps/web/src/lol/profile/identity-hero.tsx) reads `useLiveGame(account)` from [use-live-match.ts](../../../apps/web/src/lol/matches/use-live-match.ts). Binary signal: live game or not.

- **In live game**: `emerald-400` solid ring + `animate-ping` outer layer. Same vocabulary as Steam's in-game state — cross-stream consistency for "actively playing = emerald pulse."
- **Not in game**: no presence ring (existing avatar treatment from 1.3a stays).

LoL has no multi-state presence to align with Steam's 7 states — it's binary. The ring stays absent in the idle case so the cinematic hero's existing chrome (champion glow, mastery badge, Ken-Burns drift) keeps its visual budget.

**Reduced-motion variant**: pulse collapses to solid bright ring; ring stays present so the live-game state remains readable.

#### Files in scope

- [`apps/web/src/steam/profile/steam-identity-hero.tsx`](../../../apps/web/src/steam/profile/steam-identity-hero.tsx) — extend the `PRESENCE` record with a `ring` field (or rename `dot` → `accent` since both consume the same color), refactor `online` from emerald to sky in the mapping, wire the ring + pulse onto the avatar.
- [`apps/web/src/lol/profile/identity-hero.tsx`](../../../apps/web/src/lol/profile/identity-hero.tsx) — read `useLiveGame()` (may already be available via context or props on the hero — verify during implementation), wire emerald ring + pulse when live.
- [`apps/web/src/lol/profile/identity-hero.test.tsx`](../../../apps/web/src/lol/profile/identity-hero.test.tsx) — add live-game-active test case asserting ring presence; idle test case asserting ring absence.
- [`apps/web/src/steam/profile/steam-identity-hero.test.tsx`](../../../apps/web/src/steam/profile/steam-identity-hero.test.tsx) — add per-presence-state ring color assertions; verify the inline dot's color refactor (`online` → sky) didn't break existing tests.

**No shared `AvatarRing` primitive.** The two heroes have different state cardinalities (7 vs 1) and different existing chrome — abstracting prematurely would re-invent the "premature abstraction" anti-pattern called out in the project's standing guidance. If a third surface needs an activity ring later, lift then.

#### Libraries needed

**Existing only.** No new dependencies. The pulse uses Tailwind's existing `animate-ping` utility, which composes with the project's global `MotionConfig reducedMotion="user"` for the rm collapse.

#### Tests in scope (same commit)

- Steam: each `PRESENCE` state renders the correct ring color. In-game overrides the persona-state ring with emerald + pulse. Offline renders no presence ring. Axe scan stays clean.
- LoL: in-live-game renders the emerald ring + pulse; idle renders no presence ring. Axe scan stays clean.

#### Perf consideration

The pulse is a single `animate-ping` outer layer on the hero avatar — compositor-only, runs only when in-game (a rare and transient state for both streams). No always-on cost; no perf baseline re-run needed unless review shows a regression on the hero mount path.

#### Coordination

- The original 1.2 coordinated with [live-presence-chip](live-presence-chip.md) on the assumption that both surfaces would express the same SSE signal. That arc is still Planned; this chunk doesn't depend on it (uses the existing poll-based `useLiveGame` / `playerState` paths). If `live-presence-chip` ships later, the ring inherits the SSE-pushed signal for free.

### Chunk 1.3a — Profile-tab identity block (bare, ship-ready)

**Steam portion SHIPPED (2026-05-30) — landed as a cinematic Steam hero, mirroring the LoL portion's structure-then-flair call.** [`SteamIdentityHero`](../../../apps/web/src/steam/profile/steam-identity-hero.tsx) frames the avatar + persona name + identity headline (`Member since {year} · Level {n} · top {N}%`) + presence line over a live-game-or-top-played hero backdrop (slow pointer parallax + Ken-Burns drift, collapses static under reduced motion). The [`SteamStatBand`](../../../apps/web/src/steam/profile/steam-stat-band.tsx) fuses to the card bottom as a frosted-glass strip carrying four cells in a uniform 3-row rhythm: **Recently played** (wordmark logo of the most-recently-launched game distinct from cell 3 + time-ago sub-stat), **Total playtime** (lifetime + 2-week rollup sub-stat), **Most played** (wordmark logo + lifetime-hours sub-stat), **Library played** (count/owned + played/backlog bar + percentage caption). Owner-iterated end-to-end this session; design decisions worth keeping:

- **Cell rhythm**: all four cells share value/sub-stat/label structure (3 rows). Cell 4 is the deliberate bar-archetype outlier (the bar carries unique composition signal no other cell duplicates). Earlier iterations had 2-row game cells vs 3-row data cells; the rebalance pulled both game cells to 3 rows by promoting hours/time-ago out of inline captions into their own sub-stat row.
- **Recency over identity**: cell 1 was "Games owned · count" before; swapped to recently-played because the owned-count is already implicit in cell 4's `72 / 175` denominator. Pure-text recency lines (cell 1 `Nh ago`, cell 2 `+Nh past 2 weeks`) gracefully hide when the value is zero rather than rendering `0`.
- **Distinct-from-top dedup**: cell 1 prefers the most-recently-played game *other than* cell 3's most-played one, so a heavily focused player doesn't see the same wordmark twice. Falls back to the same game (with duplicate render) when no alternative exists, then to a `Stat` em-dash when nothing has ever been launched.
- **Glass softened from the LoL hero rank strip pattern**: `bg-background/20 + backdrop-blur-xs` (down from `/25 + backdrop-blur-sm`) so the band reads as a continuation of the hero card rather than a separately-rendered frosted tray. The same softening was applied to the LoL [`HeroRankStrip`](../../../apps/web/src/lol/profile/hero-rank-strip.tsx) in the same window for cross-app parity.
- **Per-appid optical-center nudge map**: [`WORDMARK_OFFSET_PX`](../../../apps/web/src/steam/profile/steam-stat-band.tsx) shifts publisher-authored asymmetric wordmarks (Nightreign's left-side decorative wisp → −4px) so the visible ink lines up with the sub-stat/label below. Preserves trim fidelity instead of fighting the design at the proxy. Add entries when the owner's top-played or recently-played slot reads visibly off-axis. (Lengthy debug session this turn established that proxy-level alpha trim works correctly; the asymmetry is genuine publisher authoring, not transparent padding.)
- **`formatTimeAgo` "just now"**: sub-minute diffs now collapse to `"just now"` (was `"0m ago"`) in [`packages/shared/src/format.ts`](../../../packages/shared/src/format.ts). Applies app-wide; the Steam presence line's `checked just now` reads natural.

The LoL [`HeroRankStrip`](../../../apps/web/src/lol/profile/hero-rank-strip.tsx) also got a polish pass in this window: `justify-center` on each `RankCell` so the emblem + text block stops hugging the left of its flex-1 half and instead sits centered in its column, plus a row-parity spacer on the Unranked branch so a one-queue-ranked profile doesn't render with the unranked column floating short. Same glass softening as Steam.

Tested incl. axe on the Steam identity hero ([steam-identity-hero.test.tsx](../../../apps/web/src/steam/profile/steam-identity-hero.test.tsx)) and the stat band ([steam-stat-band.test.tsx](../../../apps/web/src/steam/profile/steam-stat-band.test.tsx)). `formatTimeAgo` and the LoL rank strip have their existing test coverage.

**Remaining gap — Steam M2/M2b morph parity (PENDING).** The LoL portion ships with both `M2` (scroll-collapse morph: hero avatar+name → strip identity via shared Motion `layoutId` gated on `useSectionShellState().compact`) and `M2b` (nav-morph: the same identity travels on Profile↔tab clicks via the imperative `view-transition-name` driver in [identity-morph-nav.ts](../../../apps/web/src/lol/profile/identity-morph-nav.ts), wired through `SectionTab`'s `onSelect` seam). The Steam portion has neither — the Steam strip identity (currently a plain inline `<span>Vyoh</span>` or similar in [routes/steam.tsx](../../../apps/web/src/routes/steam.tsx)) does not share `layoutId` with the hero avatar+persona-name, so a Profile scroll or tab navigation reads as a hard swap rather than a continuous identity. Pick this up after the activity-ring chunk (1.2) lands so the ring + morph compose in one pass. Files in scope: shared id literals in a new `apps/web/src/steam/profile/identity-layout.ts` (mirroring the LoL pattern), wiring `SteamIdentityHero`'s avatar + persona name to the literals (drop them under `compact`), and the section strip's Steam identity slot to claim them. Tests parallel to [identity-hero.test.tsx](../../../apps/web/src/lol/profile/identity-hero.test.tsx)'s single-mount invariant.

**LoL portion SHIPPED (2026-05-30) — landed as a cinematic hero, not the bare block.** The spec below describes a "structure-first" block (big avatar + text + rank tiles). On review that read bland for the Profile *landing page*, so it shipped as a **cinematic champion-splash hero** ([identity-hero.tsx](../../../apps/web/src/lol/profile/identity-hero.tsx), `LolIdentityHero`): the signature champion's splash resolves into a sharp, framed banner (avatar + `Vyoh#Ahri` name + rank crest + `Last played {Champion} · Nh ago`), with the Solo/Flex tiles as the next section. The route ([routes/lol/$accountSlug/index.tsx](../../../apps/web/src/routes/lol/$accountSlug/index.tsx)) renders the hero + standalone `ProfileRankTiles`. Tested incl. axe ([identity-hero.test.tsx](../../../apps/web/src/lol/profile/identity-hero.test.tsx)).

Key design decisions (all owner-reviewed against live screenshots):
- **Focus-then-recede, same subject.** The page already washes in the **top-played** champion as an ambient blurred backdrop ([$accountSlug.tsx:182](../../../apps/web/src/routes/lol/$accountSlug.tsx#L182) `selectChampionOfYear`). The hero uses that **same** champion — but a new sharp, high-res `splash` image variant (1280px, no blur) vs the ambient `backdrop` (600px, `blur:1`). Same subject at two fidelities → the hero reads as the backdrop coming into focus, not a second image. `lastMatch` stays a **text** line so "what you played last" is expressed without a competing splash.
- **Two-accent split.** Champion (`dominantHex`) drives the avatar glow + page accent (nav/tabs/`--theme-*`); **tier** drives only the rank crest + rank text. This avoids the avatar fighting the page accent and reserves tier's prominent moment for the future animated-rank-crest work (1.3b).
- **Motion:** slow Ken-Burns drift (CSS, [motion.css](../../../apps/web/src/styles/motion.css) `lol-hero-drift`) + subtle pointer parallax (Motion); both collapse to a static frame under reduced motion.
- **Icon resolution:** the avatar (`profileIcon`) and champion `square` proxy variants were bumped 72→**128px** (native source ceiling) so they stay crisp at the hero's 2x render and the larger square surfaces. Splash hero asset is a dedicated 1280px `splash` variant.
- **Mastery dropped** from the sub-row (only fetched for live-game participants; no per-account endpoint — API expansion out of scope). **Live `in-game now`** not wired (same presence gap as 1.5's pill; `LiveGameChip` below covers it). **`formatTimeAgo`** consolidated into `@vyoh/shared` rather than a 7th inline `Xm/h/d ago` copy (the 6 existing copies are a separate sweep).

**M2 (scroll-collapse morph) SHIPPED 2026-05-30.** The hero's avatar + name collapse into the compact strip identity via shared Motion `layoutId` on scroll (gated to profile-index + scroll-top via `useSectionShellState().compact`), reversing on scroll-up; other tabs always show the compact strip; reduced-motion swaps instantly (no shared layout). Shared id literals live in [identity-layout.ts](../../../apps/web/src/lol/profile/identity-layout.ts) so the hero ([identity-hero.tsx](../../../apps/web/src/lol/profile/identity-hero.tsx)) and strip (`LolIdentity` in [routes/lol/$accountSlug.tsx](../../../apps/web/src/routes/lol/$accountSlug.tsx)) can't drift; exactly one element owns each id at a time (the hero drops it when compact). Single-mount invariant tested in [identity-hero.test.tsx](../../../apps/web/src/lol/profile/identity-hero.test.tsx).

**M2b (nav-morph, scope extension) SHIPPED 2026-05-30.** The same identity *travels on navigation*, not just scroll: Profile→tab lifts the hero identity up into the header strip, and any tab→Profile drops it back into the hero. Built on the repo's imperative VT idiom (match-row/champion-table/library-row), but naming **both** ends imperatively from a single `[data-identity-{avatar,name}]` marker rather than declaratively — the persistent header strip rules out a permanent name. Driver in [identity-morph-nav.ts](../../../apps/web/src/lol/profile/identity-morph-nav.ts) hand-rolls one `startViewTransition` that runs the section slide *and* the identity morph together: it names the source pre-snapshot, clears it, navigates (`viewTransition: false` to avoid nesting the router VT), then names the freshly committed destination for the NEW snapshot. Wired via an `onSelect` click seam on `SectionTab` ([section-nav.tsx](../../../apps/web/src/_shared/section-layout/section-nav.tsx)); Steam tabs omit it and keep the plain router slide. Supporting hero chrome (glow, level badge, rank line, last-played) staggers in off `compact` as the morph lands so the hero assembles as one move. Tested in [identity-morph-nav.test.tsx](../../../apps/web/src/lol/profile/identity-morph-nav.test.tsx) + [section-nav.test.tsx](../../../apps/web/src/_shared/section-layout/section-nav.test.tsx).

**Gotchas worth keeping (cost real debugging this session):**
- **Don't `await requestAnimationFrame` inside a VT update callback** — rAF callbacks don't fire while the callback's promise is pending, so it deadlocks the transition: the route commits underneath but the frozen snapshot overlay stays up and eats every click. Name the destination synchronously after `await navigate()` resolves (DOM already committed) instead.
- **Permanent `view-transition-name` on the persistent strip broke navigation entirely** (the first nav-morph attempt). It attaches on every slide and nests/collides with the router VT. Imperative name-and-clear, opting the nav out of router VT, is the working pattern.
- **The reveal must be driven off `compact`, not mount** — a mount-only entrance doesn't replay on scroll-up from the collapsed strip (the chrome pops back in un-animated).

**Perf — VALIDATED 2026-05-30 (host Chrome, dev WEB-VITALS overlay).** The static hero carries no gate (one image + a CSS drift). Clicking through the LoL tabs (the nav-morph path), the dev overlay read **INP 8ms** (LCP 1479ms, CLS 0, FCP 342ms, TTFB 147ms) — the morph runs VT snapshot + Motion layout + the staggered reveal without blocking the main thread. Source is the in-app `?perf` overlay, not a Lighthouse/Profiler run, but INP 8ms is ~25× under the 200ms "good" threshold so the margin is decisive. Recorded in [perf-baseline.md](perf-baseline.md).

**Goal:** the Profile tab opens with a content-level identity block as page content, not chrome. Always shippable — no dependencies on other arcs.

**LoL Profile-tab identity block (bare):**
- Big-fidelity avatar (~80–112px) with the LoL summoner-icon frame/border rendered at full size (rank borders, prestige borders, event borders — whatever the platform supplies).
- Identity headline: `Vyoh#Ahri · Emerald I · 17 LP`.
- Inline mastery / last-active row: `813 mastery on Ahri · last played 2h ago` (or live `in-game now` when applicable).
- Existing Solo / Flex rank cards become the *second* section of this block instead of standing alone.

**Steam Profile-tab identity block (bare):**
- Big-fidelity avatar with brand-tinted ring (inherits 1.2's ring system, scaled larger).
- Identity headline: `Joined 2014 · 11 years on Steam` or `167 games · 1,420h lifetime`. **Currently-playing supersedes both when live:** `Currently playing Resident Evil 4 · 0h 42m`.
- Activity pill: `Playing now: …` / `Last played: … · 2h ago` / `Idle`.
- Catalogue stat strip: games owned · lifetime hours · perfect games count (skip perfect-games if achievement integration doesn't cover it yet).
- Most-played showcase: top 3–5 all-time games as a small horizontal strip, each linking into that game's detail page.
- Optional country flag / real name if those fields are public (low-prominence decoration).

**Important:** 1.3a owns the **identity-block-at-top only**. The Steam Profile page's deeper characterisation work — the 13 Portrait + Anti-Portrait trait cards and the backlog recommendations bridge — lives in [player-portrait.md](../steam/player-portrait.md) (Active, no code yet, chunk 0 pending). 1.3a's identity block sits *above* those cards; the Portrait arc fills out the rest of the page.

**Honest framing:** without the visual-flair layer (chunk 1.3b), this is a big avatar + structured text + existing rank cards. That's already an improvement over today's chip-grid opening, but it will feel restrained until 1.3b lands. Ship 1.3a knowing this — it's a deliberate "structure first, polish second" call. Don't try to substitute pseudo-flair to compensate.

**Data check before designing the Steam headline finally:**
- Does `apps/api` Steam ingestion pull `timecreated` (member-since) and the live `gameid` field from `GetPlayerSummaries`? If both stored, the headline + activity pill render trivially. If not, scope a small ingest expansion before this chunk.

**Files in scope (estimated):**
- `apps/web/src/routes/lol/$accountSlug/profile.tsx` (or its index variant) — add the identity block above existing rank cards.
- Steam Profile route — add the identity block above today's chip grid.
- New `apps/web/src/lol/profile/identity-block.tsx` and `apps/web/src/steam/profile/identity-block.tsx`.
- Possible small `apps/api` extension for Steam `timecreated` / live `gameid` if not already ingested.

**Libraries needed:**
- **Existing only.** Shadcn primitives for any sub-components. No new dependencies.

**Tests in scope (same commit):**
- IdentityBlock component (LoL + Steam variants): renders correctly with each presence state (in-game, recent, idle), rank crest renders, mastery row renders, axe scan.
- Steam variant test: headline switches between member-since / lifetime-hours / currently-playing based on presence signal.

### Chunk 1.3b — Profile-tab visual flair (dependency-gated)

**Goal:** layer the cinematic moves onto 1.3a's identity block. **Do not start this chunk until its dependencies ship.**

- **Parallax on the avatar frame on hover** — pulls from [pointer-parallax-splash](pointer-parallax-splash.md) (Planned). Wait for that arc.
- **Display-type headline with variable-font weight + optical-size axis** — pulls from [editorial-typography](editorial-typography.md) (Planned). Wait for that arc.
- **Animated rank crest** — cinematic reveal on first render, subtle ambient drift after. Likely uses Motion + the existing splash backdrop machinery; doesn't depend on a separate arc but should sequence after 1.3a so the structure is locked in.
- **Splash transition into the rank cards** — a layered crossfade or reveal as the user's eye moves from identity → rank cards. Composes with [accent-color-system](accent-color-system.md) (shipped) `--theme-*` cascade.

**Gating decision:** 1.3b ships when **at least one** of pointer-parallax-splash or editorial-typography has shipped. Without either, the flair has nothing to layer onto and 1.3b becomes "build the dependency arcs inside the wrong chunk." If both arcs are still Planned by the time the rest of this arc lands, accept 1.3a's restraint as the resting state until the dependencies arrive.

**Files in scope (estimated):**
- Updates to `apps/web/src/lol/profile/identity-block.tsx` and `apps/web/src/steam/profile/identity-block.tsx` from 1.3a.
- Possibly new motion CSS in `apps/web/src/styles/motion.css` per [elevation-arcs.md § Where new motion CSS lives](elevation-arcs.md).

**Libraries needed:**
- Motion (existing) for the rank-crest animation. Whatever the dependency arcs bring for parallax and editorial type. No net-new dependencies expected.

**Tests in scope (same commit):**
- Reduced-motion variant for each flair element (replace, don't disable).
- Visual regression sanity for the rank-crest animation (snapshot or screenshot diff if tooling exists; otherwise manual check).

---

## Timing relative to other arcs

- **1.1 lands before the TanStack Start migration.** Owner decision (2026-05-27): the Start migration waits until the final v1 shape of the app is known. 1.1 ships in the current feature window; the migration adapts to it later.
- **[detail-panel-arc](detail-panel-arc.md) lands after 1.1.** The panel arc inherits 1.1's Model 3 master→detail pattern (detail sub-tabs + `‹ Matches` breadcrumb in the always-on section strip; no inline tab bar). Doing 1.1 first is the cleaner sequence.
- **[cross-section-nav-arc](cross-section-nav-arc.md) lands after 1.1.** That arc only makes sense once the merged strip exists. Sequence at owner's discretion based on whether the cross-section moment feels under-designed in practice once 1.1 is live.
- **[landing-showcase-arc](landing-showcase-arc.md) is independent of this arc.** Different surface, different concerns. Sequence by cadence and excitement.

## TanStack Start migration interaction

Per [tanstack-start-migration.md](tanstack-start-migration.md): the Start migration is committed direction (Status: Active, 2026-05-26) but priority-slotted **after** MR3/MR4 + PN1–PN4 + TFT shape ship. This arc is **migration-neutral**:

- **1.1 reshapes the layout tree inside `__root.tsx`** (and section route files). Start chunk 2 reshapes `__root.tsx`'s *document boundary* (gives it `<html>`/`<head>`/`<body>` ownership via `RootDocument`). Same file, different concerns. The two reshapes compose cleanly — 1.1's nav components sit inside whatever document structure `__root.tsx` ends up with.
- **1.2 is pure component/CSS work.** Zero Start interaction.
- **1.3's content blocks use standard `useQuery` patterns.** Start chunk 4 will server-prime those queries via loaders later (mechanical translation: `useQuery(opts)` → `loader: ({ context }) => context.queryClient.ensureQueryData(opts)` + same `useQuery(opts)` in component). 1.3 just needs to avoid unusual suspense boundary patterns — standard `useQuery` is fine and inherits the loader prime for free.

**Net:** ship this arc in the current feature window; no rework expected when Start migrates.

---

## Hard guardrails

Inherited from [elevation-arcs.md](elevation-arcs.md) and [motion-backlog.md](motion-backlog.md):

- Bold is allowed, loud is not. The seam-straddling avatar is intentionally a strong visual hinge; the live ring is intentionally a presence signal — neither should ever become "loud."
- `prefers-reduced-motion`: replace, don't disable. The live ring's pulsing overlay needs a reduced-motion variant (e.g. solid bright ring with no pulse).
- Compositor-only animations (transform / opacity on the ring overlay).
- Tests in the same commit as code per [repo-conventions.md § Testing](../../repo-conventions.md).

---

## Open decisions

(Width budget and mobile sketch were previously listed here; both promoted into the pre-1.1 sizing pass above.)

1. **Seam-straddle behaviour with the ⌘K palette open.** The palette dialog overlays the page; the seam avatar should not poke through. Verify z-index stacking when palette is open. Trivial fix if it does.
2. **Steam Profile data dependencies.** Confirm `timecreated` and live `gameid` are ingested before scoping 1.3a in detail. If not, add a tiny ingest-expansion sub-chunk to 1.3a.
3. **Coordination with [live-presence-chip](live-presence-chip.md).** That arc adds a nav-level "currently playing X" chip; 1.2 expresses the same signal at avatar-ring level. The 1.2 prototype gate may resolve this — if the live overlay gets dropped from the ring, this coordination question disappears.
4. **Avatar size in the seam.** Tuned during 1.1 implementation. Current avatar is ~40px in the identity strip; seam variant likely ~44–48px to read at the boundary. Test against real viewports.
5. **Portfolio-surface visibility of the showcase — resolved by a sibling arc.** This concern (the showcase lives behind a Profile-tab click most reviewers won't make) is the central premise of [landing-showcase-arc](landing-showcase-arc.md). That arc takes on first-impression work for the `/` synthesis surface; 1.3a/b can comfortably stay dedicated-visitor surfaces. No action needed inside this arc.

---

## Cross-references

- [elevation-arcs.md](elevation-arcs.md) — promote this arc to the index when chunk 1.1 starts.
- [player-portrait.md](../steam/player-portrait.md) — 1.3 sits above the Portrait/Anti-Portrait cards on Steam Profile; same identity-block-then-deeper-content shape applies to LoL Profile (rank cards stay below the new identity block).
- [tanstack-start-migration.md](tanstack-start-migration.md) — confirmed migration-neutral.
- [accent-color-system.md](accent-color-system.md) — 1.2's tier-tinted ring uses the `--theme-*` namespace.
- [live-presence-chip.md](live-presence-chip.md) — adjacent expression of the same presence signal; share SSE subscription.
- [editorial-typography.md](editorial-typography.md) — 1.3's headline display type pulls from this arc.
- [pointer-parallax-splash.md](pointer-parallax-splash.md) — 1.3's hover-parallax on the avatar frame builds on this arc.
- [self-portrait-surfaces.md](self-portrait-surfaces.md) — the showcase block on Profile tabs is portfolio output.
- [detail-panel-arc.md](detail-panel-arc.md) — sibling arc; depends on 1.1's Model 3 master→detail strip pattern (detail sub-tabs + breadcrumb in the always-on strip).
- [cross-section-nav-arc.md](cross-section-nav-arc.md) — sibling arc that takes on the LoL ↔ Steam transition once the merged strip exists.
- [landing-showcase-arc.md](landing-showcase-arc.md) — sibling arc that takes on first-impression work for `/`; resolves this arc's "showcase visibility" open decision.
