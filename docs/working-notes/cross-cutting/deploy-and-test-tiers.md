# Deploy pipeline & tiered tests

**Status:** Draft — 2026-05-20. Captures the model agreed in conversation: commit-to-main stays, tags become the deploy + heavy-test seam. **Host is not locked in** — Hetzner is the leading candidate but no VPS has been bought yet; this note treats the deploy target as a single-VPS-shaped abstraction and leaves the provider decision to a dedicated chunk. No code yet; this note scopes the work and the open questions before the first chunk.

## The model in one paragraph

`main` is the integration branch — every commit runs a **fast lane** (lint, types, mocked unit tests, ~tens of seconds) so main stays buildable and the existing test discipline keeps its same-commit bar. **Tags** are the deploy unit and the only trigger for the **heavy lane** (real-Postgres Prisma integration tests, Playwright smoke against a built web bundle, upstream-fixture replay through the boundary schemas). A green tag pipeline pushes a versioned artifact to the chosen host and restarts the service; a red tag pipeline does not deploy and main is unaffected. Every `vX.Y.Z` tag is therefore a known-tested production state, recoverable by re-deploying the previous tag.

## Why this shape

- **No PR gate exists** (solo repo, commits-to-main is staying — see [[feedback-test-alongside-code]] for the testing bar this slots under). The natural alternative gate is "the moment I cut a release," i.e. a tag push.
- **Mock-heavy tests** (the current state — see [test-coverage-2026-05-18.md](./test-coverage-2026-05-18.md)) give fast feedback but lie at the seams: API ↔ Postgres, our types ↔ Riot/Steam/DDragon responses, web route loaders ↔ rendered output. The heavy lane is where those seams get exercised.
- **Slow tests on every commit get skipped under time pressure.** Gating them on tags means they only run when the owner has actually decided to ship — which is exactly when their cost is justified.
- **Tag = audit log.** For a solo repo, `git tag` is the closest thing to a deploy ledger. Promoting it from "useful afterthought" to "required for prod" is cheap and gives traceability for case-study writeups.
- **Broken main is briefly possible** between tags, but unreachable to production. Acceptable failure mode for a personal portfolio site; the safety net is tag CI, not main CI.

## Test stratification

### Fast lane (every commit on `main` — also runnable locally as `verify:cc`)

What it must catch: regressions in pure logic, type errors, lint drift, broken unit-level behavior. What it does **not** catch: contract drift, real-DB query mistakes, route-loader wiring, layout-level UI regressions.

- `biome ci .` (already `check:cc`)
- `pnpm -r typecheck` (already `typecheck:cc`)
- `pnpm -r test` with mocks (already `test:cc`) — Vitest unit suite across shared / api / web
- Target wall-clock: **under 60s on a warm cache**, so it can credibly run on every commit without becoming the thing you skip.

### Heavy lane (tag push only)

What it must catch: the seams the fast lane mocks past. Each tier should stay narrow and deterministic — a handful of high-leverage tests, not a mirror of the unit suite.

1. **API integration (real Postgres + Prisma)** — testcontainers spins up Postgres 16, runs `prisma migrate deploy`, then exercises the highest-risk surfaces:
   - Match write paths (mapper → persisted row → re-read shape), including the JSON columns where mocked tests cannot catch shape drift.
   - Backfill / reconcile jobs (`backfill-remake-flag` and similar) on a seeded dataset.
   - Analytics rollups that join across `match` + participant tables.
   Scope: **5–10 tests, not 100.** Each one must justify its seconds.

2. **Boundary-schema replay** — recorded fixtures of real Riot / Steam / DDragon responses parsed through the zod (or valibot) schemas wired in at each upstream parse site (see [Boundary validation layer](#boundary-validation-layer)). A schema mismatch fails the tag pipeline and surfaces contract drift before it ships. Fixtures refresh on a `schedule:` cron job that opens a PR with the new payloads (manual review + commit).

3. **Web smoke (Playwright)** — a small suite against a production build of `apps/web` pointed at a seeded API:
   - LoL profile loads, scroll-resets on path change, splash backdrop renders.
   - Match-detail tab switching (Recap / Your game / Timeline) shows the right skeleton variant.
   - Command palette opens via `⌘K`, filters matches, navigates and clears.
   - Steam library route renders without runtime errors.
   Scope: **the smoke fraction Playwright is good at, not full E2E.** ~6–10 tests, no auth flows, no real Riot/Steam calls.

4. **Lighthouse-CI budget check** (optional, opt-in) — fails the tag if FCP / TBT / bundle size regress past the budget recorded in [perf-baseline.md](./perf-baseline.md). Adds 30–60s and a flake risk; defer until the rest of the heavy lane is stable.

## Boundary validation layer

Prerequisite for the boundary-replay tier and a robustness improvement in its own right.

- At every site where an upstream response enters the system (Riot Match-V5, Riot Spectator-V5, Steam Web API endpoints, Steam PICS payloads, DDragon JSON), parse with a zod (or valibot) schema before the response touches domain code. The parsed type becomes the source of truth; raw `unknown` is never propagated.
- On parse failure: log structured `{ source, endpoint, error, sample }` and either fall back (cache hit, last-good) or fail loudly depending on criticality. Mocked unit tests already cover the happy path; the schema catches the shape drift the mocks can't.
- This shifts robustness from "synthetic fixture-replay test must catch it" to "production logs surface it the moment it happens" — the right shape for a solo deploy cadence where prod observability matters more than a merge gate.
- Replay tests in the heavy lane then become a *confidence check* against the same schemas, not the only line of defense.

Candidate libraries: `zod` (already familiar idiom), `valibot` (smaller bundle if any of this lands on the web side too). Decision deferred to the schema-introduction chunk.

## Pipeline definition

GitHub Actions, two workflow files.

### `.github/workflows/ci.yml` — fast lane

- **Triggers:** `push` to `main`, `pull_request` (in case PRs come back later).
- **Jobs:** single `verify` job — checkout, `pnpm install --frozen-lockfile`, `pnpm verify:cc`.
- **No deploy.** Red main is allowed but visible.

### `.github/workflows/release.yml` — heavy lane + deploy

- **Triggers:** `push` of a tag matching `v*.*.*`.
- **Jobs (sequential, each can fail the pipeline):**
  1. `verify` — same as fast lane (sanity).
  2. `integration` — boots Postgres service container, runs `pnpm test:integration` (script to be added; scoped to the integration suite, not the mocked one).
  3. `boundary-replay` — runs `pnpm test:boundary` against the recorded fixtures dir.
  4. `e2e` — `pnpm --filter @vyoh/web build`, boots the API + web preview, runs Playwright.
  5. `build-image` — builds the Docker image (api + web bundled, or two images — TBD in the Hetzner chunk), pushes to a registry tagged with the version.
  6. `deploy` — SSH into the host (provider TBD), pulls the tagged image, restarts via `docker compose pull && up -d` (or systemd unit, depending on chosen shape).
- **Rollback:** retag the previous version as `latest-rollback`, re-run the `deploy` job manually with that input. Tag history *is* the rollback log.

### `.github/workflows/fixtures-refresh.yml` — scheduled fixture refresh

- **Triggers:** weekly cron + `workflow_dispatch`.
- Pulls a fresh sample of real Riot / Steam / DDragon responses (read-only, owner's account), opens a PR with the diff. Manual review catches "this is real drift, update the schema" vs "this is noise."

## Host & deploy mechanics (provider TBD)

No VPS bought yet. The model below describes the *shape* the pipeline targets — anything provider-specific gets locked in during the host-selection chunk. The pipeline contract on this side is narrow: SSH access, a docker engine, the ability to pull from a registry. Anything past that is host detail.

**Leading candidate: Hetzner.** A CX-series VPS lines up with the cost/control sweet spot for a personal portfolio site, and the "EU-based, transparent pricing, no surprise egress bills" story is a clean freelance-credible signal. Not chosen — alternatives still on the table:

- **Hetzner** — leading. Cheap, EU, predictable, treats you like an adult.
- **Fly.io** — global edge for the API, postgres as a managed addon, image-based deploys map 1:1 to the tag-push model. Cost climbs faster; cold-start behavior less predictable for Nest.
- **Railway / Render** — even simpler deploy story, but lower architectural signal and historically pricier per-resource than Hetzner.
- **OVH / Scaleway** — comparable EU options to Hetzner; viable backup if Hetzner has a regional outage at decision time.
- **Cloudflare Workers / Pages + a managed Postgres** — would force a meaningful Nest refactor (Workers ≠ Node runtime in places); explicitly *not* on the path unless the architecture shifts.

Assumed shape (any host that satisfies it works):

- **Single VPS** with Docker + a reverse proxy (Caddy or Nginx) + automatic TLS via Let's Encrypt.
- **`docker compose`** stack: `api` (Nest), `web` (static bundle behind the proxy), `postgres` (volume-backed), maybe `redis` later when BullMQ actually lands.
- **No Kubernetes, no Pulumi, no Terraform** — a single VPS with a checked-in `docker-compose.yml` is the right complexity for a portfolio site and is itself a case-study point ("right-sized infra over default cloud sprawl").
- **Secrets**: `.env.production` lives on the box, never in the repo. The deploy job ships only the image; the box owns config.
- **DB migrations**: `prisma migrate deploy` runs in an init step of the `api` container on each deploy. Forward-only — solo owner controls all migrations.
- **Backups**: nightly `pg_dump` to off-box object storage (Hetzner Storage Box / B2 / R2 / S3 — picked alongside the host), retain 14 days. Restore drill documented in the deploy chunk.

## Tag conventions

- **Semver** (`vMAJOR.MINOR.PATCH`):
  - `PATCH`: bug fixes, copy tweaks, minor visual polish.
  - `MINOR`: new visible feature or surface (a new route, a new integration tile, a new palette mode).
  - `MAJOR`: rare — reserved for visible identity shifts (e.g. rebrand, structural redesign).
- **Pre-release**: `vX.Y.Z-rc.N` runs the full heavy lane but **does not deploy** (the deploy job gates on `!contains(tag, '-')`). Useful for verifying tag CI is green before promoting to a release tag.
- **Release notes**: GitHub Releases auto-populated from commit messages between tags. Promotes the existing `type: description` commit style into a useful changelog.

## Prerequisites before tag-gated deploys are comfortable

In rough order:

1. Boundary validation layer landed (schemas at all upstream parse sites + structured failure logging).
2. Postgres integration suite scaffolded with testcontainers; first 3–5 high-value tests passing locally.
3. Recorded fixtures committed (under `apps/api/test/fixtures/upstream/` or similar) + the refresh workflow.
4. Playwright smoke suite scaffolded; CI Playwright cache configured to keep the e2e job under ~2 min.
5. Hetzner VPS provisioned + `docker-compose.yml` committed; manual deploy verified once end-to-end before the workflow is wired.
6. The `ci.yml` fast-lane workflow committed and green for at least a week on `main` (catches anything CI-environment-specific before the heavy lane depends on the same primitives).
7. **Only then**: `release.yml` lands, first `v0.1.0` cut.

## Chunk plan

Each chunk independently committable; ordering matches the prerequisite list above.

1. **D1 — Boundary schemas: Riot.** Introduce zod, write schemas for the Riot endpoints actually consumed (Match-V5, Spectator-V5, Account-V1, Summoner-V4, League-V4). Wire at the parse sites in `apps/api/src/riot/`. Structured logging on parse failure. Same-commit unit tests for the schemas. No behavior change on happy path.
2. **D2 — Boundary schemas: Steam + DDragon.** Same shape as D1 for Steam Web API + PICS-derived JSON + DDragon. Smaller scope than Riot.
3. **D3 — Integration test scaffold.** Add testcontainers, `test:integration` script, `apps/api/test/integration/` directory with one canary test (Prisma → Postgres → re-read). Document the workflow in `docs/repo-conventions.md` if it needs portable rules.
4. **D4 — First integration tests.** 3–5 high-value tests: match write/read round-trip, JSON-column shape, one backfill, one analytics rollup. Strict bar: each test must catch a real class of bug the mocked suite cannot.
5. **D5 — Boundary replay tests.** Record one fixture per upstream endpoint, commit under `apps/api/test/fixtures/upstream/`, write `test:boundary` that runs each through its schema. Refresh workflow lands in the same chunk so the recording isn't a one-off.
6. **D6 — Playwright smoke.** Install `@playwright/test`, scaffold under `apps/web/test/e2e/`, write the smoke list above. Add `test:e2e` script. CI-only browser cache.
7. **D7 — Fast-lane CI workflow.** `.github/workflows/ci.yml`. Wait a week or two on green main before D8.
8. **D8 — Host selection + manual deploy.** Lock in the provider (Hetzner is the leading candidate but the decision happens here, with at least Fly.io as the considered alternative). VPS / equivalent up, `docker-compose.yml` committed under `infra/` or `deploy/`, secrets bootstrapped, manual deploy verified. No automation yet. Includes reverse-proxy config, Prisma migrate hook, pg_dump cron, backup restore drill. The host decision itself is worth a short ADR in [case-study-topics.md](./case-study-topics.md) — "EU single-VPS over edge-platform sprawl" is a real freelance-signal moment.
9. **D9 — Release workflow.** `.github/workflows/release.yml` wires the heavy lane + deploy job. First tag is `v0.1.0` once D9 is green on a release-candidate (`v0.1.0-rc.1`).
10. **D10 — Lighthouse-CI budget (optional).** Defer until the rest is stable.

## Open questions

- **Host provider**: Hetzner is leading but unbought; Fly.io / Render / Railway / OVH / Scaleway are alternatives still on the table. Decision in D8, with a short ADR captured in the same chunk.
- **Image strategy**: single image (api + web served by api in prod) vs two images. Affects reverse-proxy config and the build matrix. Decision in D8.
- **Web hosting**: serve `apps/web` from the same VPS (simpler, one less moving part) vs Cloudflare Pages / Vercel for the static bundle (better edge perf, more freelance-credible cache story but more infra surface). Decision in D8 — partly dependent on the host pick.
- **Boundary library**: zod vs valibot. Decide at the start of D1 — depends on whether we want the schemas reusable on the web side.
- **Lighthouse budgets**: D10 only if [perf-baseline.md](./perf-baseline.md) has real budgets locked in by then.
- **Branch protection on `main`**: do we want it to require `ci.yml` green? Solo-friendly answer is probably "no, push directly, fix forward" but worth a moment.

## Related notes

- [test-coverage-2026-05-18.md](./test-coverage-2026-05-18.md) — current mocked-test state and what was covered in the recent sweep.
- [perf-baseline.md](./perf-baseline.md) — perf budgets the Lighthouse-CI tier would gate on.
- [project-hygiene-2026-05-18.md](./project-hygiene-2026-05-18.md) — prior hygiene wave that the current testing bar emerged from.
- [case-study-topics.md](./case-study-topics.md) — "right-sized infra: single-VPS Docker over default cloud sprawl" is a natural addition once D8 lands.
