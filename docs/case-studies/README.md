# Case studies

Public-facing write-ups of shipped arcs. Freelance-positioning surface — each one tells one engineering story end-to-end (problem → constraints → approach → trade-offs → result).

Companion to [working-notes/](../working-notes/) (planning surface, internal) and [repo-conventions.md](../repo-conventions.md) (portable rules). Case-study candidates are tracked in [working-notes/case-study-topics.md](../working-notes/cross-cutting/case-study-topics.md).

## Inventory

| File | Title |
|---|---|
| [build-time-champion-assets.md](build-time-champion-assets.md) | Precomputing champion assets at build time |
| [bundling-the-bounded-cdn.md](bundling-the-bounded-cdn.md) | Bundling the bounded CDN — a three-phase fix for flaky LoL image delivery |
| [conclusion-card-pattern.md](conclusion-card-pattern.md) | A stats site that talks — the ConclusionCard pattern |
| [cross-stream-synthesis.md](cross-stream-synthesis.md) | Cross-stream synthesis on `/` — the self-portrait, not the feed |
| [frontend-perf.md](frontend-perf.md) | Frontend perf when 28% of the bundle is on purpose |
| [fullscreen-blur-flicker.md](fullscreen-blur-flicker.md) | Killing flicker on a fullscreen-blur backdrop |
| [historical-backfill-and-sse.md](historical-backfill-and-sse.md) | Backfilling Riot history in the background, streaming deltas to the client |
| [lp-history-postgres.md](lp-history-postgres.md) | An LP-history chart without a time-series database |
| [match-detail-nested-routing.md](match-detail-nested-routing.md) | Tabs as routes — moving match-detail navigation from a query param to nested path segments |
| [motion-without-gimmicks.md](motion-without-gimmicks.md) | Adding motion to a data dashboard without making it loud |
| [og-card-satori.md](og-card-satori.md) | Server-rendering OG share cards without a headless browser |
| [operator-console.md](operator-console.md) | Putting a glass cover on a rate-limiter chain |
| [pagination-partial-failure.md](pagination-partial-failure.md) | Pagination that survives partial failure |
| [patch-notes-pipeline.md](patch-notes-pipeline.md) | LoL patch-notes pipeline — wiki wikitext as a structured feed |
| [pics-protocol-drop-down.md](pics-protocol-drop-down.md) | When the Web API can't help — dropping a layer to Steam's PICS for asset hashes |
| [riot-rate-limits.md](riot-rate-limits.md) | When the limiter never even tried — a Riot API debugging story |
| [runtime-image-proxy.md](runtime-image-proxy.md) | Runtime image proxy — replacing a working build-time bundle with a server-side proxy when content cadence outgrew deploy cadence |
| [steam-presence-as-signal.md](steam-presence-as-signal.md) | Polling presence as the signal source — Steam sessions and event-driven unlocks from one 2-minute tick |
| [visual-layer.md](visual-layer.md) | Visual layer — the small patterns that hold the page together |

## Authoring conventions

- One arc, one story. Don't bundle two separate shipped efforts in one case study.
- Start with the problem framed in the owner's voice; end with the outcome and what you'd do differently.
- Link to working-note decision logs for "how it was actually decided" — case studies are the polished version, not the planning archive.
- Cross-reference the code via `[path](../../path)` so readers can jump to the implementation.
- Add new write-ups to the inventory table above in the same commit that lands the file.
