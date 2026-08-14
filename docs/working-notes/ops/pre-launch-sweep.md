# Pre-launch sweep — gates before vyoh.gg serves real traffic

**Status:** Active — gate list assembled 2026-08-01 from the docs survey's prod-risk pass. **Eight of the eleven gates are closed as of 2026-08-13, and no remaining gate is code.** Owner auth was the last repo-side one; chunks 1 and 2 both landed that day. Backups, DNS/`VITE_API_URL` and branch protection all need the box or the GitHub settings page rather than the repo. **Launch is blocked on buying the VPS and nothing else.** This note is the canonical ordering of everything that must land before or alongside that, plus the standing rules that change once prod exists. One-line pointers only — detail lives in the owning notes, and items are struck here in the same commit that lands them.

Two gates were re-audited on 2026-08-13 after reading as open for longer than they were: the strike is the trail of evidence, so if a gate here looks open, confirm it against the code before scoping work around it.

Several notes reference "the pre-launch sweep" as one deliberate arc; this file is that arc's checklist. [hosting.md](hosting.md) owns the deploy machinery — its checklist items 4–6 are gates here by reference.

## Launch gates — public traffic before these = incident

| Gate | Why it can't wait | Owner |
|---|---|---|
| ~~Owner auth~~ | **Closed 2026-08-13 (chunks 1 + 2).** All four mutating routes — the three status POSTs and the per-account sync trigger — carry `@UseGuards(OwnerGuard)` and answer 401 without an owner session; `conventions.spec.ts` pins the decorator to each by name. Chunk 3 is prod OAuth app + env on the box, not code. | [owner-auth.md](owner-auth.md) |
| ~~Owner allowlist on the three ungated LoL routes~~ | **Closed 2026-08-03/05 (F-1).** The check moved into `resolveSummoner` itself, so it is a choke point rather than a 28th hand-written call site, and `conventions.spec.ts` pins it there. | [api-exposure-audit.md § F-1](api-exposure-audit.md) |
| ~~Clamp the match miss-path to owner data~~ | **Closed 2026-08-03/05 (F-2).** | [api-exposure-audit.md § F-2](api-exposure-audit.md) |
| ~~Rate limiting at the edge~~ | **Closed 2026-08-03/05 (F-4).** nginx config committed and behaviourally tested; `limit_req_zone` must be installed to `conf.d/` before the vhost that references it. | [api-exposure-audit.md § F-4](api-exposure-audit.md) |
| ~~Validate `tier`, cap redirects, key the `/img` cache~~ | **Closed 2026-08-03/05 (F-7–F-9).** | [api-exposure-audit.md § F-7–F-9](api-exposure-audit.md) |
| ~~Generic error text in `/status`~~ | **Closed 2026-08-03/05 (F-13).** | [api-exposure-audit.md § F-13](api-exposure-audit.md) |
| ~~ValidationPipe V3 (POST/PUT/PATCH bodies)~~ | **Verified closed 2026-08-13.** A global `ValidationPipe({ transform, whitelist, forbidNonWhitelisted })` is installed in `main.ts`, and all five write routes bind DTOs or no body at all (the only `@Body` is `NarrativeWindowDto`). | [project-hygiene-2026-05-18.md § Chunked plan](../cross-cutting/project-hygiene-2026-05-18.md) |
| Backups live + one restore drill | The Postgres volume is the only irreplaceable artefact in the stack — LP-history snapshots, Steam playtime snapshots, and matches beyond Riot's retention window cannot be re-fetched. | [hosting.md § 6](hosting.md) |
| DNS + `VITE_API_URL`; CORS/env re-verified on the real box | hosting checklist item 4; items 2–3 shipped in code but their values get set for real here. | [hosting.md](hosting.md) |
| ~~timeZone pinned in the date formatters (~25 sites)~~ | **Verified closed 2026-08-13** — 0 of 37 date-formatter call sites across 28 files lack a `timeZone`. The "~25 sites" figure predates the sweep that fixed them. Note the audit must exclude `Number.prototype.toLocaleString`: five files match a naive `toLocaleString` grep while formatting counts, not dates. | [open-work.md § Pre-deploy](../open-work.md) · [tanstack-start-migration.md](../cross-cutting/tanstack-start-migration.md) |
| Branch protection on `main` | Decided 2026-07-26: enable as part of this sweep, at which point direct-push stops being appropriate anyway. | [open-work.md § Pre-deploy](../open-work.md) |

Same sweep window, but needs the live box rather than the repo: verify SSE in production ([hosting.md § 5](hosting.md)).

~~**Not a launch gate — already live.** The Steam API key is written to the api's own logs in cleartext whenever a Steam fetch fails.~~ **Fixed 2026-08-03** — `fetchJson` now redacts the query string for every log line and both error constructions. → [api-exposure-audit.md § F-5](api-exposure-audit.md)

## Cheaper before launch than against live data

- ~~**Accounts-admin chunk 1** (accounts.json → `LolAccount`/`SteamAccount` tables)~~ — taken pre-launch as intended, shipped 2026-08-14 as a clean seed migration rather than a live-data cutover. Chunks 2–3 remain, unblocked since owner-auth shipped 2026-08-13, and carry no launch coupling. → [accounts-admin.md](accounts-admin.md)
- ~~Queue-id migration chunks 3a/3b~~ — resolved pre-launch 2026-08-01: the `queueType` column and wire field are already dropped. Remaining chunk 4 is additive map entries, no launch coupling. → [queue-id-migration.md](../lol/queue-id-migration.md)

## Standing rules once prod exists (risk-class changes, not gates)

- **Destructive data arcs gate on backups.** Match-cache tiers 1B/2/3 and the Tier-5 TTL eviction are irreversible transforms, and their trigger (DB size pressure) is precisely a prod condition. None of them runs without a verified restore. The accounts arc's per-account purge (chunk 3) joins this class — same rule, different trigger: it is owner-initiated rather than size-driven, which makes it easier to fire by accident, not harder. → [match-cache-storage.md](../lol/match-cache-storage.md) · [accounts-admin.md](accounts-admin.md)
- **Heavy backfills share the prod box and the Riot budget.** A7's eager description backfill and the SSE/BullMQ backfill follow-ups compete with live traffic on one VPS: off-peak, or behind a queue when BullMQ lands. → [description-image-rendering.md](../steam/description-image-rendering.md) · [project-history.md § Parked follow-ups](../project-history.md)
- **Wire-shape changes deploy api+web together.** SSR bakes `@vyoh/shared` types into the web server at build time; `compose.prod.yaml` deploys both services, so never ship a wire change as a single-service deploy.
- **Loader/priming discipline now has ranking stakes.** The per-route payload questions in [repo-conventions.md § "Server-render the routes a crawler cares about"](../../repo-conventions.md) apply with real LCP consequences once crawlers and visitors are real.

## Post-launch (blocked on being live, not on the repo)

- RUM backend (frontend-2026 Gap 3) once there are weekly visitors worth analyzing. → [frontend-2026-gaps.md](../cross-cutting/frontend-2026-gaps.md)
- CodeQL evaluation — its stated trigger ("auth surface lands") fires during this sweep. → [security.md](security.md)
- Prod-tier Riot key follow-ups: re-derive `reservoirIncreaseInterval`; visitor-vs-owner stays hard-gated on the key itself. → [riot-investigation-2026-05-07.md](../lol/riot-investigation-2026-05-07.md)
