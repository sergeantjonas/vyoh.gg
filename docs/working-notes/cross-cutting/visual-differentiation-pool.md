# Visual differentiation pool

**Status:** Reference — idea pool (2026-06-12 exploration, indexed in [idea-pool-2026-06.md](idea-pool-2026-06.md)). Idea 2 shipped 2026-08-01; ideas 1 and 3 not scoped. Three independent ideas with separate triggers; promote individually. Context: the elevation-arc tiers are essentially exhausted (all shipped) — this is the residual headroom found after sweeping [elevation-arcs.md](elevation-arcs.md), [motion-backlog.md](motion-backlog.md), and [quick-wins.md](quick-wins.md).

## 1. Generative season artwork (owner-data-seeded)

A deterministic generative piece computed from the season's match history — e.g. threads = champions (accent-colored), weave rhythm = win/loss sequence, knots = multikills/PBs — rendered to a static SVG/canvas. Same input → same artwork; a new season produces a genuinely new piece.

- **Surfaces:** recap hero band, and a share-card variant plugging into feature-candidates F1 (shareable chapters) — generative art is the most screenshot-able thing the recap could emit.
- **Distinct from** the [quick-wins.md](quick-wins.md) *visitor* identity glyph (visitor-seeded, tiny); this is owner-data-seeded and editorial-scale. Cross-reference, don't merge.
- **Calm test:** generative ≠ loud — static output, no rAF loop, palette from the existing accent/atmosphere tokens. The reference aesthetic is data-art prints, not shader demos. Drafts can incubate in [`/lab`](lab-section.md) before one graduates.
- **Risk:** "programmer art" — the idea lives or dies on one good visual metaphor. Prototype 2–3 metaphors cheaply before committing a surface; per [[feedback_dont_guess_visual_content]], judge on rendered output, not description.

## 2. Live-state ambience (atmosphere × live presence) — shipped 2026-08-01

`/` now tilts toward whatever the owner is playing. `useLiveAmbience()` reduces live presence to one oklch hue — the owner's champion in a live LoL game via `championTheme()`, or the live Steam game's `dominantHex` — and `applyLiveAmbience()` rotates every gradient layer of the dominant atmosphere claim 45% of the way toward it, lifting the blend intensity by 0.15. The orb halo follows for free, since it already reads `--atmosphere-tint-h`.

Landed as a **global modulation rather than a fourth claim**: live state is page-wide and has no band to be weighted against, so a page-spanning claim would have displaced the subject chapters' palettes instead of colouring them. The route owns the wiring (`useLiveAmbience()` → `<AtmosphereProvider live>`), which keeps the substrate a pure function of its inputs.

- **Cost:** as predicted — no new layers, no new requests. Both presence polls already run at the root, owned-games is already mounted on `/` by `NowPlayingStrip`, and the LoL static bundle is already fetched by the Ahri chapter.
- **Precedence:** LoL wins outright over Steam, matching `NowPlayingStrip` — Steam frequently still reports a background title the owner alt-tabbed away from. It deliberately does *not* fall through to Steam when the champion can't be resolved.
- **Layers rotate by a fraction of their own arc**, not onto a shared hue, so a palette keeps its warm/cool split instead of flattening into one wall of colour.
- **Achromatic guard:** `oklchHueFromHex()` returns null below 0.01 chroma. Without it, `championTheme`'s `#888888` fallback would have tilted the whole page toward a rounding-noise hue on any unrecognised champion.
- **Not done:** the shift snaps when live state flips. That matches the substrate's existing behaviour at claim handoff (`resolveAtmosphere` renders the dominant claim's palette with no interpolation), so it's consistent rather than a regression — but a ramped `liveWeight` MotionValue, subscribed the way `bloomBlurPx` already is, is the obvious follow-up if it reads harsh. `prefers-reduced-motion` needs nothing today: nothing pulses.
- **Champ-select is not reachable** — Spectator-V5 only answers for games already in progress, so the idea's champ-select state has no data behind it.
- **Risk was rarity**, and it stands: most visitors never see this. A preview of the four palettes × subjects at three pull weights was generated to judge the art direction without waiting to be in a game.

## 3. Paper light theme

A deliberately crafted editorial *light* skin — "paper" — where gaming dashboards are categorically dark. Doubles as a design-token discipline showcase (the entire surface system — tile tiers, accents, atmosphere — re-derived for a second scheme proves the tokens are real).

- **Check first:** the frontend-2026 sweep Round F touched `color-scheme` — verify current posture before assuming dark-only.
- **The honest cost:** this is a real arc, not a token flip. Splash/backdrop art, frosted-glass recipes, and text-shadow readability are all tuned for dark; light needs per-surface treatment (scrims, duotone, possibly disabling backdrops) — and [[feedback_readability_solutions_to_avoid]] rules out the lazy fixes. Tile-recipe table in [repo-conventions.md](../../repo-conventions.md#tile-background-one-level-of-glass-between-background-and-content) would need a light column.
- **Gate:** prototype the LoL profile page only; if splash-over-light can't be made beautiful there, park the whole idea with that evidence. Lowest priority of the three — highest cost, least unique payoff.
