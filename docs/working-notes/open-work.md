# Open work index

**Status:** Index — canonical list of tracked arcs and their next action.

One-line pointers into the owning notes. Read this first when scoping the next session — it answers "what's still open across the working notes" without re-scanning each doc.

**Maintenance rule:** when an item ships, descopes, splits, or promotes, edit this file in the same commit that lands the change. The detail lives in the owning note; this index only carries a one-line pointer and the current state. Entries here should never grow beyond a sentence.

**Status-header convention:** every note in `working-notes/` carries a `**Status:** <Active|Shipped|Parked|Reference|Index> — <one-line>` header right under the H1, updated in the same commit as state changes. Skim-scanning the folder should reveal active arcs without opening each doc. Fully-shipped notes whose planning detail is no longer load-bearing live in [archive/](archive/) instead of here.

**Companion index:** [parked.md](parked.md) carries the inverse — items deliberately set aside until a trigger condition holds. Read it when looking for "what could we revisit when the mood strikes."

---

## Tracked arcs — next action

### LoL surfaces

- **Match-detail section nav MDN5** — soft re-evaluation of the Recap / Your game / Timeline grouping after the queued owner-data additions land (spell casts, damage profile, CC time, multikills, rune page, etc.). MDN1–MDN4 shipped 2026-05-17; tab URL state migrated from `?tab=` search param to nested path segments on 2026-05-18. → [match-detail-section-nav.md](lol/match-detail-section-nav.md)
- **Match-depth Phase D remainders** — squad detection (3+ groupings), LP-overlay graphs per duo, per-duo champion pairs, match-list duo highlight, D.2–D.7. → [match-depth-roadmap.md](lol/match-depth-roadmap.md)
- **Match-depth Phase E remainder** — full rune page panel; composite "Score-of-game" S+/S/A grade. Deprioritized polish. → [match-depth-roadmap.md](lol/match-depth-roadmap.md)
- **LP forecast Phase LP2** — confidence calibration: validate that LP1's "directional only" verdicts correlate with outcomes once LP history has accrued; thread per-signal sample-size into weighting; add "How is this computed?" disclosure. Data-gated. → [lp-forecast.md](lol/lp-forecast.md)
- **Personal-baselines PB4** — cross-tile anomaly aggregator. Deferred until at least 2–3 more personal-baseline tiles ship past the current set. (PB1 doc-pass + PB2 weakest-matchup + PB3 patch-drift all shipped 2026-05-14.) → [personal-baselines.md](lol/personal-baselines.md)
- **PG4 peer-route post-game artifact** — explicitly v2; gated on the PG1–PG3 Profile framing proving out. → [post-game-close-the-loop.md](lol/post-game-close-the-loop.md)

### Cross-cutting

- **Wiki-image migration tail** — 12 files across matches (3), profile (2), champions (2), shared analytics + assets (3), live tab, and `components/game-icons.tsx` still resolve images client-side through `cdn.communitydragon.org`/`raw.communitydragon.org`; target end state is zero CDragon client usages, all routes through the wiki via `wikiEntryIconUrl()`. Direction confirmed 2026-05-17 during PN7; ability-icon URL pattern needs a spot check before migration starts. → [lol-image-pipeline.md § Wiki as canonical image source](lol/lol-image-pipeline.md#wiki-as-canonical-image-source-confirmed-direction-2026-05-17)
- **Command palette expansion (E)** — Phases A (nav chip), B (match search), C (parser + chips), D1 (champion mode), D2 (cross-account scope) shipped 2026-05-18. Next: E recents persistence in localStorage. → [command-palette.md](cross-cutting/command-palette.md)
- **App Phase 6 (optional)** — Mastery integration, multi-account compare, live-tab audit. → [app-state-analysis.md](lol/app-state-analysis.md)

### Pre-deploy / admin

- **Owner auth (pre-deploy)** — GitHub OAuth + `OwnerGuard` to gate the three unguarded status POSTs and forward-looking admin surfaces (including the new status-page triggers below). Plan written 2026-05-14; deferred until pre-deploy sweep, not gated to Steam S2 finishing. → [owner-auth.md](ops/owner-auth.md)
- **Status page admin surface** — (a) surface Steam sync status/progress alongside the existing LoL sync rows; (b) add manually-triggerable LoL sync actions (patch note fetch, future: backfills) as explicit buttons/endpoints in the status page. Gate both behind GitHub OAuth (depends on the owner-auth item above) before exposing. → [owner-auth.md](ops/owner-auth.md)
- **API ValidationPipe V3** — V1 (global pipe) + V2 (GET param DTOs) shipped 2026-05-18; V3 covers POST/PUT/PATCH bodies and sequences with owner-auth. → [project-hygiene-2026-05-18.md § Chunked plan](cross-cutting/project-hygiene-2026-05-18.md#chunked-plan-2026-05-18)

## Adjacent maintenance (sub-session each)

### LoL surfaces

- Riot-investigation parked tail: per-account cache TTL self-healing, re-derive `reservoirIncreaseInterval` when prod-tier key lands, sync fairness if accounts ever run in parallel. → [riot-investigation-2026-05-07.md](lol/riot-investigation-2026-05-07.md)
- LoL breadcrumb consistency pass — triggered post-Steam-S4.5 once the shadcn `@/components/ui/breadcrumb` primitive becomes canonical; decide per-surface whether deep drill-ins (match detail, champion detail) gain a breadcrumb trail alongside the existing `AccountLayout` tab bar. → [steam-integration.md](steam/steam-integration.md) S4.5 post-ship follow-up

### Cross-cutting

- Re-measure MatchWindowProvider + ChampionsPage memoization fixes in host Chrome (devcontainer can't). Not a coding task. → [perf-baseline.md](cross-cutting/perf-baseline.md)
- **Test coverage expansion C1 → W3** — coverage instrumentation, then shared package tests (zero today), then api `img/` gap, then targeted web component tests. 9 chunks, ~3-5 sessions. Highest leverage chunk is S2 (shared invariants + formatters). → [test-coverage-2026-05-18.md](cross-cutting/test-coverage-2026-05-18.md)

### Ops

- CodeQL SAST evaluation — deferred from the 2026-05-14 security baseline; freelance-signal layer, not threat-model-justified. Revisit when bandwidth allows or auth surface lands. → [security.md](ops/security.md)
- Folder-structure cleanup — Chunks 1 + 2 shipped 2026-05-14 (`lol-analytics.service.ts` extracted; `lol/_shared/` split into 6 non-asset buckets). Asset buckets deferred to the runtime-proxy pivot; Chunks 3 + 4 remain conditional (Steam subfoldering on S4.5 re-look, cross-domain `_assets/` only if TFT lands). → [folder-structure-cleanup.md](ops/folder-structure-cleanup.md)

## Unpromoted vNext top-tier candidates

ARAM dashboard · cross-account unified identity · "Same day last year" · match annotations · weekly markdown digest · PDF/image export of match detail · Discord webhook · drag-to-reorder Profile · View Transitions API spike. → [vnext-ideas.md](cross-cutting/vnext-ideas.md)

## Case-study backlog

No active write-ups queued. Shipped inventory: [../case-studies/](../case-studies/) (14 case studies as of 2026-05-17). Topics catalog: [case-study-topics.md](cross-cutting/case-study-topics.md).
