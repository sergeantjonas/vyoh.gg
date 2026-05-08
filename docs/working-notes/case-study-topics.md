# vyoh.gg — case study and write-up topics

The project is a portfolio piece. README, deploy URL, write-ups, and performance evidence are deliverables, not afterthoughts.

## Portfolio positioning

The intended signal:

```text
Angular-deep + React-competent + perf/build/migration specialist
```

This is more distinctive than "another React dev."

Architectural choices should support that signal:

- NestJS over Next.js full-stack shows backend architectural depth and Angular-adjacent DI/modules/decorators.
- Two-deploy architecture shows real systems thinking around auth, CORS, env config, deploy pipelines, and API boundaries.
- Perf instrumentation makes optimization visible.
- Multi-source aggregation shows ETL/caching/identity-stitching work.
- Redis/BullMQ should be added when the backfill problem justifies it, not as decoration.

If a simpler route would flatten the portfolio signal, call that out explicitly.

## README as technical case study

The README should eventually include:

- what the app does
- live URL
- architecture diagram
- stack rationale
- local setup
- screenshots/GIFs
- performance evidence
- rate-limit/caching strategy
- notable engineering decisions
- future roadmap

Avoid a pure marketing README. It should read like a technical case study a client can skim.

## First-class deliverables

1. Working deployed app at `vyoh.gg`
2. Public GitHub repo with incremental history
3. Substantive README
4. 1–2 long-form write-ups
5. Visible perf instrumentation

## Candidate write-up 1 — Riot rate limits and backfill strategy

Status: **shipped (two write-ups)**.

- [docs/case-studies/riot-rate-limits.md](../case-studies/riot-rate-limits.md) — the rolling-window vs. fixed-window primitive bug, three wrong hypotheses on the way to it, and the architectural pivot to take Riot off the user-facing critical path.
- [docs/case-studies/historical-backfill-and-sse.md](../case-studies/historical-backfill-and-sse.md) — follow-up arc covering the limiter slot leak (deadline abandonment + reservoir-update drift), the time-anchored historical worker (`endTime` + `min(playedAt)`), and the per-account SSE channel that streams new rows to TanStack invalidations.

Further material parked for a third pass once production-tier key behaviour, per-account TTL self-healing, and parallel-account fairness become real concerns.

Portfolio signal:

- systems thinking
- external API integration
- data freshness vs rate-limit constraints
- user experience under slow backfills
- real-time push (SSE) wired cleanly into TanStack Query

## Candidate write-up 2 — Multi-source identity stitching

Potential title:

```text
Stitching Riot and Steam Profiles Into One Gaming Dashboard
```

Topics:

- account identity model
- Riot account identifiers:
  - gameName
  - tagLine
  - puuid
- Steam identity model
- linking accounts to the same owner
- cache boundaries
- future highlights/achievements across sources
- public vs private dashboard concerns

Evidence to collect:

- data model diagram
- account lookup flow
- examples of normalized DTOs
- API/web boundary validation

Portfolio signal:

- ETL thinking
- domain modeling
- data aggregation
- product architecture

## Candidate write-up 3 — Frontend performance as a product feature

Potential title:

```text
Making a Gaming Dashboard Feel Fast: Route Splitting, Suspense, and Metrics
```

Topics:

- Vite bundle strategy
- route-level code splitting
- lazy-loaded Recharts
- `LazyMotion` setup
- Lighthouse
- web-vitals overlay
- bundle budgets
- skeleton loading
- reduced-motion support
- virtualization candidate for match list

Evidence to collect:

- Lighthouse score
- bundle analyzer output
- route chunk sizes
- before/after for lazy-loading charts
- web-vitals screenshots
- perf overlay screenshot

Portfolio signal:

- performance engineering
- React architecture
- measurable UX work

## Candidate write-up 4 — Motion without gimmicks

Potential title:

```text
Adding Motion to a Data Dashboard Without Making It Loud
```

Topics:

- calm aesthetic constraints
- reduced-motion handling
- route transitions
- splash backdrop
- card tilt
- count-up numbers
- chart entrance animations
- shared element transition candidate
- avoiding tacky effects

Evidence to collect:

- GIFs/screen recordings
- reduced-motion behavior
- performance before/after
- code examples around `LazyMotion`

Portfolio signal:

- frontend polish
- restraint
- accessibility
- product sensibility

## Candidate write-up 5 — Runtime validation

Potential title:

```text
Hardening a TypeScript API Boundary with Runtime Schemas
```

Topics:

- TypeScript types vs runtime data
- Riot API response trust boundary
- shared DTOs
- possible Zod schemas
- validation on API input/output
- client-side safety

Evidence to collect:

- examples of bad Riot data / missing fields
- schema snippets
- error mapping
- type inference from schemas

Portfolio signal:

- correctness
- API boundaries
- maintainability

## Candidate write-up 6 — Killing fullscreen-blur flicker on a 4K dashboard

Status: shipped. Write-up not yet drafted.

The splash backdrop layered five concurrent things on a near-fullscreen surface — `filter: blur(5px)` on the splash image, infinite Ken Burns transform, a 0.7 s opacity cross-fade keyed remount, an offsetX shift, and a fade-in opacity. On a 4K monitor this caused visible flicker during scroll-and-hover. The fix was a cluster, not one line.

Topics:

- CSS `filter: blur` cost on high-DPI / large viewports — the compositor re-rasterizes the blurred subtree every frame any transform animates underneath
- pushing the blur upstream into a CDN-side query (`wsrv.nl/?blur=N&output=webp`) so the browser composites a small pre-blurred bitmap with no live filter cost
- cached blurhash decode (one decode per hash, reused `<img>` element) replacing per-mount canvas paint via `react-blurhash`
- `useIsPresent` to settle infinite Ken Burns on exit instead of letting it run on outgoing layers during cross-fade
- 80 ms debounce on hover-driven champion changes so a quick mouse sweep over the match list doesn't remount the backdrop per row
- `fetchPriority="low"` on a decorative full-viewport image so it stops competing with LCP-relevant resources
- choosing wsrv.nl over self-hosting (~170 champion thumbnails) — preserves bundle/deploy footprint, with `<img onError>` fallback to the direct CDragon URL for graceful degradation
- byte and pixel-decode reductions on the card thumbnails: 89 KB JPG / 921k px → 7 KB WebP / 90k px, with identical centered crop framing

Evidence to collect:

- before/after frame-time captures during scroll+hover on a 4K display
- per-thumbnail byte and pixel-decode reduction tables
- network HAR before/after
- screenshots showing visually equivalent final result

Portfolio signal:

- compositor-level perf understanding, not just bundle-size cosmetics
- pragmatic third-party choices (wsrv.nl) over over-engineering an asset pipeline
- diagnostic discipline: enumerated six distinct suspects, ranked by impact, addressed the live-filter root cause first
- visible matter-of-fact perf engineering in a portfolio context

## README sections to grow incrementally

### Architecture

Include:

- web app
- API
- Postgres
- future Redis/BullMQ
- Riot API
- Steam API
- deploy environments

### Performance

Include:

- Lighthouse scores
- web-vitals
- route chunking
- lazy-loaded charting
- bundle budget

### Data model

Include:

- Summoner table
- Match table
- composite key `(matchId, puuid)`
- cache strategy

### Rate limiting

Include:

- Bottleneck limiters
- regional cluster handling
- friendly Riot error mapping

### Visual polish

Include:

- Motion usage
- screenshots/GIFs
- reduced-motion support

## Evidence checklist

Collect these before claiming things in README/write-ups:

- Lighthouse report
- bundle analyzer output
- HAR or network screenshots for API behavior
- web-vitals overlay screenshot
- cold vs warm fetch timings
- cache hit/miss examples
- test output
- screenshots/GIFs of major UI flows

## Writing style

Tone:

- technical
- honest
- specific
- evidence-backed

Avoid:

- generic startup-style copy
- "blazing fast" without metrics
- overclaiming
- hiding trade-offs

Prefer:

- "I chose X because Y, accepting Z trade-off"
- "Before: A, after: B"
- "This is intentionally overkill for a hobby app because it demonstrates C"
