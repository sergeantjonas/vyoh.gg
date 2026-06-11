# Visual differentiation pool

**Status:** Reference — idea pool (2026-06-12 exploration, indexed in [idea-pool-2026-06.md](idea-pool-2026-06.md)), not scoped. Three independent ideas with separate triggers; promote individually. Context: the elevation-arc tiers are essentially exhausted (all shipped) — this is the residual headroom found after sweeping [elevation-arcs.md](elevation-arcs.md), [motion-backlog.md](motion-backlog.md), and [quick-wins.md](quick-wins.md).

## 1. Generative season artwork (owner-data-seeded)

A deterministic generative piece computed from the season's match history — e.g. threads = champions (accent-colored), weave rhythm = win/loss sequence, knots = multikills/PBs — rendered to a static SVG/canvas. Same input → same artwork; a new season produces a genuinely new piece.

- **Surfaces:** recap hero band, and a share-card variant plugging into feature-candidates F1 (shareable chapters) — generative art is the most screenshot-able thing the recap could emit.
- **Distinct from** the [quick-wins.md](quick-wins.md) *visitor* identity glyph (visitor-seeded, tiny); this is owner-data-seeded and editorial-scale. Cross-reference, don't merge.
- **Calm test:** generative ≠ loud — static output, no rAF loop, palette from the existing accent/atmosphere tokens. The reference aesthetic is data-art prints, not shader demos. Drafts can incubate in [`/lab`](lab-section.md) before one graduates.
- **Risk:** "programmer art" — the idea lives or dies on one good visual metaphor. Prototype 2–3 metaphors cheaply before committing a surface; per [[feedback_dont_guess_visual_content]], judge on rendered output, not description.

## 2. Live-state ambience (atmosphere × live presence)

Wire two **shipped** systems together: the atmosphere substrate publishes `--atmosphere-tint-h`/`--atmosphere-intensity` ([atmosphere-arc.md](atmosphere-arc.md)); `LiveGamePollerService` + Steam presence already know live state ([live-presence-chip.md](live-presence-chip.md)). Today the chip reacts; the *site* doesn't. States: idle → baseline; LoL champ-select/in-game → tint shifts toward the played champion's accent, intensity rises; Steam in-game → game accent. Visit-while-live becomes a story visitors tell.

- **Cost:** CSS variable transitions only — no new layers, no new compositor cost; the substrate was built for exactly this kind of claim.
- **Constraints:** honor `prefers-reduced-motion` (snap, don't pulse); never suppress descendant `backdrop-filter` via ancestor opacity ([[feedback_ancestor_opacity_suppresses_backdrop_filter]]).
- **Risk:** rarity — most visitors never see it. Acceptable as a delight feature given near-zero cost; the live chip already explains the state when it happens.

## 3. Paper light theme

A deliberately crafted editorial *light* skin — "paper" — where gaming dashboards are categorically dark. Doubles as a design-token discipline showcase (the entire surface system — tile tiers, accents, atmosphere — re-derived for a second scheme proves the tokens are real).

- **Check first:** the frontend-2026 sweep Round F touched `color-scheme` — verify current posture before assuming dark-only.
- **The honest cost:** this is a real arc, not a token flip. Splash/backdrop art, frosted-glass recipes, and text-shadow readability are all tuned for dark; light needs per-surface treatment (scrims, duotone, possibly disabling backdrops) — and [[feedback_readability_solutions_to_avoid]] rules out the lazy fixes. Tile-recipe table in [repo-conventions.md](../../repo-conventions.md#tile-background-one-level-of-glass-between-background-and-content) would need a light column.
- **Gate:** prototype the LoL profile page only; if splash-over-light can't be made beautiful there, park the whole idea with that evidence. Lowest priority of the three — highest cost, least unique payoff.
