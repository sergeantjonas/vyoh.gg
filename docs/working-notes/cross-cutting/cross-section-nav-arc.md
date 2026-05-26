# Cross-section navigation arc

**Status:** Planned — exploratory scope from 2026-05-27 brainstorm. Depends on [nav-condensation-arc § 1.1](nav-condensation-arc.md) landing first. No code yet.

When the user navigates between top-level sections (LoL → Steam, Steam → `/`, `/lol` → `/status`, etc.), the merged sticky strip's contents change wholesale: different identity, different tabs, different active states. Today [section-shell-vt-migration](section-shell-vt-migration.md) (shipped 2026-05-24) handles the section *shell* transition via View Transitions + CSS keyframes scoped by transition `types`. This arc verifies the merged strip composes cleanly with that pattern, and elevates the cross-section moment from "chrome swap" to a deliberate transition.

Sister notes: [section-shell-vt-migration.md](section-shell-vt-migration.md) (the existing shell transition this arc extends), [nav-condensation-arc.md](nav-condensation-arc.md) (the merged strip pattern this arc reacts to), [view-transitions-rollout.md](view-transitions-rollout.md) (the broader VT primitive).

---

## Premise

[nav-condensation-arc § 1.1](nav-condensation-arc.md) introduces a merged sticky strip whose contents are entirely section-specific:

- LoL: `[avatar] Vyoh#Ahri ▾   Profile · Matches · Trends · Champions   [⟳] [≡]`
- Steam: `[avatar] Vyoh   Profile · Library · Wishlist · Achievements   [≡]`
- `/`, `/status`: no merged strip (sectionless routes).

When the user navigates LoL → Steam, the merged strip swaps wholesale. The active-tab `layoutId` morph (folded into 1.1) has nothing to morph between across sections — the tab DOM nodes are in different React trees. Without deliberate treatment, the transition reads as a hard chrome swap: identity disappears, tabs disappear, fresh identity + fresh tabs appear in their place.

Today's [section-shell-vt-migration](section-shell-vt-migration.md) handles the section *content* (the body below the chrome) with VT-driven slides. The chrome above isn't touched by that arc. After 1.1 lands, the chrome is **bigger** — the merged strip is the chrome's most prominent element — so the chrome-vs-content transition asymmetry becomes more visible.

This arc fixes that asymmetry.

---

## Scope sketch

Exploratory. Concrete chunks should land once the design direction is chosen. Candidates:

- **VT-tagged merged-strip transition.** Tag the merged strip with a `view-transition-name` so it participates in the section-route VT alongside the content body. Decide what the transition looks like: crossfade, slide-with-content, dissolve-and-reform. Should compose with [section-shell-vt-migration](section-shell-vt-migration.md)'s existing `types` scoping.
- **Sectionless-route handling.** When navigating into `/` or `/status` (no merged strip on those routes), the strip needs to gracefully exit, not snap. Same in reverse — entering a section from `/` needs the strip to gracefully enter. View Transitions handle this when nodes appear/disappear, but the choreography needs to feel intentional.
- **Cross-section seam-straddle avatar handling.** The seam-straddle avatar from 1.1 sits at the boundary between primary nav and merged strip. On cross-section navigation, does the avatar stay anchored at the seam and morph (avatar changes identity but stays at the seam) or does it cross-fade with the strip? Decide based on visual prototyping.
- **Active section chip → strip relationship.** The primary nav's active section chip (e.g. "Steam" highlighted) and the merged strip's identity should compose visually. Possibly the chip's accent tint extends into the strip's seam line — a subtle anchor that says "this strip belongs to this section."

---

## Dependencies

- **[nav-condensation-arc § 1.1](nav-condensation-arc.md) must land first.** This arc only makes sense once the merged strip exists.
- **[section-shell-vt-migration](section-shell-vt-migration.md) (shipped)** — this arc extends its `types`-scoped VT pattern to cover the chrome.
- **[accent-color-system](accent-color-system.md) (shipped, Steam wiring deferred)** — the cross-section chip-accent treatment leans on this. If Steam wiring isn't done by the time this arc starts, decide whether to do it inside this arc or wait.

---

## Open decisions

1. **Transition aesthetic.** Slide (the strip slides left as the new strip slides in from the right), crossfade (one fades out, the other fades in in place), or dissolve (a brief unified moment with both partially visible). Prototype first, decide after seeing.
2. **Sectionless-route handling.** Should `/` and `/status` grow a thin sectionless strip for visual continuity, or remain bare? Probably bare (per nav-arc decision), in which case decide how the strip enters/exits gracefully.
3. **Avatar transition treatment.** Stay-at-seam-and-morph vs. cross-fade-with-strip. Either is defensible; visual prototype will pick the winner.
4. **Engine-gate considerations.** [safari-vt-snapshot-cost.md](safari-vt-snapshot-cost.md) documents WebKit's snapshot cost for VT-heavy transitions. The merged strip is small DOM, but adding it to the VT scope expands the snapshot. Measure before assuming it's free.

---

## Cross-references

- [elevation-arcs.md](elevation-arcs.md) — promote this arc when it picks up active work.
- [nav-condensation-arc.md § 1.1](nav-condensation-arc.md) — hard prerequisite.
- [section-shell-vt-migration.md](section-shell-vt-migration.md) — the existing shell transition this arc extends.
- [view-transitions-rollout.md](view-transitions-rollout.md) — broader VT primitive.
- [safari-vt-snapshot-cost.md](safari-vt-snapshot-cost.md) — engine-gate precedent if WebKit chops.
- [accent-color-system.md](accent-color-system.md) — accent cascade powers the chip-accent treatment.
