# Landing showcase arc

**Status:** ✅ Closed 2026-05-31. D4 reopening completed: D4-1 (hero swell), D4-2 (Steam editorial band, interim-stripped), D4-cursor-parallax all landed. D4-3 through D4-6 superseded by [atmosphere-arc.md](atmosphere-arc.md) (substrate shipped 2026-06-01) → [self-portrait-recap-arc.md](self-portrait-recap-arc.md) (active 2026-06-01, chapter-driven editorial recap). Foundation work moved through [motion-choreography-arc.md](motion-choreography-arc.md) first. This note stays as the historical record of the D4 reopening and the architectural pivot it triggered; pick up the **recap arc** directly for live work.

**Successor chain:** landing-showcase-arc D4-3..D4-6 → atmosphere-arc A-3..A-8 (superseded 2026-06-01) → **self-portrait-recap-arc R-1..R-12** (active). The D4-2 interim-strip state was resolved by the recap arc's R-3 (Steam subject chapter), not the atmosphere arc's A-3.

**Prior status:** Reopened 2026-05-31 (D4 direction) — the initial five chunks shipped the **ambient + bento** shape, but on owner review the bento itself reads as generic-SaaS-dashboard register and undermines the "self-portrait" framing. Specifically: three LoL-only highlight tiles ([tile-signature-game](../../apps/web/src/home/tile-signature-game.tsx) / [tile-last-match](../../apps/web/src/home/tile-last-match.tsx) / [tile-first-played](../../apps/web/src/home/tile-first-played.tsx)) and zero Steam-only tiles violate [repo-conventions.md § per-stream routes](../../repo-conventions.md)'s "single curated highlight per stream" cap *in both directions*, and the bento grid as a form makes the landing surface read as a dashboard rather than the cinematic register the Profile heroes and match-detail editorial stack already established elsewhere in the app.

**D4 direction (closed):** *D1 atomic first move (full-viewport hero, bento survives below 100vh), then D3 incremental band migration*. D1 closed the first-impression gap in one session; D3 was to replace bento sections one at a time with editorial bands (the [match-detail-view.tsx `MatchYourGameTab` composition](../../apps/web/src/lol/matches/match-detail-view.tsx) — bare wrappers, `SectionTitle` page-zone dividers, no card chrome — translated to `/`). On owner review during D4-2 the per-band-backdrop pattern was rejected for an irreducible seam-between-bands problem (see [atmosphere-arc.md](atmosphere-arc.md) brainstorm-preservation). D3 incremental migration replaced by the data-driven shared-atmosphere-layer model in [atmosphere-arc.md](atmosphere-arc.md).

**Original five-chunk landing (kept for context):** Chunks 1 (editorial display headline) + 2 (static CSS ambient hero) + 3 (Canvas2D rAF drift, single-path dispatcher) + 4 (activity-intensity reactivity: `/home/activity-intensity` endpoint drives canvas chroma 0.7×–1.3× via `lolMatches24h/6` vs `steamMinutesToday/120`) + 5 (composition pass: bento chrome `bg-card/50` → `bg-card/65`, hero strip held at `calc(70vh + 1.5rem)`) all landed. Chunks 1–4 carry into D4 directly; Chunk 5's bento-tuning gets superseded by D4 Chunk 1 (hero claims the first viewport) and re-litigated band-by-band in D4 Chunks 2+.

**Still-parked work:** [landing-live-hero.md](landing-live-hero.md) (cross-stream live-hero swap, gated on [live-presence-chip.md](live-presence-chip.md) Chunks 1–3; reframed Steam-LoL parallel from Chunk 1 per owner pushback) and [ambient-home-hero.md](ambient-home-hero.md) optional Chunks 5–7 (cursor parallax, composition variants, WebGPU stretch).

---

## Pivot 2026-05-31 — atmosphere arc + motion choreography arc supersede D4-3 through D4-6

After D4-1 shipped (full-viewport hero) and D4-2 attempted (Steam editorial band with full-bleed game-hero image as backdrop), a multi-hour 2026-05-31 conversation about the irreducible seam-between-bands problem in D4-2 led to a fundamental rearchitecture.

**Direction change:** the landing page is no longer a sequence of bands each with its own backdrop. It's a continuous atmospheric experience with bands as typographic editorial moments on top of a single shared atmosphere layer. Atmosphere morphs as the user scrolls toward each band; band ordering itself is data-driven by recent activity. Full plan in [atmosphere-arc.md](atmosphere-arc.md).

**Foundation arc:** [motion-choreography-arc.md](motion-choreography-arc.md) lands first. App-wide editorial motion vocabulary (Linear/Resend register — `<EditorialHeading>` primitive, section stagger variants, `whileInView` adoption, reduced-motion contract) ships before atmosphere bands depend on it. Confirmed motion-arc-first ordering 2026-05-31.

**What carries forward unchanged:**
- D4-1 (full-viewport hero) stands; AmbientHero becomes the initial atmosphere claim under the new system.
- D4-cursor-parallax remains an independent atomic chunk; can land any time.

**What changes:**
- **D4-2 (Steam band):** interim state as of 2026-05-31 — image backdrop being stripped, kept as no-image editorial copy (eyebrow + headline + meta + achievement icon) until atmosphere-arc A-3 reintroduces it as a claim-only band.
- **D4-3, D4-4, D4-5, D4-6:** superseded by atmosphere arc chunks A-3 through A-8. The data-driven band system replaces the originally-planned per-band-backdrop sequence.

**Brainstorm preservation:** the architectural decisions, the seam diagnosis, the four-iteration failure modes (mask shape, mask center, box extension, isolation removal), the Linear/Resend register decision, the pure-JS-not-CSS-scroll-timeline decision (Firefox `timeline-scope` unimplemented), and the low-activity strategy all live in [atmosphere-arc.md](atmosphere-arc.md) § "Brainstorm-preservation" and § "Architecture decision records". This banner is the entry-point; pick that note up directly when reopening.

---

## D4 chunk plan (active 2026-05-31)

**D4-1. Full-viewport hero.** `AmbientHero` swells from 60vh strip to ~95vh full-bleed. `LandingHeading` lifts *inside* the hero, centered vertically, at editorial scale (extend [editorial-typography.md](../archive/editorial-typography.md) variable-font axes — currently shipped on match-detail / Profile heroes — to the landing display). Bento survives but starts below `100vh`, below the fold for the recruiter who doesn't scroll. Single session. Files: [routes/index.tsx](../../apps/web/src/routes/index.tsx), [home/landing-heading.tsx](../../apps/web/src/home/landing-heading.tsx), [home/ambient-hero.tsx](../../apps/web/src/home/ambient-hero.tsx) (height prop only).

**D4-2. First editorial band: Steam signature.** ⚠️ Shipped 2026-05-31, then re-scoped same day. Initial ship: [LandingSteamBand](../../apps/web/src/home/landing-steam-band.tsx) rendered the most recent cross-game unlock as a full-bleed band — game hero backdrop (`steamLibraryHeroUrl`) with vignette + horizontal gradient mask, achievement icon, `text-3xl` headline, `Unlocked in {game} · {time-ago}` meta, deep-links to `/steam/game/$appid?ach=apiName`. Backed by `useRecentUnlocks(1)`. `TileFirstPlayed` (LoL) demoted in the same chunk to respect the per-stream-highlight cap. **Re-scope:** the full-bleed backdrop image created an irreducible seam between hero and band (see [atmosphere-arc.md](atmosphere-arc.md) brainstorm-preservation). Interim treatment 2026-05-31: strip the backdrop image, keep editorial copy + achievement icon. Atmosphere-arc A-3 reintroduces as claim-only band.

**D4-3. Second editorial band: LoL signature.** ❌ Superseded by [atmosphere-arc.md](atmosphere-arc.md) A-4 (LoL band as claim-only). The original "cinematic LoL editorial band peer to Steam band" plan would have recreated the same seam D4-2 hit. Atmosphere arc lands it as part of the data-driven band system instead.

**D4-4. Third editorial band: chronotype as full-width chart.** ❌ Superseded by [atmosphere-arc.md](atmosphere-arc.md) A-6 (chronotype as full-width band with rhythm claim). Same restructure, now part of the shared atmosphere system.

**D4-5. Cleanup band: day-split + session-shape + weekly-totals.** ❌ Superseded by [atmosphere-arc.md](atmosphere-arc.md) A-7 (volume / rhythm cleanup band).

**D4-6. Site-meta footer.** ❌ Superseded by [atmosphere-arc.md](atmosphere-arc.md) A-8 (site-meta footer; bento officially retired in same chunk).

**D4-cursor-parallax.** ✅ Shipped 2026-05-31. `usePointerParallax({ maxOffset: 14 })` wired into [`AmbientHero`](../../apps/web/src/home/ambient-hero.tsx); the canvas branch is wrapped in `<m.div data-ambient-parallax>` bound to the hook's motion values. Magnitude 14 (vs. splash bg=6 / fg=12) chosen because the gradients are blurry enough that smaller offsets read as no motion. Hook's `(pointer: fine)` gate handles touch; `shouldAnimate` gate handles reduced-motion + low-power (static fallback omits the parallax track). Lands the [ambient-home-hero.md](ambient-home-hero.md) Chunk 5 parked work.

Elevate the `/` synthesis surface from "small logo animation + a few synthesis tiles" into a deliberate first-impression showcase that does justice to the portfolio framing of the app. Most reviewers (recruiters, fellow engineers, casual visitors) will land here and never click deeper — currently the landing page does not reflect the craft visible inside the section routes.

Sister notes: [ambient-home-hero](ambient-home-hero.md) (a planned component of this arc), [self-portrait-surfaces.md](self-portrait-surfaces.md) (the broader self-portrait direction), [nav-condensation-arc.md](../archive/nav-condensation-arc.md) (shipped 2026-05-31; landed cinematic Profile heroes on both LoL and Steam, which *widened* this arc's gap rather than closing it — see "Premise" below).

---

## Premise

The current `/` route shows a modest synthesis hero — `vyoh.gg` mark, a small animation, a few cross-stream synthesis tiles. It's correct but it's not a showcase. For a portfolio-positioning app where most visitors arrive and bounce within the first viewport, the landing surface is the single most important piece of design real estate in the project.

Two facts make this an unavoidable gap, both reinforced since this arc was first scoped:

1. **The strongest showcase surfaces today live behind a Profile-tab click.** [nav-condensation-arc](../archive/nav-condensation-arc.md) shipped 2026-05-31 — cinematic Profile heroes on both `/lol/$account/profile` and `/steam/profile`, with M2 scroll-collapse and M2b cross-tab identity morphs. [player-portrait.md](../steam/player-portrait.md) plans 13 evidence-backed trait cards on the same Profile tab — its shared helpers landed 2026-08-01, the cards have not. A recruiter scanning the portfolio rarely makes that click.
2. **`/` is currently the least-designed surface in the project, and the gap has widened.** Section routes have splash backdrops, cinematic Profile heroes, animated nav icons, layered chrome, accent cascade, view-transitions, virtualized lists, shadcn primitives, layoutId pills, the whole stack. `/` has a logo, a tagline, and nine bento tiles ([apps/web/src/routes/index.tsx](../../../apps/web/src/routes/index.tsx)). Every Tier-1/2 ship since 2026-05-24 (nav-condensation, accent-color Steam wiring, editorial-typography, page-composition, data-viz-densification, mount-and-overlay-motion, reduced-motion-replacements) has elevated the section routes; none has touched `/`.

A dedicated arc closes that gap. The premise is **not** to dump per-stream content onto `/` (that violates the synthesis-only convention in [repo-conventions.md § per-stream routes](../../repo-conventions.md) and would muddy the IA). The premise is to make the synthesis surface itself a portfolio showcase — to use the cross-stream framing as the canvas for the strongest visual moves in the app.

---

## Scope sketch

This is exploratory. Concrete chunks should land once the design direction is chosen. Candidates for what fills the landing showcase:

- **Ambient hero.** Generative ambient piece (Canvas2D or WebGPU stretch), time-of-day reactive in `Europe/Brussels`. Already a planned arc — see [ambient-home-hero](ambient-home-hero.md). Likely sits at the top of the landing surface as the "moment of arrival."
- **Cross-stream synthesis hero.** "What am I doing right now" — picks the dominant live stream (in-game on LoL, playing on Steam, idle) and renders that as the headline. When live, the hero adapts: champion splash + match context, or game art + playtime. When idle, falls back to a curated synthesis ("Today: X hours across Y streams"). **Promoted 2026-05-31 to its own sibling note — see [landing-live-hero.md](landing-live-hero.md) for design alternatives (live-only / daily-dominant / hybrid), infrastructure to reuse (`LiveGamePollerService` + `SteamPlaySession` + `SplashProvider`), reduced-motion contract, and sequencing relative to [live-presence-chip.md](live-presence-chip.md).**
- **Chronotype synthesis card.** Already alluded to in [repo-conventions.md § per-stream routes](../../repo-conventions.md) as a canonical synthesis surface: hour-bucketing across LoL + commit activity + Steam playtime. The cross-stream chronotype lives here, not on per-stream routes.
- **Curated teaser fragments.** Per-stream "one curated highlight" allowed by the repo conventions — the strongest single fragment from each stream (e.g. most recent ranked win pip, most-played Steam game this week), each linking into the deep route. Resists turning into a per-stream feed; one fragment maximum.
- **Editorial type treatment.** Large display-type identity / introduction. Extend the [editorial-typography](../archive/editorial-typography.md) variable-font axes (shipped 2026-05-27) to the landing display heading. Sets the visual register for the rest of the page.
- **Subtle accent / theme cascade.** Pulls from [accent-color-system](accent-color-system.md) (Steam wiring shipped 2026-05-28, cascade fully wired). Time-of-day or live-stream-tinted ambient palette.
- **First-visit choreography.** A deliberate entry sequence for the first arrival — hero unfolds, synthesis cards stagger in, accent system blooms. Subsequent visits get the static version (or a softened replay). Sets the tone for what kind of app this is.
- **Subtle ambient surfaces beyond the hero.** Logo micro-animation (already in [motion-backlog § Logo ambient micro-animation](motion-backlog.md)), scroll-driven shell choreography (already shipped via [scroll-driven-shell](../archive/scroll-driven-shell.md)).

---

## What this arc resolves

- **The "showcase behind a click" question.** The cinematic Profile heroes shipped by [nav-condensation-arc](../archive/nav-condensation-arc.md) and the 13 trait cards planned by [player-portrait.md](../steam/player-portrait.md) currently *only* reward dedicated visitors who click into a section's Profile tab. This arc rebalances by giving the scanner-on-`/` a first-impression worthy of the craft already on the deeper surfaces — landing handles first-impression work, the deeper surfaces handle dedicated-visitor work.
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

- ✅ [nav-condensation-arc](../archive/nav-condensation-arc.md) shipped 2026-05-31 — the "showcase visibility" question is settled by giving Profile tabs the cinematic heroes; landing now needs to do its own first-impression work.
- ✅ [accent-color-system](accent-color-system.md) Steam wiring shipped 2026-05-28 — the synthesis hero can pull from a fully-wired accent cascade today.

Still-open sequencing consideration:

- Doing this arc *before* the [TanStack Start migration](tanstack-start-migration.md) means SSR of the landing page gets designed against the final shape, not retrofitted. (The ambient hero must be client-only regardless — see [ambient-home-hero § Risks](ambient-home-hero.md).)

No hard prerequisite ordering; pick based on cadence and what's most exciting at the time.

---

## Cross-references

- [elevation-arcs.md](elevation-arcs.md) — promote this arc when it picks up active work.
- [ambient-home-hero.md](ambient-home-hero.md) — likely a chunk of this arc.
- [landing-live-hero.md](landing-live-hero.md) — the "cross-stream synthesis hero" candidate, surfaced as its own design note.
- [self-portrait-surfaces.md](self-portrait-surfaces.md) — broader self-portrait direction; this arc is the surface where self-portrait work lands publicly.
- [editorial-typography.md](../archive/editorial-typography.md) — display-type treatment.
- [accent-color-system.md](accent-color-system.md) — accent cascade powers ambient tinting.
- [nav-condensation-arc.md](../archive/nav-condensation-arc.md) — resolves the showcase-visibility open decision.
- [motion-backlog.md § Logo ambient micro-animation](motion-backlog.md) — logo treatment may be folded into this arc.
- [repo-conventions.md § per-stream routes](../../repo-conventions.md) — the "/ is synthesis-only" convention this arc operates inside.
