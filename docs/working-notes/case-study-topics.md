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

Potential title:

```text
Building a Riot API Backfill Pipeline Without Melting Rate Limits
```

Topics:

- Riot API constraints
- regional routing
- Bottleneck limiters
- chained limiters:
  - 20 req/s
  - 100 req/2 min
- per-summoner Postgres cache
- partial fetches
- retries/failures
- future Redis/BullMQ worker model
- possible SSE progress streaming

Evidence to collect:

- before/after request counts
- cache hit rate
- worst-case cold fetch timing
- warm fetch timing
- API error handling examples

Portfolio signal:

- systems thinking
- external API integration
- data freshness vs rate-limit constraints
- user experience under slow backfills

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
