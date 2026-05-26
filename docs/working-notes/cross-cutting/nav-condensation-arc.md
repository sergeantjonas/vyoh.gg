# Nav condensation arc

**Status:** Planned — design draft from 2026-05-27 brainstorm. No code yet.

Condense top-of-page chrome from three layers (primary nav + identity header + secondary tabs) to two, restore section context inside detail pages, and elevate the avatar — currently a small static circle — into a piece of visible identity character. Multi-chunk arc; 1.1 lands first and unblocks 1.2 and 1.3.

Sister notes: [elevation-arcs.md](elevation-arcs.md) (this arc is added there at promotion time), [player-portrait.md](../steam/player-portrait.md) (1.3 sits *above* the Portrait/Anti-Portrait cards on Steam; same identity-block-then-deeper-content shape).

---

## Premise

The current chrome on `/lol/$accountSlug/*` and `/steam/*` stacks three sticky-ish layers — primary nav, identity header (avatar + name + account switcher), secondary tabs (Profile/Matches/Trends/Champions or Profile/Library/Wishlist/Achievements). On long pages, that's ~140px of always-visible chrome before the content begins. The identity header reads as a separate strip with a separate job, but it's actually serving the *same* purpose as the secondary tab strip — orienting you inside a section.

The fix is to merge identity + tabs into one strip, drop one item from the primary nav that the logo already handles ("Home"), and treat the showcase moment (big avatar, frame, rank, stats) as **page content** on the Profile tab rather than as section chrome that every tab pays for.

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

## Chunks

Each chunk independently committable.

**Suggested order:** 1.1 first, then 1.3a, then 1.5 (picker showcase) and 1.3b (visual flair, dependency-gated) in either order, then 1.2 (avatar rings) with an evidence-based evaluation trigger (see below). 1.2 lands last *not* because it's deprioritised but because the question it answers ("does the merged-strip avatar feel visually inert without ring treatment?") is only honestly answerable once 1.1 has been in front of real eyes for a while. 1.5 can parallelize with 1.3 work — different surfaces, independent risk profiles.

### Chunk 1.1 — Core navigation rework

**Goal:** condense chrome from three layers to two; restore section context inside detail pages.

- **Primary nav:** drop the "Home" link. The logo already routes to `/` and is the conventional home affordance. Result: `logo · LoL · Steam · Status · ⌘K`. Frees ~80px.
- **Merged sticky strip** replaces today's identity header + secondary tabs in a single bar.
  - LoL: `[avatar] Vyoh#Ahri ▾   Profile · Matches · Trends · Champions   [⟳] [≡]`
  - Steam: `[avatar] Vyoh   Profile · Library · Wishlist · Achievements   [≡]`
- **Identity is the picker.** Caret renders on the full `Vyoh#Ahri ▾`, not on the tag chip alone — clicking the full identity opens the account switcher. The right-side dropdown ("Vyoh #Ahri ▾") is removed; the picker lives on the left as the identity.
- **Region badge moves into the picker dropdown.** Each account row in the dropdown carries its region (`Vyoh #Ahri · EUW`, `OtherSmurf #NA1 · NA`). The always-visible strip stops showing the region — it's per-account metadata, not identity.
- **Right cluster is route-aware:** `[refresh?] [filters?]`, both conditional per route. No persistent picker on the right.
- **Logo-as-home usability check.** Dropping the explicit "Home" link assumes the logo is discoverable as the home affordance. Universal-ish convention, but not zero-cost for first-time visitors. Verify with a fresh visitor before this chunk lands — a single round of "do you know how to get back to the start?" with someone who hasn't seen the app is enough.
- **Active-tab indicator with shared-layout morph.** The underline/pill that marks the active tab uses Motion `layoutId` to morph smoothly between tabs as the user navigates, instead of snapping. The project already has the `layoutId pills` pattern per [elevation-arcs.md](elevation-arcs.md) — this extends the existing primitive rather than introducing a new one. Folded into 1.1 because it lives inside the same merged-strip component being built here; not worth splitting into a separate chunk. Reduced-motion variant: indicator snaps to position (no morph) per [reduced-motion-replacements](reduced-motion-replacements.md) guardrail.
- **Account-switcher landing behaviour — decide during implementation.** When the user picks a different account from the `Vyoh#Ahri ▾` dropdown, where do they land? Today: same sub-route on the new account. Open question: should they land on Profile (greeting them with the identity block from 1.3a) instead? Resolve while building 1.1; default to same-sub-route unless the showcase landing reads obviously better in practice.
- **Avatar sits at the seam** between the primary nav and the merged strip — half above, half below the divider. Square crop preserved (avatars are platform identity per [feedback memory](~/.claude/projects/-workspaces-vyoh-gg/memory/feedback_avatars_are_identity.md)). Implementation is `margin-top` + `z-index`, no scroll state machine.
- **Both bars stay sticky.**
- **Detail pages restore the section nav.** Today match-detail hides Profile/Matches/Trends/Champions and shows only a breadcrumb. Restore the section nav (with Matches highlighted), and demote the detail's own tab nav (Recap / Your game / Timeline) from a sticky chrome strip to an **inline tab bar at the top of the detail page content**. Breadcrumb becomes inline content too (e.g. `← Matches · Match · 2026-05-25 vs Aatrox`).

**Files in scope (estimated):**
- [`apps/web/src/components/nav.tsx`](../../apps/web/src/components/nav.tsx) — remove Home link.
- [`apps/web/src/routes/lol/$accountSlug.tsx`](../../apps/web/src/routes/lol/$accountSlug.tsx) — merge identity strip + secondary tabs into one component.
- [`apps/web/src/routes/steam.tsx`](../../apps/web/src/routes/steam.tsx) — same merge for Steam.
- LoL account-picker dropdown component — add per-row region display, remove from chrome.
- Match-detail route files — restore section nav, demote detail-tab chrome to inline.
- New shared component for the merged strip (likely `apps/web/src/_shared/section-strip.tsx` or similar) — both LoL and Steam consume it.

**Libraries needed:**
- **Existing only.** Shadcn `DropdownMenu` (Radix-based, already in project at 103 import sites per [library-shortlist.md](library-shortlist.md)) for the account picker. `TooltipPrimitive` for icon tooltips per [repo-conventions.md](../../repo-conventions.md). Shadcn `Tabs` for the inline detail-page tab nav.
- No new dependencies.

**Tests in scope (same commit):**
- Merged-strip component: keyboard navigation between tabs, ARIA tab roles, account-picker open/close, region rendering in dropdown rows. Axe scan.
- Detail-page section-nav-restored test: confirm Profile/Matches/Trends/Champions render inside match-detail with Matches highlighted.
- Detail-page inline-tabs test: confirm Recap/Your game/Timeline render as inline tabs, not as a sticky strip.

### Chunk 1.5 — Picker dropdown as a showcase surface

**Goal:** the account-switcher dropdown becomes a discoverable showcase moment, not a plain menu list. The click on `Vyoh#Ahri ▾` (established in 1.1) opens what reads as a small magazine page of the user's identity-per-account.

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
- Refactor the existing LoL account-switcher component (currently a basic dropdown) into the showcase shape.
- New small Steam variant of the same component.
- Possibly extract a shared `AccountPickerRow` primitive in `apps/web/src/_shared/` if both streams converge on similar row shape.

**Libraries needed:**
- **Existing only.** Shadcn `DropdownMenu` (Radix) is the headless base. Motion for the stagger. `useSplashChampion` plumbing already exists per [project CLAUDE.md](../../CLAUDE.md). No new dependencies.

**Tests in scope (same commit):**
- Dropdown opens with all rows rendered; per-row content (avatar, rank crest, region, timestamp) renders correctly.
- Keyboard navigation between rows works (Radix handles most of this).
- Reduced-motion variant skips stagger.
- Axe scan on the open state.

**Perf-baseline check before promoting to shipped:** the dropdown open path now does meaningful per-row paint work (avatars, splash-tint backgrounds, animated entry). Re-baseline against [perf-baseline.md](perf-baseline.md) — specifically dropdown-open responsiveness — before this chunk lands.

### Chunk 1.2 — Avatar rings (live status + rank tint)

**Goal:** make the small sticky-strip avatar carry visible identity character without growing.

**Sequencing — lands after 1.1 and 1.3a, with an evidence-based evaluation trigger.** This chunk answers the question "does the merged-strip avatar feel visually inert without ring treatment?" That question is only honestly answerable *after* the merged strip is in front of real eyes — pre-judging it from a sketch would be guessing.

**Evaluation trigger before this chunk commits:**

1. 1.1 and 1.3a have been merged and used for at least a few days of real navigation.
2. Re-look at the merged strip. Does the avatar at the seam feel like a meaningful identity anchor, or does it read as a small static circle that wants something more?
3. If it wants something more → run the prototype sketch below and ship the chunk.
4. If it already pulls its weight → re-evaluate the chunk's design. The ring system may still be worth shipping for portfolio reasons (per [feedback memory](~/.claude/projects/-workspaces-vyoh-gg/memory/feedback_visual_showcase_is_purpose.md) — visual showcase is purpose, not decoration), but the design might shift (e.g. drop the live overlay if [live-presence-chip](live-presence-chip.md) has shipped and is carrying that signal at nav-level).

**Prototype sketch (when the trigger fires):** Three signals on one ring at 32–48px scale (base tier colour + base brand tint + animated live overlay) is elegant on paper but might read as noise in practice. Sketch all three live states × both base colours side-by-side at the real seam scale before writing component code. Decision points after the sketch:

- If all three signals read cleanly: ship the full design as written below.
- If three signals are too much: drop the live overlay from the ring; keep tier/brand tint only.
- If the rank-tier tint feels too "loud" against the seam-straddle silhouette: invert — solid neutral ring as base, tier colour as a small accent corner.

The sketch step is the chunk's first commit, not deferred work.

- Thin ring around the avatar in the merged strip.
  - **LoL base colour** = current rank tier (emerald gradient for Emerald, gold for Gold, etc.). Uses `--theme-*` namespace from [accent-color-system](accent-color-system.md) (shipped 2026-05-26) where possible.
  - **Steam base colour** = constant Steam-brand tint (Steam blue gradient) for the first ship. Hours-bracket tint or dominant-most-played-game tint are later refinements; not in this chunk.
- **Animated overlay state** for live presence:
  - Pulsing accent ring = in-game right now / actively playing.
  - Solid muted ring = recently active (e.g. last hour, threshold tunable).
  - No ring overlay = idle.
- **One DOM element doing two jobs.** Base tier/brand tint = the ring's solid colour; live state = an animated overlay pseudo-element. Compositor-only (transform/opacity), no engine-gate needed.
- **Cross-stream consistency:** identical overlay vocabulary for LoL and Steam — only the base colour differs.

**Files in scope (estimated):**
- New `apps/web/src/_shared/avatar-ring.tsx` component.
- Wire-up in the merged strip (chunk 1.1's output) — replace the bare avatar with the ringed variant.
- Live-state signal: LoL already has `LiveGamePollerService` (per [library-shortlist.md § Live-match tracker](library-shortlist.md)) emitting SSE; Steam needs the equivalent — likely pulls from the existing `GetPlayerSummaries.gameid` field. If Steam live-state isn't ingested yet, drop a chunk-prerequisite.

**Libraries needed:**
- **Existing only.** CSS keyframes + `@property` declarations live in `apps/web/src/styles/motion.css` per [elevation-arcs.md § Where new motion CSS lives](elevation-arcs.md). No new dependencies.
- Coordinate with [live-presence-chip](live-presence-chip.md) — that arc covers the "currently playing X" chip in nav; this chunk covers the same data being expressed at the avatar level. Likely share the SSE subscription.

**Tests in scope (same commit):**
- AvatarRing component: renders ring with correct tier/brand colour, overlay state matches presence signal, no overlay when idle. Axe scan.
- Snapshot or visual test for the three overlay states.

**Perf-baseline check before promoting to shipped:** the ring animation adds compositor work on every page that mounts the merged strip (effectively every page). Re-baseline LCP / INP / scroll-jank against [perf-baseline.md](perf-baseline.md) before this chunk lands. If any metric regresses, prototype's design needs revisiting (likely drop the live overlay first).

### Chunk 1.3a — Profile-tab identity block (bare, ship-ready)

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
- **[detail-panel-arc](detail-panel-arc.md) lands after 1.1.** The panel arc inherits 1.1's inline-detail-tabs pattern and the restored section nav. Doing 1.1 first is the cleaner sequence.
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
- [detail-panel-arc.md](detail-panel-arc.md) — sibling arc; depends on 1.1's inline-detail-tabs pattern.
- [cross-section-nav-arc.md](cross-section-nav-arc.md) — sibling arc that takes on the LoL ↔ Steam transition once the merged strip exists.
- [landing-showcase-arc.md](landing-showcase-arc.md) — sibling arc that takes on first-impression work for `/`; resolves this arc's "showcase visibility" open decision.
