# Timeline mini-map replay scrubber

**Status:** Reference — idea on file (2026-06-12 exploration, indexed in [idea-pool-2026-06.md](../cross-cutting/idea-pool-2026-06.md)), not scoped. Strongest sequenced **with** match-depth Phase E position work — both need event x/y projected onto match data; build the projection once.

## Why

A scrubbable, time-animated "replay sketch" of a match on the Rift mini-map — built purely from Match-V5 timeline data — is a flagship feature no third-party LoL site ships at editorial quality. It is simultaneously the strongest new *product* idea in the pool and a perf-story showcase (single-canvas rendering, deterministic playback, zero layout cost). The kill-strip ↔ minimap morph (shipped, Phase B) proved the spatial-storytelling appetite; this is its full expression.

## Data (verify against cached payloads before scoping)

- `participantFrames[*].position {x,y}` per ~60 s frame — all 10 players, the path skeleton.
- Event positions: `CHAMPION_KILL`, `ELITE_MONSTER_KILL`, `BUILDING_KILL` carry `position`. **`WARD_PLACED` does not** — wards can appear as timing pulses only, never mapped. Record this so nobody scopes a ward map off this data.
- `CHAMPION_KILL.victimDamageReceived` exists for kill detail on hover (ties into the death-autopsy idea in [lol-data-stories.md](lol-data-stories.md)).
- **Verify timeline retention:** confirm what `MatchDetailCache` actually stores for timelines and for how many matches ([match-cache-storage.md](match-cache-storage.md) owns the storage-tier question). If timelines are fetched-on-demand only, the scrubber works per-match-detail without backfill — fine for v1.

## Shape

- **Where:** a section inside match-detail (Your game or its own tab), entering through the existing skeleton + section-nav conventions. The Rift map SVG underlay already exists from the Phase B morph.
- **Rendering:** one `<canvas>`, owner-path emphasized, teammates/enemies dimmed; events pulse at their timestamp; positions linearly interpolated between minute-frames and **labeled as a sketch, not a replay** — minute-granularity data must not pretend to be VOD fidelity. Honest framing is the editorial angle: "the shape of the game," not a replay viewer.
- **Controls:** scrub slider (the primary interaction) + play at 30–60×; no autoplay. `prefers-reduced-motion` → scrub-only, no play button.
- **Narrative hooks:** jump-to markers for first blood, objectives, the owner's deaths — and, if the win-probability curve ([lol-data-stories.md](lol-data-stories.md)) ships, "the moment it flipped" becomes the marquee jump target. The two features want to be designed together even if shipped separately.

## Perf / conventions

- Canvas is one compositor layer; scrubbing redraws are bounded (10 dots + trails). Add a perf-probe scenario row per [repo-conventions.md](../../repo-conventions.md#layer-count--paint-budget-per-route-scenario) in the same change since match-detail's budget shifts.
- Interactive surface → test in the same commit (scrub keyboard a11y: slider role, arrow-key steps).
- Palette: `replay <champion|match>` deep-link verb per the palette convention.

## Risks / open questions

- Position coordinate space → map projection needs one calibration pass against known landmarks (towers) — do this first; it's the only real unknown.
- Frame granularity might make early-lane movement look teleport-y even interpolated; if so, constrain v1 to event-anchored storytelling (paths fade in around events) rather than continuous playback.
