# Landing showcase arc

**Status:** Active 2026-05-31 — picked up at the top of the [elevation-arcs.md](elevation-arcs.md) pick order. Chunks 1 (editorial display headline) + 2 (static CSS ambient hero) + 3 (Canvas2D rAF drift, single-path dispatcher: reduced-motion/low-power → static, otherwise → canvas; `useLayoutEffect` first-draw + drift-zero-at-t0 + raw-px radius so the static→canvas swap is seamless) + 4 (activity-intensity reactivity: `/home/activity-intensity` endpoint drives canvas chroma 0.7×–1.3× via `lolMatches24h/6` vs `steamMinutesToday/120`, clamped; static path holds baseline 0.5× under reduced-motion/low-power) landed. Remaining: Chunk 5 (composition pass with bento + perf-baseline writeback). Consumes [ambient-home-hero.md](ambient-home-hero.md) verbatim for the hero rungs.

Elevate the `/` synthesis surface from "small logo animation + a few synthesis tiles" into a deliberate first-impression showcase that does justice to the portfolio framing of the app. Most reviewers (recruiters, fellow engineers, casual visitors) will land here and never click deeper — currently the landing page does not reflect the craft visible inside the section routes.

Sister notes: [ambient-home-hero](ambient-home-hero.md) (a planned component of this arc), [self-portrait-surfaces.md](self-portrait-surfaces.md) (the broader self-portrait direction), [nav-condensation-arc.md](nav-condensation-arc.md) (shipped 2026-05-31; landed cinematic Profile heroes on both LoL and Steam, which *widened* this arc's gap rather than closing it — see "Premise" below).

---

## Premise

The current `/` route shows a modest synthesis hero — `vyoh.gg` mark, a small animation, a few cross-stream synthesis tiles. It's correct but it's not a showcase. For a portfolio-positioning app where most visitors arrive and bounce within the first viewport, the landing surface is the single most important piece of design real estate in the project.

Two facts make this an unavoidable gap, both reinforced since this arc was first scoped:

1. **The strongest showcase surfaces today live behind a Profile-tab click.** [nav-condensation-arc](nav-condensation-arc.md) shipped 2026-05-31 — cinematic Profile heroes on both `/lol/$account/profile` and `/steam/profile`, with M2 scroll-collapse and M2b cross-tab identity morphs. [player-portrait.md](../steam/player-portrait.md) shipped 13 evidence-backed trait cards on the same Profile tab. A recruiter scanning the portfolio rarely makes that click.
2. **`/` is currently the least-designed surface in the project, and the gap has widened.** Section routes have splash backdrops, cinematic Profile heroes, animated nav icons, layered chrome, accent cascade, view-transitions, virtualized lists, shadcn primitives, layoutId pills, the whole stack. `/` has a logo, a tagline, and nine bento tiles ([apps/web/src/routes/index.tsx](../../../apps/web/src/routes/index.tsx)). Every Tier-1/2 ship since 2026-05-24 (nav-condensation, accent-color Steam wiring, editorial-typography, page-composition, data-viz-densification, mount-and-overlay-motion, reduced-motion-replacements) has elevated the section routes; none has touched `/`.

A dedicated arc closes that gap. The premise is **not** to dump per-stream content onto `/` (that violates the synthesis-only convention in [repo-conventions.md § per-stream routes](../../repo-conventions.md) and would muddy the IA). The premise is to make the synthesis surface itself a portfolio showcase — to use the cross-stream framing as the canvas for the strongest visual moves in the app.

---

## Scope sketch

This is exploratory. Concrete chunks should land once the design direction is chosen. Candidates for what fills the landing showcase:

- **Ambient hero.** Generative ambient piece (Canvas2D or WebGPU stretch), time-of-day reactive in `Europe/Brussels`. Already a planned arc — see [ambient-home-hero](ambient-home-hero.md). Likely sits at the top of the landing surface as the "moment of arrival."
- **Cross-stream synthesis hero.** "What am I doing right now" — picks the dominant live stream (in-game on LoL, playing on Steam, idle) and renders that as the headline. When live, the hero adapts: champion splash + match context, or game art + playtime. When idle, falls back to a curated synthesis ("Today: X hours across Y streams").
- **Chronotype synthesis card.** Already alluded to in [repo-conventions.md § per-stream routes](../../repo-conventions.md) as a canonical synthesis surface: hour-bucketing across LoL + commit activity + Steam playtime. The cross-stream chronotype lives here, not on per-stream routes.
- **Curated teaser fragments.** Per-stream "one curated highlight" allowed by the repo conventions — the strongest single fragment from each stream (e.g. most recent ranked win pip, most-played Steam game this week), each linking into the deep route. Resists turning into a per-stream feed; one fragment maximum.
- **Editorial type treatment.** Large display-type identity / introduction. Extend the [editorial-typography](editorial-typography.md) variable-font axes (shipped 2026-05-27) to the landing display heading. Sets the visual register for the rest of the page.
- **Subtle accent / theme cascade.** Pulls from [accent-color-system](accent-color-system.md) (Steam wiring shipped 2026-05-28, cascade fully wired). Time-of-day or live-stream-tinted ambient palette.
- **First-visit choreography.** A deliberate entry sequence for the first arrival — hero unfolds, synthesis cards stagger in, accent system blooms. Subsequent visits get the static version (or a softened replay). Sets the tone for what kind of app this is.
- **Subtle ambient surfaces beyond the hero.** Logo micro-animation (already in [motion-backlog § Logo ambient micro-animation](motion-backlog.md)), scroll-driven shell choreography (already shipped via [scroll-driven-shell](../archive/scroll-driven-shell.md)).

---

## What this arc resolves

- **The "showcase behind a click" question.** The cinematic Profile heroes shipped by [nav-condensation-arc](nav-condensation-arc.md) and the 13 trait cards shipped by [player-portrait.md](../steam/player-portrait.md) currently *only* reward dedicated visitors who click into a section's Profile tab. This arc rebalances by giving the scanner-on-`/` a first-impression worthy of the craft already on the deeper surfaces — landing handles first-impression work, the deeper surfaces handle dedicated-visitor work.
- **The "/ is least-designed surface" gap.** Brings `/` up to the craft level of the section routes (which have moved further ahead since this arc was first scoped).
- **The portfolio framing question.** A recruiter who lands on `/` and bounces gets the strongest visual moves in the app, not the least.

---

## Open decisions (resolve when picking up this arc)

1. **Scope ambition.** Light pass (ambient hero + one synthesis card + editorial type) vs. comprehensive showcase (ambient hero + multiple synthesis cards + first-visit choreography + per-stream teasers). The light pass is shippable in 1–2 chunks; the comprehensive showcase is a 4–6 chunk arc.
2. **Relationship to ambient-home-hero.** Does this arc absorb [ambient-home-hero](ambient-home-hero.md), or does it consume it as a sibling chunk? The latter keeps the existing arc's specificity; the former simplifies the index.
3. **Per-stream teaser allowance.** [repo-conventions.md § per-stream routes](../../repo-conventions.md) allows "at most a single curated highlight per stream that links into the deep route." Decide which highlight each stream gets — the choice is editorial, not algorithmic.
4. **Browser/engine support floor.** WebGPU is the most ambitious option for the ambient hero; Canvas2D is the safer default. Per [elevation-arcs.md § Browser-support floor](elevation-arcs.md), default is 2025-09 Safari 26 / Chrome 120 / Firefox 128. WebGPU is supported on that floor but still requires a Canvas2D fallback. Decide at the point of building.
5. **Reduced-motion variants.** Not a decision — a hard requirement. [reduced-motion-replacements.md](reduced-motion-replacements.md) is a shipped standing rule: every element of the landing showcase needs a *replacement* (information-equivalent static or low-motion variant), not a disable. Plan these alongside the active variants.

---

## Sequencing

**This arc is independent of detail-panel-arc.** It touches `/` and possibly the primary nav (for ambient logo work); detail-panel touches detail routes. They can land in any order.

Prerequisites that were open in the original brainstorm are now met:

- ✅ [nav-condensation-arc](nav-condensation-arc.md) shipped 2026-05-31 — the "showcase visibility" question is settled by giving Profile tabs the cinematic heroes; landing now needs to do its own first-impression work.
- ✅ [accent-color-system](accent-color-system.md) Steam wiring shipped 2026-05-28 — the synthesis hero can pull from a fully-wired accent cascade today.

Still-open sequencing consideration:

- Doing this arc *before* the [TanStack Start migration](tanstack-start-migration.md) means SSR of the landing page gets designed against the final shape, not retrofitted. (The ambient hero must be client-only regardless — see [ambient-home-hero § Risks](ambient-home-hero.md).)

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
