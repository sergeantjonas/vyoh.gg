# Idea pool — 2026-06-12 exploration

**Status:** Reference — index of the 2026-06-12 future-features / differentiation exploration. Nothing here is scoped or tracked in [open-work.md](../open-work.md). Browse alongside [vnext-ideas.md](vnext-ideas.md) and [feature-candidates-2026-06.md](feature-candidates-2026-06.md) when picking post-current-scope work; promote a note to Active (chunk plan + open-work entry) when picked.

Provenance: brainstorm session against the full backlog sweep (vnext-ideas, elevation-arcs, motion-backlog, quick-wins, library-shortlist, feature-candidates, steam-api-unused-data, self-portrait-surfaces). Every entry below was checked for overlap against those files; near-misses are recorded in the overlap map at the bottom. The pool deliberately includes ideas that may later be parked or rejected — the point is having them on file.

The exploration's framing, worth keeping with the index:

1. **The engineering rigor is invisible to visitors** — perf budgets, perf-probe, web-vitals bus, axe scans, and 21 case studies exist with almost no public surface. Biggest unrealized portfolio asset.
2. **The positioning gap is Angular** — the repo demonstrates React + perf depth; "Angular-deep" (half the freelance profile) is claimed, nowhere shown.
3. **N=1 editorial analytics is the moat** — every new feature should be something op.gg/Mobalytics structurally can't do at scale (cross-stream, personal baselines, verdicts).

## Portfolio differentiation

- [colophon-engineering-surface.md](colophon-engineering-surface.md) — public "how this site is built" surface: live RUM p75, perf budgets vs actuals, bundle/test counts, a11y conformance statement. Concretizes vnext's "Web Vitals dashboard (public = case-study anchor)" entry.
- [case-study-reader.md](case-study-reader.md) — in-app reader for the 21 write-ups already sitting in [docs/case-studies/](../../case-studies/). The missing distribution last-mile; fires the parked `shiki` trigger.
- [angular-react-bridge.md](angular-react-bridge.md) — one widget built twice (Angular zoneless/signals vs React 19) + mapping write-up. The only artifact that *demonstrates* the Angular half of the positioning.
- [perf-probe-ci-gate.md](perf-probe-ci-gate.md) — turn the per-route layer/raster budget table into a CI gate. Sibling of vnext's bundle-budget + Lighthouse CI entries; the compositor-budget gate is the differentiator.
- [palette-parser-extraction.md](palette-parser-extraction.md) — extract the palette grammar parser to a published npm package; fires four parked library-shortlist triggers (changesets, tsup, fast-check, Stryker) in one move.

## Structural

- [lab-section.md](lab-section.md) — `/lab` quarantine route where calm-test-rejected experiments are allowed to be loud (Houdini, shaders, the Angular bridge embed). Resolves the calm-aesthetic vs bleeding-edge-showcase tension spatially.
- [../lol/visitor-vs-owner.md](../lol/visitor-vs-owner.md) — ephemeral "you vs me" comparison for visitors who enter their Riot ID. Converts the portfolio from read-only to interactive; gated on a prod-tier Riot key.

## LoL section

- [../lol/timeline-replay-scrubber.md](../lol/timeline-replay-scrubber.md) — canvas mini-map replay sketch scrubbing through timeline frames. Flagship visual+data feature; pairs with match-depth Phase E position work.
- [../lol/lol-data-stories.md](../lol/lol-data-stories.md) — pool of seven smaller data-storytelling ideas: win-probability curve ("the moment the game flipped"), comeback/clutch index, champion learning curves, ping fingerprint, death autopsy, vision rhythm, patch×pool profile rollup.

## Steam section

- [../steam/steam-library-economics.md](../steam/steam-library-economics.md) — backlog actuary (IGDB time-to-beat × current pace) + wishlist market-value verdicts (ITAD historical lows, extending feature-candidates F4). Records the cost-per-hour dead end so it isn't re-derived.

## Cross-stream

- [cross-stream-behavior-detectors.md](cross-stream-behavior-detectors.md) — detector family for `/`: tilt escape-hatch, post-win stop, comfort-game taxonomy, weekday/weekend mix. Purest expression of the N=1 thesis; gated on SteamPlaySession accumulation.

## Visual

- [visual-differentiation-pool.md](visual-differentiation-pool.md) — three ideas with independent triggers: generative season artwork (owner-data-seeded), live-state ambience (atmosphere × live presence), paper light theme.

## Five-pick if picking today

1. **Colophon** — converts invisible rigor into visible differentiation; mostly assembles existing pieces.
2. **Case-study reader** — 21 finished write-ups with no distribution; highest value-to-effort in the pool.
3. **Angular↔React bridge** — attacks the actual positioning gap; nothing else on file does.
4. **Timeline replay scrubber** — strongest new product feature; no third-party site has it at editorial quality.
5. **Steam library economics** — rides the hot wishlist arc; cheap data, characterful verdicts.

## Overlap map — already owned elsewhere

- **OpenTelemetry / distributed tracing** → explicitly deferred in [vnext-ideas.md](vnext-ideas.md#low-priority--explicitly-deferred) ("overkill until multiple services"). Stays deferred; the colophon note deliberately does *not* include tracing. If post-hosting observability appetite appears, re-open the vnext entry — don't creep it back via a new note.
- **Wishlist price-watch (snapshot base)** → owned by [feature-candidates-2026-06.md](feature-candidates-2026-06.md) F4 as a rider on [wishlist-upcoming.md](../steam/wishlist-upcoming.md). The economics note only adds the ITAD/market-value layer on top.
- **Web Vitals dashboard, bundle budgets in CI, Lighthouse CI** → vnext Foundational/Observability entries. Colophon + CI-gate notes are their concrete promotion shapes; treat the re-derivation as +1 promotion signal (same idiom as feature-candidates' overlap map).
- **Achievement-hunting planner, `/code` stream, shareable recap chapters** → feature-candidates F3/F2/F1. Not duplicated here.
- **Generative *visitor* identity glyph** → [quick-wins.md](quick-wins.md) Tier-2 (visitor-seeded). The visual pool's generative *season artwork* is owner-data-seeded — different idea, cross-referenced both ways.
- **WebShare / share affordances** → feature-candidates F1 owns the share bridge; the generative artwork would plug into it as a card variant.
- **Patch-aware champion features** → largely shipped (patch-aware everything, PB3 patch-drift verdict). Only a profile-level pool rollup remains; scoped honestly as the weakest entry inside [lol-data-stories.md](../lol/lol-data-stories.md).
