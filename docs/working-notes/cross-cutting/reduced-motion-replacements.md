# Reduced-motion replacements — audit + standard

**Status:** Planned. Part of [elevation-arcs.md](elevation-arcs.md) Tier 2. A single pass to audit every animated surface in the app against the **"replace, don't disable"** principle from [03-motion.md §6.5](~/.claude/knowledge/frontend-2026/03-motion.md), and to standardise the replacement variants in one place so future motion arcs inherit the pattern.

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

Per [scroll-driven-shell.md](../archive/scroll-driven-shell.md) Chunk 1, `apps/web/src/styles/motion.css` consolidates motion declarations. A single `@media (prefers-reduced-motion: reduce)` block at the bottom contains all overrides, organized by section. Example:

```css
@media (prefers-reduced-motion: reduce) {
  /* §3 Mount stagger */
  .stagger-children > * { animation: none; }

  /* §4 Overlay entry */
  [data-radix-popper-content-wrapper] [data-state] {
    transition: none;
    transform: none;
  }

  /* §5 Scroll-driven */
  :root {
    --nav-collapse: 1;
    --splash-opacity: 0.18;
  }
  [data-scroll-progress] { animation: none; width: 100%; opacity: 0.4; }
  .view-entry { animation: none; opacity: 1; transform: none; }

  /* §13 PR flare */
  .pr-flare[data-record-fire="true"]::before {
    transition: opacity 400ms ease-out;
    --flare-progress: 0.25;
  }

  /* etc. */
}
```

This keeps the reduced-motion contract reviewable as a single block.

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
