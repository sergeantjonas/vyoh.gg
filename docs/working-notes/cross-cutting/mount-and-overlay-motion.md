# Mount stagger + overlay entry motion

**Status:** Planned. Part of [elevation-arcs.md](elevation-arcs.md) Tier 1. Combines two related arcs that both target "static-feeling" surfaces with CSS-first entry motion: **(a) mount stagger** for tile/list grids and **(b) native `@starting-style` + `transition-behavior: allow-discrete`** for overlay surfaces (Select, Popover, Dropdown, Toast).

Read this before adding any new tile grid, list surface, or overlay primitive — the patterns here become the default and replace ad-hoc Motion `AnimatePresence` wrappings where the overlay is simple.

KB anchors: [01-css-and-styling.md §`@starting-style` + `allow-discrete`](~/.claude/knowledge/frontend-2026/01-css-and-styling.md), [03-motion.md §6 motion DX](~/.claude/knowledge/frontend-2026/03-motion.md), [web.dev Baseline entry animations](https://web.dev/blog/baseline-entry-animations).

---

## Why

Two flat zones in the audit:

1. **Tile grids appear simultaneously.** Bento, champion grid, match list, Steam library all render their items in one frame. The information lands intact but the surface feels static. A 40–80ms cascade on mount converts "static" into "alive" with zero perceived-perf cost (each item still hits the DOM at the same time; only the visual entry is staggered).
2. **Shadcn overlay defaults are abrupt.** Select, Popover, Dropdown render their content via `display: none → block`, which `transition` cannot bridge by default. Without `@starting-style` you'd need to Motion-wrap each overlay, which is heavy. With `@starting-style` you get smooth entry from CSS alone, applied once at the primitive layer.

Both are CSS-only and Newly Available in 2024 (`@starting-style`) and forever (CSS `animation-delay`). No JS, no library.

---

## What this is NOT

- **Not animating route changes.** Route transitions are owned by [view-transitions-rollout.md](view-transitions-rollout.md).
- **Not replacing Motion `AnimatePresence` for rich overlay content.** Command palette, hover cards with media, animated dialogs stay on Motion because they have orchestration (sequenced child animations, gestures, dismiss interactions). Plain Select/Popover/Dropdown surfaces move to CSS.
- **Not infinite-scroll lazy entries.** Per-row entries on scroll are handled by `animation-timeline: view()` in [scroll-driven-shell.md](../archive/scroll-driven-shell.md) Chunk 5. This arc handles **the initial mount only**.

---

## Part A — Mount stagger

### Pattern

```tsx
<ul className="stagger-children">
  {items.map((item, i) => (
    <li key={item.id} style={{ "--i": i } as CSSProperties}>...</li>
  ))}
</ul>
```

```css
.stagger-children > * {
  animation: stagger-in 320ms cubic-bezier(0.32, 0.72, 0, 1) backwards;
  animation-delay: calc(var(--i, 0) * 50ms);
}

@keyframes stagger-in {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}

@media (prefers-reduced-motion: reduce) {
  .stagger-children > * { animation: none; }
}
```

Tunables:
- **Step delay**: 40ms (snappy) to 80ms (deliberate). Default **50ms**.
- **Duration**: 280–360ms. Default **320ms**.
- **Cap total cascade**: for lists >20 items, divide step by `max(1, n / 20)` so the total cascade never exceeds ~1s. Otherwise a 60-item match list takes 3 seconds to settle.

### Where to apply

- [apps/web/src/components/bento/](../../../apps/web/src/components/bento/) — tile-grid items on `/`.
- [apps/web/src/lol/matches/match-list.tsx](../../../apps/web/src/lol/matches/match-list.tsx) — first N rows above the fold (below-the-fold handled by [scroll-driven-shell.md](../archive/scroll-driven-shell.md) Chunk 5).
- [apps/web/src/lol/champions/champion-table.tsx](../../../apps/web/src/lol/champions/champion-table.tsx) — initial mount only; sort reflow stays on Motion `layout` per `vnext-ideas.md`.
- Steam library tiles.
- Per-section secondary cards on match detail (build, runes, timeline tabs).

### Filter / refresh reflows

When the list **re-renders with new data** (filter change, query refetch), the cascade should fire again. Currently `key={item.id}` keeps stable identities — the elements don't re-mount and the animation doesn't replay. Two options:

- **Don't replay.** First mount staggers; subsequent updates pop in without cascade. Calmer for frequent updates.
- **Replay on data-shape change.** Add a `key` on the wrapper that changes when the filter changes (`key={JSON.stringify(filter)}`); forces remount of all children. Heavier.

Default: **don't replay**. Loud is not allowed (guardrail from [motion-backlog.md](motion-backlog.md)). If a specific surface benefits from replay, document the exception in that component.

---

## Part B — Native overlay entry/exit

### Pattern

```css
[data-radix-popper-content-wrapper] [data-state="open"] {
  opacity: 1;
  transform: scale(1) translateY(0);
  transition:
    opacity 180ms ease-out,
    transform 180ms cubic-bezier(0.32, 0.72, 0, 1),
    display 180ms allow-discrete;
}

[data-radix-popper-content-wrapper] [data-state="closed"] {
  opacity: 0;
  transform: scale(0.96) translateY(-4px);
}

/* Entry animation from initial state */
@starting-style {
  [data-radix-popper-content-wrapper] [data-state="open"] {
    opacity: 0;
    transform: scale(0.96) translateY(-4px);
  }
}

@media (prefers-reduced-motion: reduce) {
  [data-radix-popper-content-wrapper] [data-state="open"],
  [data-radix-popper-content-wrapper] [data-state="closed"] {
    transition: none;
    transform: none;
  }
}
```

Three primitives at play (per [01-css-and-styling.md](~/.claude/knowledge/frontend-2026/01-css-and-styling.md)):

1. **`@starting-style`** — declares the *starting* values an element should transition *from* when it enters the DOM. Without it, freshly-mounted elements have no "before" state to transition from.
2. **`transition-behavior: allow-discrete`** — explicitly allows transitioning the otherwise-discrete `display` property. Without it, the element snaps in/out and the opacity/transform transitions can't run on close.
3. **`@property`** — only needed if animating custom properties (color stops, complex curves). Not required for opacity/transform.

### Where to apply

Add to the shadcn primitive files where these live:
- [apps/web/src/components/ui/popover.tsx](../../../apps/web/src/components/ui/popover.tsx) if it exists
- Select, Dropdown, Tooltip, HoverCard equivalents under `apps/web/src/components/ui/`

Verify the actual filenames at pickup — shadcn copies vary.

The CSS lives in `apps/web/src/styles/motion.css` (created in [scroll-driven-shell.md](../archive/scroll-driven-shell.md) Chunk 1) under a clearly-labeled `/* Overlay entry/exit */` block. Target by Radix data-attributes so it's primitive-wide.

### Don't touch

- Command palette dialog — owns its own Motion-driven entry; keep it.
- Hover cards with charts/sparklines — keep Motion (they need orchestration).
- Toast / Sonner if added — its own primitive choreography.

---

## Chunked plan

### Chunk 1 — `stagger-children` utility + first surface

- Add the `.stagger-children` rule and `@keyframes stagger-in` to `motion.css`.
- Apply to the bento grid on `/` ([apps/web/src/components/bento/](../../../apps/web/src/components/bento/)) — simplest, highest visible payoff.
- Test: assert `style={{ "--i": ... }}` is set on each child, snapshot the parent class.

### Chunk 2 — Apply stagger to match list (above-the-fold)

- Modify [match-list.tsx](../../../apps/web/src/lol/matches/match-list.tsx) — first 8 rows get `--i`, rest get no stagger (handled by `view()` later in [scroll-driven-shell.md](../archive/scroll-driven-shell.md)).
- Cap rule: if `i >= 8`, omit the `--i` style.
- Test: 8th row has `--i: 7`, 9th does not.

### Chunk 3 — Apply stagger to champion grid

- [champion-table.tsx](../../../apps/web/src/lol/champions/champion-table.tsx) — initial mount only.
- **Care:** the existing `layout` prop on `<m.li>` for sort reflow must not conflict with the CSS animation. Motion's layout animation runs on transform; the CSS keyframe also uses transform. Test the sort-change flow specifically — does the first sort after mount glitch? If yes, gate the stagger to a `data-first-mount` attribute that's removed after first render.

### Chunk 4 — Apply stagger to Steam library

- Steam library tiles get the same treatment.
- Cap rule applies (large libraries).

### Chunk 5 — Overlay entry CSS

- Add the `@starting-style` + `allow-discrete` block to `motion.css` targeting Radix popper data-attributes.
- Reduced-motion media block.
- Manual verification across: Select, Popover, Dropdown, Tooltip, HoverCard. Each should animate in/out smoothly without flicker.
- Test: structural — the CSS rule is present. Visual verification via the `verify` skill.

### Chunk 6 — Refactor: remove Motion wrappers where CSS now covers it

Sweep `apps/web/src/components/ui/` and feature components for places that wrap Select/Popover content in Motion just for entry animation. If the wrapper was *only* for entry/exit motion (no orchestration), remove it and rely on the CSS layer.

Don't remove Motion wrappers that have:
- Gesture handlers (drag, whileHover, whileTap)
- Orchestrated child animations
- Layout animations (`layout` prop)
- Variants beyond entry/exit

---

## Files in scope

Modified:
- `apps/web/src/styles/motion.css` (add stagger + overlay blocks)
- `apps/web/src/components/bento/*` (Chunk 1)
- `apps/web/src/lol/matches/match-list.tsx` (Chunk 2)
- `apps/web/src/lol/champions/champion-table.tsx` (Chunk 3)
- Steam library tile container (Chunk 4)
- `apps/web/src/components/ui/popover.tsx` etc. as exist (Chunk 5)
- Any component that wraps a Radix overlay in Motion-only-for-entry (Chunk 6)

---

## Risks / open questions

- **`backwards` fill-mode and React.** `animation-fill-mode: backwards` keeps the "from" state until the delay elapses. Verify React 19 + React Compiler don't double-mount the items (StrictMode), which would replay the cascade twice. Likely fine because keys are stable, but verify.
- **Radix data-attribute targeting fragility.** Radix may rename `data-state` between major versions. Document the targeting in `motion.css` so future maintainers see it.
- **`@starting-style` + portals.** Radix overlays render into a portal at `document.body`. The CSS targeting must traverse the portal correctly (or target the portal root). Test before committing.
- **Reduced-motion overlap.** Both arcs in this note add reduced-motion blocks. Make sure they don't fight or duplicate — use a single `@media (prefers-reduced-motion: reduce)` block at the bottom of `motion.css` that resets all motion-css selectors at once.

---

## Reduced motion

- **Stagger**: replaced with no animation; items appear instantly. Per [reduced-motion-replacements.md](reduced-motion-replacements.md), this is "replace, don't disable" only nominally — but information is not lost (the cascade carried no semantic content; only delight).
- **Overlay entry**: `transition: none`, `transform: none`. The overlay still appears, just instantly. This is correct.
