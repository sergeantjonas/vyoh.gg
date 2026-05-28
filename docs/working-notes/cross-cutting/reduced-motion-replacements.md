# Reduced-motion replacements — audit + standard

**Status:** Active — Chunks 1–3 landed (2026-05-28). Part of [elevation-arcs.md](elevation-arcs.md) Tier 2. A single pass to audit every animated surface in the app against the **"replace, don't disable"** principle from [03-motion.md §6.5](~/.claude/knowledge/frontend-2026/03-motion.md), and to standardise the replacement variants in one place so future motion arcs inherit the pattern.

Read this **after** any new motion-bearing arc lands and as a standing checklist before merging anything motion-touching. Also acts as the reference for the reduced-motion sections inside every other arc note in this directory.

KB anchors: [03-motion.md §6.5 prefers-reduced-motion: replace, don't disable](~/.claude/knowledge/frontend-2026/03-motion.md), [09-accessibility.md](~/.claude/knowledge/frontend-2026/09-accessibility.md).

---

## Why

The principle (per `~/.claude/CLAUDE.md` global rules and the KB):

> `prefers-reduced-motion: reduce` means "I don't want vestibular triggers." It does NOT mean "I don't want feedback that something changed." Replacing animation with a static alternative that preserves the information is the correct response; outright disabling and producing a UI that snaps without any cue is wrong.

The project already respects reduced-motion in many places (orb mark, empty state, splash drift, card tilt, card-breathe per audit). But the *replacements* are mostly "no animation, item just appears" — which lands fine for the items themselves but drifts toward "snap UI" if applied uniformly across every motion arc in this directory.

This note collects the **standard replacement** for each category of motion the app uses, so:
1. New motion code inherits the right replacement automatically.
2. Audits become checklists.
3. The case-study writeup has a one-page artifact to point at.

---

## Detection

Two paths:

### CSS

```css
@media (prefers-reduced-motion: reduce) {
  /* per-surface overrides */
}
```

### JS

```ts
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
// or, reactive:
import { useReducedMotion } from "motion/react"; // already imported in many surfaces
const reduced = useReducedMotion();
```

Convention: CSS-controllable animations should branch in CSS (cheaper, no React re-render). JS-driven motion (Motion variants, View Transitions trigger, audio cues) branches via `useReducedMotion()`.

---

## Category-by-category standard

### 1. Page / route transitions

**Animated**: cross-fade + slide between routes (existing `pageSlideVariants`).
**Reduced**: cross-fade only (`dir = 0` path). Already implemented in [motion-backlog.md](motion-backlog.md) §"Directional tab transitions" via `effectiveDir = prefersReducedMotion ? 0 : slideDir`.

**Status**: ✅ existing implementation correct.

### 2. View Transitions API morphs

**Animated**: snapshot-driven morph between route states.
**Reduced**: `animation: none` on `::view-transition-group(*)` etc. The snapshot still freezes/swaps, but instantly. Per [view-transitions-rollout.md](view-transitions-rollout.md) Chunk 1.

**Status**: planned via VT arc.

### 3. Mount stagger (tile/list cascades)

**Animated**: 50ms-step opacity + translateY entry per item.
**Reduced**: `animation: none`. Items appear simultaneously. Per [mount-and-overlay-motion.md](mount-and-overlay-motion.md).

**Note**: this is "replace" in form only — the cascade carried no semantic content; only delight. Acceptable per the principle. Document explicitly.

### 4. Overlay entry (Select/Popover/Dropdown via `@starting-style`)

**Animated**: opacity + scale entry/exit.
**Reduced**: `transition: none; transform: none`. Overlays still appear/disappear, instantly. Per [mount-and-overlay-motion.md](mount-and-overlay-motion.md).

### 5. Scroll-driven shell behaviors

**Animated**: nav compaction over 120px, splash opacity decay, section progress bar, per-element view() entries.
**Reduced**: replace with **midpoint static values** per [scroll-driven-shell.md](../archive/scroll-driven-shell.md):
- Nav stays at compacted state always.
- Splash opacity sits at 0.18 (midpoint between decay endpoints).
- Section progress bar stays at 100% width with reduced opacity (becomes a static accent underline).
- view() entries become `opacity: 1; transform: none` (just don't animate in).

This is genuine "replace": each surface keeps the *information* the animation carried (nav was going to be compact when reading; the static compacted state IS that information).

### 6. Splash backdrop drift (Ken Burns)

**Animated**: 18s infinite-loop scale + xy offsets.
**Reduced**: a single static crop at the "center" frame of the drift. Per existing splash-backdrop code; verify.

### 7. Card tilt (mouse-driven 3D)

**Animated**: spring rotateX/Y on pointer move.
**Reduced**: flat scale-up on hover (`scale(1.02)`). Information (hover affordance) preserved.

**Status**: existing implementation in [card-tilt.tsx](../../../apps/web/src/lol/_shared/ui/card-tilt.tsx) — verify it does this; if it just disables tilt without any hover affordance, fix.

### 8. CountUp number animation

**Animated**: number rolls from 0 to target over duration.
**Reduced**: final value rendered immediately. Information (the number) is preserved fully; only the roll is dropped. Acceptable.

**Status**: verify `count-up.tsx` honors `useReducedMotion` at runtime (separate from the `SHOULD_ANIMATE` test bypass).

### 9. Orb mark (home page glyph)

**Animated**: composite 6 orbits + 3 wisps + pulse + halo.
**Reduced**: **static constellation** — same elements rendered at their initial positions, no animation. Better than "show only the core" because the orbital design is the visual; just freeze it. Per existing code; verify.

### 10. Card breathe (subtle scale pulse)

**Animated**: `1 → 1.03 → 1` scale loop.
**Reduced**: no animation. Acceptable — breathe carried no information, only ambient life.

### 11. Sheen on Steam library tiles

**Animated**: registered `--sheen-extent` animates 25% → 42% on hover.
**Reduced**: gradient stays at midpoint (33%); no transition. The sheen is still visible but doesn't sweep.

### 12. Recharts entry animations

**Animated**: lines/bars/areas grow from baseline.
**Reduced**: render at final state. Recharts honors a prop (`isAnimationActive`); branch on `useReducedMotion()`.

### 13. Personal record flare ([personal-record-moments.md](personal-record-moments.md))

**Animated**: conic-gradient sweep + fade out.
**Reduced**: static color glow that fades in (400ms) and out (400ms after 1.5s hold). One-time fade is mild enough to be acceptable; replaces the rotation with the static glow. Information (a record happened) preserved.

### 14. Ambient home hero ([ambient-home-hero.md](ambient-home-hero.md))

**Animated**: drifting gradient mesh on canvas.
**Reduced**: render a single static frame at the current time-of-day; no rAF loop. Time-of-day information preserved; activity-reactivity dropped.

### 15. Live presence chip pulse ([live-presence-chip.md](live-presence-chip.md))

**Animated**: dot scales + opacity fades infinitely.
**Reduced**: static solid dot at the state color. State information preserved.
**Animated text crossfade on update**: snap text change (not removal — the change itself communicates state).

### 16. Audio cues ([optional-ui-audio.md](optional-ui-audio.md))

**Animated**: not motion; orthogonal to reduced-motion.
**Reduced + audio enabled**: consider slightly boosting audio volume on events that previously had a visual flourish, since the user has explicitly opted into audio AND opted out of motion.

---

## The standard CSS file structure

**Colocate the reduced-motion override with its keyframe / animation declaration, not in a single bottom-of-file block.** The Chunk 1 draft suggested consolidating every override into one block in `motion.css`; Chunk 4 (2026-05-28) reversed that — the codebase already writes motion in colocated triplets (`@keyframes` → `.class { animation: … }` → `@media (prefers-reduced-motion: reduce) { .class { animation: none; … } }`) at the call site, and the Chunk 3 audit table shows the resulting per-keyframe blocks span three CSS files cleanly. Three reasons:

1. **Diff locality.** Changing a keyframe and its rm override in the same commit means both land in the same hunk. A bottom-of-file block forces every motion edit to touch two regions of `motion.css`.
2. **Review locality.** A reviewer looking at a new `@keyframes` immediately sees whether the matching rm block exists three lines down; a consolidated block requires cross-file jumping to verify coverage.
3. **No global ordering tax.** A consolidated block is a single specificity baseline; per-surface needs (e.g. sheen's `!important` to win over `transition-[--sheen-extent,opacity]` from inline Tailwind) live with the surface that needs them, not in a shared block that has to escalate for the noisiest consumer.

What this means at the JS layer is unchanged: the global `MotionConfig reducedMotion="user"` in [main.tsx](../../../apps/web/src/main.tsx) is the *single* JS switch, and surface-level `useReducedMotion()` calls layer finer-grained replacements on top. The "one place" principle applies to JS contract, not CSS placement.

The Chunk 3 audit table above is the authoritative inventory — if a new keyframe lands without an entry there, it's missing an rm block.

---

## Chunked plan

### Chunk 1 — Audit existing motion surfaces

- Sweep `apps/web/src/` for `motion` / `m.div` / `useReducedMotion` / `@keyframes` / `animation:` / `transition:`.
- For each surface, document its current reduced-motion handling against the table above.
- Output: a checklist of "compliant", "non-compliant (currently disables, should replace)", "missing (no reduced-motion handling)".
- File the checklist as a comment in this note (or as a follow-up `reduced-motion-audit-{date}.md` artifact).

### Chunk 2 — Fix non-compliant surfaces

- Per the audit, fix surfaces that disable instead of replace.
- Most likely candidates: card tilt (verify hover affordance preserved), Recharts entry (verify `isAnimationActive` branch).

### Chunk 3 — Backfill missing reduced-motion on existing surfaces

- Per the audit, add reduced-motion blocks to any motion surface that has none.

### Chunk 4 — Consolidate into `motion.css`

- Once [scroll-driven-shell.md](../archive/scroll-driven-shell.md) Chunk 1 lands `motion.css`, migrate scattered `@media (prefers-reduced-motion)` blocks into the single consolidated block at the bottom.
- Leaves per-component CSS narrower and the reduced-motion contract reviewable in one place.

### Chunk 5 — Test pass

- Add tests for the reduced-motion branches that aren't already covered.
- Pattern: mock `window.matchMedia` to return `{ matches: true }`; assert the component renders the replacement state.

### Chunk 6 — Documentation artifact

- Once chunks 1–5 land, this note becomes the standing reference. Add a one-line link to it from `~/.claude/CLAUDE.md` global rules under the reduced-motion principle, so future elevation arcs reach for it.

---

## Files in scope

Modified:
- Most motion-bearing components (audit-driven; potentially ~15–20 files)
- `apps/web/src/styles/motion.css` (consolidation)

New:
- Test additions across affected components

---

## Risks / open questions

- **Audit drift.** The audit is a point-in-time artifact. The standing rule is what keeps the project compliant — make sure new motion arcs include their reduced-motion section in the arc note (every existing arc note in this directory already does).
- **User-agent-stylesheet reduced-motion.** Some browsers/OSes default reduced-motion ON in certain accessibility profiles. Test the app under that condition — does it still feel intentional, or just "missing animation"?
- **`prefers-contrast: more`.** Orthogonal preference; separately worth a pass for accent-color contrast adjustments (covered in [accent-color-system.md](accent-color-system.md)).

---

## Reduced motion

This is the reduced-motion note. The reduced-motion of this arc is itself — nothing changes for users with reduced-motion enabled when the audit ships, because the audit doesn't add motion.

---

## Chunk 1 audit — 2026-05-28

Sweep of `apps/web/src/` against the standard. Tooling: `ugrep` for motion/react import sites, `useReducedMotion` consumers, `prefers-reduced-motion` CSS blocks, and `startViewTransition`/keyframes inventories.

### Single highest-leverage finding

**No `<MotionConfig reducedMotion="user">` is mounted at the prod root.** `MotionConfig` only appears in test files (`orb-mark.test.tsx`, `platform-mix-chip.test.tsx`, …) wrapping subjects with `reducedMotion="always"`. Prod tree has none.

Motion's `useReducedMotion()` reads the OS preference but does not gate any animation by default — each surface must branch on the hook explicitly. The 30 `motion/react` consumers below that don't call the hook will keep animating under reduced-motion. Mounting `<MotionConfig reducedMotion="user">` once at the root (`main.tsx`, around the existing `<LazyMotion features={domMax}>`) is the single change that retrofits all of them.

Per Motion's contract, `reducedMotion="user"` disables transform and layout animations while leaving opacity/color animations intact — which is the **"replace, don't disable" principle in one switch**: list-stagger and layoutId spring transit get dropped (items appear simultaneously, indicators snap to new position) while body-hold opacity gates and crossfades keep working. Chunk 2 starts here.

### Per-category standard ⇄ implementation map

| §  | Surface                     | Implementation site                                         | Status        | Notes |
|---:|-----------------------------|-------------------------------------------------------------|---------------|-------|
| 1  | Page / route slide          | [view-transitions.css:209-218](../../../apps/web/src/styles/view-transitions.css#L209-L218) global `::view-transition-*` `animation: none !important` | ✅ Compliant | VT-driven path covers `effectiveDir = 0` outcome cited in standard. |
| 2  | View Transitions morphs     | [view-transitions.css:209-218](../../../apps/web/src/styles/view-transitions.css#L209-L218); [navigation-type.ts](../../../apps/web/src/lib/navigation-type.ts) checks `prefers-reduced-motion` to bypass VT entirely | ✅ Compliant | |
| 3  | Mount stagger (CSS path)    | [motion.css:284-287](../../../apps/web/src/styles/motion.css#L284-L287) `.stagger-children > *` + `[data-mount-stagger]` | ✅ Compliant | CSS-driven mount stagger from `mount-and-overlay-motion` arc. |
| 3  | Mount stagger (Motion path) | ~16 Motion `variants` consumers (skeletons, profile rows, list entries) — see non-compliant table below | ❌ Non-compliant | Resolved en-bloc by root `MotionConfig`. |
| 4  | Overlay entry               | [motion.css:296-298](../../../apps/web/src/styles/motion.css#L296-L298) `[data-radix-popper-content-wrapper] { transition: none }` | ✅ Compliant | |
| 5  | Scroll-driven shell         | [motion.css:266-282](../../../apps/web/src/styles/motion.css#L266-L282) `--nav-collapse: 1`, `--progress-width: 100%; opacity: 0.4`, `.view-entry { animation: none; opacity: 1; transform: translateY(0) }` | ✅ Compliant | Replacement semantics match the standard. |
| 5  | Tab indicator pulse + glint | [motion.css:109-112](../../../apps/web/src/styles/motion.css#L109-L112) `.lol-tab-pulse`; [motion.css:151-155](../../../apps/web/src/styles/motion.css#L151-L155) `.theme-bar-glint::after { display: none }` | ✅ Compliant | Pulse → flat ring; glint → hidden. Acceptable per "ambient flourish" guidance. |
| 6  | Splash backdrop drift       | [splash-backdrop.tsx](../../../apps/web/src/lol/_shared/assets/splash-backdrop.tsx) reads `useReducedMotion()` at line 80 | ✅ Compliant | Verify Chunk 2 that the reduced branch renders a static center-frame crop. |
| 7  | Card tilt                   | [card-tilt.tsx](../../../apps/web/src/lol/_shared/ui/card-tilt.tsx) reads `useReducedMotion()` at line 21 | ✅ Compliant | Verify Chunk 2 that the reduced branch keeps a flat hover-scale affordance. |
| 8  | CountUp                     | [count-up.tsx](../../../apps/web/src/components/count-up.tsx) reads `useReducedMotion()` at line 18 (separate from the `SHOULD_ANIMATE` test bypass) | ✅ Compliant | |
| 9  | Orb mark                    | [orb-mark.tsx](../../../apps/web/src/home/orb-mark.tsx) reads `useReducedMotion()` at line 130; branches throughout (halos, wisps, core, opacity midpoints) | ✅ Compliant | Static constellation pattern matches the standard. |
| 10 | Card breathe                | [index.css:131-133](../../../apps/web/src/index.css#L131-L133) `.card-splash-breathe { animation: none }` | ✅ Compliant | |
| 11 | Sheen on Steam tiles + rows | [library-tile.tsx:218](../../../apps/web/src/steam/library/library-tile.tsx#L218), [steam-game-row.tsx:167](../../../apps/web/src/steam/_shared/steam-game-row.tsx#L167), [hundred-percent-hall.tsx:92](../../../apps/web/src/steam/achievements/hundred-percent-hall.tsx#L92) | ❌ Missing | No `@media (prefers-reduced-motion)` block drops the `transition-[--sheen-extent,opacity]` 900ms hover. Standard wants the gradient stop pinned at midpoint (~33%) with no transition. |
| 12 | Recharts entry              | 3 sites hardcode `isAnimationActive={false}` (match-map-overlay, trend-kda, championKey route); [profile-lp-history.tsx:1044](../../../apps/web/src/lol/profile/profile-lp-history.tsx#L1044) branches on `useReducedMotion()` | ✅ Compliant | Hardcoded-`false` sites are over-conservative but not user-harmful. |
| —  | Heatmap reveal              | [index.css:128-130](../../../apps/web/src/index.css#L128-L130) `.heatmap-cell { animation: none }` | ✅ Compliant | Not listed in the standard table; add an entry below. |
| —  | LP marker pop + tier-band   | [index.css:134-138](../../../apps/web/src/index.css#L134-L138) `.lp-tier-marker`, `.lp-tier-band-label` `{ animation: none }` | ✅ Compliant | Not listed in the standard table; add entries below. |
| —  | Match-row ambient hue drift | [index.css:221-224](../../../apps/web/src/index.css#L221-L224) `.match-row { transition: none }` | ✅ Compliant | Acceptable disable — the row's color still reads its outcome via the static `--row-tint`. |
| —  | Sibling-dim on hover        | [index.css:238-243](../../../apps/web/src/index.css#L238-L243) drops the `opacity 220ms` transition (opacity itself still applies, just instant) | ✅ Compliant | |
| —  | Safari sibling-tab slide    | [view-transitions.css:215-218](../../../apps/web/src/styles/view-transitions.css#L215-L218) `.safari-slide-in-from-{right,left} { animation: none }` | ✅ Compliant | |
| —  | Shimmer                     | [index.css:125-127](../../../apps/web/src/index.css#L125-L127) `.animate-shimmer { animation: none }` | ✅ Compliant | Skeleton shimmer drop is acceptable per standard ("no semantic content"). |

### Non-compliant Motion consumers (30 prod files, resolved by global MotionConfig)

Files that import `motion/react` and use `m.*` / `<AnimatePresence>` / `variants` / `layoutId` without calling `useReducedMotion()`:

**LazyMotion provider (no animation, no action):** `main.tsx`

**`layoutId` springs (active-tab/indicator transit — should jump on reduced):** `nav.tsx` (top-nav-pill), `champion-sort-selector.tsx`, `match-count-selector.tsx`, `match-detail-tabs.tsx`, `trends-range-selector.tsx`

**`AnimatePresence` opacity+scale/y entry-exit (should drop entry, keep mounting):** `fetch-progress.tsx`, `scroll-to-top.tsx`, `live-game-chip.tsx`, `champion-sticky-strip.tsx`

**Variants stagger (skeletons + list cascades — items should appear simultaneously):** `champions-skeleton.tsx`, `match-list-skeleton.tsx`, `trends-skeleton.tsx`, `game-detail-skeleton.tsx`, `library-skeleton.tsx`, `wishlist-skeleton.tsx`, `match-pips.tsx`, `profile-duos.tsx`, `profile-multikill-strip.tsx`, `profile-now-playing.tsx`, `profile-stats-bar.tsx`, `profile-synergy.tsx`

**Opacity+y entry on single tile (should drop):** `champion-card.tsx`, `champion-patch-history.tsx`, `profile-rank-tile.tsx`, `trend-streak.tsx`

**`match-list.tsx` settle-hold + per-row stagger:** sweep needs care — the per-row animation should drop, but the settle-hold `BODY_HOLD_OPACITY` gate is a *load-state mask*, not decoration. MotionConfig=`user` leaves opacity animations alone, so this keeps working; verify in Chunk 2.

**Route bodies with `BODY_HOLD_OPACITY` mask + opacity/y entry:** `__root.tsx`, `routes/lol/$accountSlug/champions/$championKey.tsx`, `routes/lol/$accountSlug/matches/$matchId.tsx` — same caveat as match-list (mask should survive, decorative entries should drop).

### Missing CSS reduced-motion blocks

Beyond §11 sheen, no other CSS-driven motion was found that lacks a reduced-motion block. Two CSS-property-based animations not listed in the original standard table need adding:

- **Heatmap reveal** (§17 new) — handled via `animation: none`; opacity already at 1 at final. Acceptable disable.
- **LP marker pop / tier-band label** (§18 new) — handled via `animation: none`. The component-level `labelsVisible` state gate determines when markers mount; the CSS keyframe only owns the visual fade-in.

### Chunk 2 / Chunk 3 plan

**Chunk 2 — Fix non-compliant surfaces:**

1. Mount `<MotionConfig reducedMotion="user">` inside `<LazyMotion features={domMax}>` in [main.tsx:21](../../../apps/web/src/main.tsx#L21) (single-line change; covers all 30 Motion consumers).
2. Add the sheen reduced-motion block to [index.css](../../../apps/web/src/index.css) right after the `@property --sheen-extent` declaration:
   ```css
   @media (prefers-reduced-motion: reduce) {
     [class*="--sheen-extent"] {
       transition: none;
       --sheen-extent: 33%;
     }
   }
   ```
   (selector may need to be the three concrete class-bearing sites instead of an attr selector; revisit when implementing).
3. Visual verification under DevTools "Emulate `prefers-reduced-motion: reduce`":
   - LoL profile + match list + Steam library entry animations stop snapping in row-by-row.
   - Tab indicators (nav, sort-selector, match-count, match-detail tabs, trends-range) jump to new position instead of springing.
   - LP-history body-hold opacity gate still works (route stays masked until data resolves).
   - Match-list scroll-restore still pins correctly (the StrictMode pin loop isn't motion).
   - Steam tile hover doesn't sweep sheen.

**Chunk 3 — Backfill missing reduced-motion on existing surfaces:** ✅ closed 2026-05-28 as no-op. Full keyframe inventory cross-checked against `(prefers-reduced-motion: reduce)` blocks:

| Keyframe | Consumer | rm block |
|---|---|---|
| `shimmer` | `.animate-shimmer` | [index.css:125-127](../../../apps/web/src/index.css#L125-L127) |
| `heatmap-reveal` | `.heatmap-cell`, `.lp-tier-band-label` | [index.css:128-130](../../../apps/web/src/index.css#L128-L130), [137-139](../../../apps/web/src/index.css#L137-L139) |
| `card-breathe` | `.card-splash-breathe` (`:hover`) | [index.css:131-133](../../../apps/web/src/index.css#L131-L133) |
| `lp-marker-pop` | `.lp-tier-marker` | [index.css:134-136](../../../apps/web/src/index.css#L134-L136) |
| `nav-compact` | `[data-vt-nav]` | [motion.css:267-270](../../../apps/web/src/styles/motion.css#L267-L270) |
| `section-progress` | `[data-scroll-progress]` | [motion.css:272-276](../../../apps/web/src/styles/motion.css#L272-L276) |
| `view-entry` | `.view-entry` | [motion.css:278-282](../../../apps/web/src/styles/motion.css#L278-L282) |
| `stagger-in` | `.stagger-children > *`, `[data-mount-stagger]` | [motion.css:284-287](../../../apps/web/src/styles/motion.css#L284-L287) |
| `lol-tab-pulse` | `.lol-tab-pulse` | [motion.css:109-113](../../../apps/web/src/styles/motion.css#L109-L113) |
| `theme-bar-glint-sweep` | `.theme-bar-glint::after` | [motion.css:151-156](../../../apps/web/src/styles/motion.css#L151-L156) |
| VT `vt-slide-*` / `vt-fade-*` | `::view-transition-*` pseudos | [view-transitions.css:209-214](../../../apps/web/src/styles/view-transitions.css#L209-L214) |
| `safari-slide-in-*` | `.safari-slide-in-*` | [view-transitions.css:215-218](../../../apps/web/src/styles/view-transitions.css#L215-L218) |
| (non-keyframe) `.match-row --row-tint` transition | match-row hover tint | [index.css:221-225](../../../apps/web/src/index.css#L221-L225) |
| (non-keyframe) sibling-dim opacity transition | `.match-list / .champion-list / .steam-library :has(:hover)` | [index.css:238-243](../../../apps/web/src/index.css#L238-L243) |
| (non-keyframe) `[data-sheen] --sheen-extent` transition | Steam tile/row/hall sheen | [index.css:250-257](../../../apps/web/src/index.css#L250-L257) — added Chunk 2 |
| (non-keyframe) `[data-radix-popper-content-wrapper]` @starting-style transition | Radix popper overlays | [motion.css:296-298](../../../apps/web/src/styles/motion.css#L296-L298) |

The audit's earlier prediction that §17 (heatmap reveal) and §18 (LP marker pop) "need adding" was incorrect — both `.heatmap-cell` and `.lp-tier-marker` already had `animation: none` blocks colocated with their keyframe definitions. No backfill required.

The original arc's §13–16 (PR flare, ambient hero, presence chip, audio) belong to arcs that haven't shipped yet — track them inside those arc notes.

**Chunk 4 — Consolidate into `motion.css`:** ✅ closed 2026-05-28 as no-op + standard update. The Chunk 1 audit confirmed colocated blocks across `index.css`, `motion.css`, and `view-transitions.css`; the call held. Standard rewritten above ("Colocate the reduced-motion override with its keyframe / animation declaration") to make this the documented pattern instead of a footnote — future motion arcs won't need to relitigate the placement question.

**Chunk 5 — Test pass:** ✅ closed 2026-05-28 via [apps/web/src/main.test.tsx](../../../apps/web/src/main.test.tsx) (added in Chunk 2). The test mocks `createRoot` to capture the JSX passed to `.render()`, walks the element tree, and asserts a `MotionConfig` element with `reducedMotion="user"` wraps the router. The wrapping can't regress silently.

### Surfaces NOT in scope

- Tests files (`*.test.tsx`) — they use Motion only as test inputs.
- Recharts hardcoded-`false` sites — over-conservative but not user-harmful; revisit only if the arcs they're in want richer entry on standard-motion users.
- Motion surfaces in arcs that haven't shipped yet (PR flare, ambient home hero, live-presence-chip, optional UI audio) — handled in their own arc notes.
