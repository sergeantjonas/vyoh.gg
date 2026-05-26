# Landing showcase arc

**Status:** Planned — exploratory scope from 2026-05-27 brainstorm. No code yet, no chunk plan yet.

Elevate the `/` synthesis surface from "small logo animation + a few synthesis tiles" into a deliberate first-impression showcase that does justice to the portfolio framing of the app. Most reviewers (recruiters, fellow engineers, casual visitors) will land here and never click deeper — currently the landing page does not reflect the craft visible inside the section routes.

Sister notes: [ambient-home-hero](ambient-home-hero.md) (a planned component of this arc), [self-portrait-surfaces.md](self-portrait-surfaces.md) (the broader self-portrait direction), [nav-condensation-arc.md § open decision 5](nav-condensation-arc.md) (the "showcase behind a click" question that this arc resolves).

---

## Premise

The current `/` route shows a modest synthesis hero — `vyoh.gg` mark, a small animation, a few cross-stream synthesis tiles. It's correct but it's not a showcase. For a portfolio-positioning app where most visitors arrive and bounce within the first viewport, the landing surface is the single most important piece of design real estate in the project.

Two facts make this an unavoidable gap:

1. **The strongest showcase surfaces today live behind a Profile-tab click.** [nav-condensation-arc § 1.3a/b](nav-condensation-arc.md) builds a content-level identity block on `/lol/$account/profile` and `/steam/profile`. [player-portrait.md](../steam/player-portrait.md) builds 13 evidence-backed trait cards on the same Profile tab. A recruiter scanning the portfolio rarely makes that click.
2. **`/` is currently the least-designed surface in the project.** Section routes have splash backdrops, animated nav icons, layered chrome, view-transitions, virtualized lists, shadcn primitives, layoutId pills, the whole stack. `/` has a logo and a couple of tiles.

A dedicated arc closes that gap. The premise is **not** to dump per-stream content onto `/` (that violates the synthesis-only convention in [repo-conventions.md § per-stream routes](../../repo-conventions.md) and would muddy the IA). The premise is to make the synthesis surface itself a portfolio showcase — to use the cross-stream framing as the canvas for the strongest visual moves in the app.

---

## Scope sketch

This is exploratory. Concrete chunks should land once the design direction is chosen. Candidates for what fills the landing showcase:

- **Ambient hero.** Generative ambient piece (Canvas2D or WebGPU stretch), time-of-day reactive in `Europe/Brussels`. Already a planned arc — see [ambient-home-hero](ambient-home-hero.md). Likely sits at the top of the landing surface as the "moment of arrival."
- **Cross-stream synthesis hero.** "What am I doing right now" — picks the dominant live stream (in-game on LoL, playing on Steam, idle) and renders that as the headline. When live, the hero adapts: champion splash + match context, or game art + playtime. When idle, falls back to a curated synthesis ("Today: X hours across Y streams").
- **Chronotype synthesis card.** Already alluded to in [repo-conventions.md § per-stream routes](../../repo-conventions.md) as a canonical synthesis surface: hour-bucketing across LoL + commit activity + Steam playtime. The cross-stream chronotype lives here, not on per-stream routes.
- **Curated teaser fragments.** Per-stream "one curated highlight" allowed by the repo conventions — the strongest single fragment from each stream (e.g. most recent ranked win pip, most-played Steam game this week), each linking into the deep route. Resists turning into a per-stream feed; one fragment maximum.
- **Editorial type treatment.** Large display-type identity / introduction. Variable-font axes per [editorial-typography](editorial-typography.md). Sets the visual register for the rest of the page.
- **Subtle accent / theme cascade.** Pulls from [accent-color-system](accent-color-system.md) (shipped). Time-of-day or live-stream-tinted ambient palette.
- **First-visit choreography.** A deliberate entry sequence for the first arrival — hero unfolds, synthesis cards stagger in, accent system blooms. Subsequent visits get the static version (or a softened replay). Sets the tone for what kind of app this is.
- **Subtle ambient surfaces beyond the hero.** Logo micro-animation (already in [motion-backlog § Logo ambient micro-animation](motion-backlog.md)), scroll-driven shell choreography (already shipped via [scroll-driven-shell](../archive/scroll-driven-shell.md)).

---

## What this arc resolves

- **The "showcase behind a click" question.** Once the landing surface earns its place as a showcase, the [nav-condensation-arc § 1.3a/b](nav-condensation-arc.md) identity blocks and [player-portrait.md](../steam/player-portrait.md) cards can sit comfortably behind a Profile-tab click — they're for the dedicated visitor, not the scanner. The landing arc handles first-impression work; the deeper surfaces handle dedicated-visitor work.
- **The "/ is least-designed surface" gap.** Brings `/` up to the craft level of the section routes.
- **The portfolio framing question.** A recruiter who lands on `/` and bounces gets the strongest visual moves in the app, not the least.

---

## Open decisions (resolve when picking up this arc)

1. **Scope ambition.** Light pass (ambient hero + one synthesis card + editorial type) vs. comprehensive showcase (ambient hero + multiple synthesis cards + first-visit choreography + per-stream teasers). The light pass is shippable in 1–2 chunks; the comprehensive showcase is a 4–6 chunk arc.
2. **Relationship to ambient-home-hero.** Does this arc absorb [ambient-home-hero](ambient-home-hero.md), or does it consume it as a sibling chunk? The latter keeps the existing arc's specificity; the former simplifies the index.
3. **Per-stream teaser allowance.** [repo-conventions.md § per-stream routes](../../repo-conventions.md) allows "at most a single curated highlight per stream that links into the deep route." Decide which highlight each stream gets — the choice is editorial, not algorithmic.
4. **Browser/engine support floor.** WebGPU is the most ambitious option for the ambient hero; Canvas2D is the safer default. Per [elevation-arcs.md § Browser-support floor](elevation-arcs.md), default is 2025-09 Safari 26 / Chrome 120 / Firefox 128. WebGPU is supported on that floor but still requires a Canvas2D fallback. Decide at the point of building.
5. **Reduced-motion variants.** Every element of the landing showcase needs a reduced-motion replacement, not a disable, per the project's standing rule. Plan these alongside the active variants.

---

## Sequencing

**This arc is independent of nav-condensation-arc and detail-panel-arc.** It touches `/` and possibly the primary nav (for ambient logo work); the other arcs touch section routes and detail routes. They can land in any order. That said:

- Doing this arc *before* nav-condensation-arc 1.3a/b takes pressure off the "showcase visibility" question — the landing surface carries first-impression work, the Profile tab carries dedicated-visitor work.
- Doing this arc *after* the [accent-color-system](accent-color-system.md) Steam wiring lands lets the synthesis hero pull from a fully-wired accent cascade.
- Doing this arc *before* the TanStack Start migration means SSR of the landing page gets designed against the final shape, not retrofitted.

No hard prerequisite ordering; pick based on cadence and what's most exciting at the time.

---

## Cross-references

- [elevation-arcs.md](elevation-arcs.md) — promote this arc when it picks up active work.
- [ambient-home-hero.md](ambient-home-hero.md) — likely a chunk of this arc.
- [self-portrait-surfaces.md](self-portrait-surfaces.md) — broader self-portrait direction; this arc is the surface where self-portrait work lands publicly.
- [editorial-typography.md](editorial-typography.md) — display-type treatment.
- [accent-color-system.md](accent-color-system.md) — accent cascade powers ambient tinting.
- [nav-condensation-arc.md](nav-condensation-arc.md) — resolves the showcase-visibility open decision.
- [motion-backlog.md § Logo ambient micro-animation](motion-backlog.md) — logo treatment may be folded into this arc.
- [repo-conventions.md § per-stream routes](../../repo-conventions.md) — the "/ is synthesis-only" convention this arc operates inside.
