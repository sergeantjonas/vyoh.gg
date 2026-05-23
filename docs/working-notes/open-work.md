# Open work index

**Status:** Index — canonical list of tracked arcs and their next action.

One-line pointers into the owning notes. Read this first when scoping the next session — it answers "what's still open across the working notes" without re-scanning each doc.

**Maintenance rule:** when an item ships, descopes, splits, or promotes, edit this file in the same commit that lands the change. The detail lives in the owning note; this index only carries a one-line pointer and the current state. Entries here should never grow beyond a sentence.

**Status-header convention:** every note in `working-notes/` carries a `**Status:** <Active|Shipped|Parked|Reference|Index> — <one-line>` header right under the H1, updated in the same commit as state changes. Skim-scanning the folder should reveal active arcs without opening each doc. Fully-shipped notes whose planning detail is no longer load-bearing live in [archive/](archive/) instead of here.

**Companion index:** [parked.md](parked.md) carries the inverse — items deliberately set aside until a trigger condition holds. Read it when looking for "what could we revisit when the mood strikes."

---

## Tracked arcs — next action

### LoL surfaces

- **Champion list ↔ detail navigation parity** — choreography gap surfaced 2026-05-23: match flow has breadcrumb-back, scroll-position memory, and origin-rect-driven hero morph on return; champion flow has only the shared layoutId. 6-chunk plan written, mostly mirrors `ActiveMatchProvider`. → [champion-nav-parity.md](lol/champion-nav-parity.md)
- **Match-depth Phase D remainders** — squad detection (3+ groupings), LP-overlay graphs per duo, per-duo champion pairs, match-list duo highlight, D.2–D.7. → [match-depth-roadmap.md](lol/match-depth-roadmap.md)
- **Match-depth Phase E remainder** — full rune page panel (MD2 in owner-data catalog); composite "Score-of-game" S+/S/A grade. Deprioritized polish. → [match-depth-roadmap.md](lol/match-depth-roadmap.md)
- **LP forecast Phase LP3 (personal linear fit)** — LP2 (calibration) + LP2.6 (threshold tuning) + LP2.7 (slot warning suppression) shipped 2026-05-20. Agurin's calibration first showed two stuck-positive signals (tilt/champ); LP2.6 re-threshold-ed them against the player's overall WR. The follow-up calibration then exposed slot warnings as anti-predictive (29% directional accuracy on 41 fires) — LP2.7 dropped the warning polarity. LP2.5 (per-signal weighting) parked until a re-run shows variance per signal. LP3 (personal linear fit) still long-tail. → [lp-forecast.md](lol/lp-forecast.md)

### Cross-cutting

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
- OG image follow-up — head baseline shipped 2026-05-23 without `og:image`; placeholder would have been worse than absence. Capture a 1200×630 screenshot of `/` (or another marquee surface) once one is polished enough, drop to `apps/web/public/og.png`, add the `og:image` meta tags. ~10 min. → [frontend-2026-gaps.md § Gap 1 Follow-up](cross-cutting/frontend-2026-gaps.md)
- Frontend-2026 KB gaps — Round 1: A's head-baseline portion SHIPPED 2026-05-23 (c6c3720; OG image still pending a marquee surface to screenshot), A's LCP-element fetchpriority still pending re-measure; B (React Compiler) SHIPPED 2026-05-23 (0e8800c); C (app-root + widget error boundaries) ready as sub-session; D (RUM backend) post-launch; E (route-tier boundaries) folds into Start migration. Round 2 added 2026-05-22 — F (color-scheme + container-query pilot), G (charting decision tree docs), H (Radix import consolidation) — all still ready. Round 4 added 2026-05-23: M (static-metadata `staleTime: Infinity`) SHIPPED 2026-05-23 (c68026a); most patch-keyed hooks were already pinned by the 2026-05-21 static-metadata arc. Round 5 added 2026-05-23 (frameworks sweep): **O (`head()` localhost bug fix — ~15 min, urgent — broken social previews in prod) ready now, N (route loader pilot on match-detail, ~1h, migration-safe Start prep) ready now, P (loader + `head()` fan-out across detail routes, ~5h multi-commit) sub-arc to schedule after N + O land**. Gap #5 corrected — splash isn't LCP. → [frontend-2026-gaps.md](cross-cutting/frontend-2026-gaps.md)
- TanStack Start + SSR migration — parked structural arc; gated to pre-launch sweep alongside owner-auth + hosting. Trigger: MR3/MR4 + PN1–PN4 shipped, TFT shape decided, before owner-auth started. → [tanstack-start-migration.md](cross-cutting/tanstack-start-migration.md)

### Ops

- CodeQL SAST evaluation — deferred from the 2026-05-14 security baseline; freelance-signal layer, not threat-model-justified. Revisit when bandwidth allows or auth surface lands. → [security.md](ops/security.md)
- Folder-structure cleanup — Chunks 1 + 2 shipped 2026-05-14 (`lol-analytics.service.ts` extracted; `lol/_shared/` split into 6 non-asset buckets). Asset buckets deferred to the runtime-proxy pivot; Chunks 3 + 4 remain conditional (Steam subfoldering on S4.5 re-look, cross-domain `_assets/` only if TFT lands). → [folder-structure-cleanup.md](ops/folder-structure-cleanup.md)

## Unpromoted vNext top-tier candidates

ARAM dashboard · cross-account unified identity · "Same day last year" · match annotations · weekly markdown digest · PDF/image export of match detail · Discord webhook · drag-to-reorder Profile · View Transitions API spike. → [vnext-ideas.md](cross-cutting/vnext-ideas.md)

## Case-study backlog

No active write-ups queued. Shipped inventory: [../case-studies/](../case-studies/) (19 case studies as of 2026-05-19). Topics catalog: [case-study-topics.md](cross-cutting/case-study-topics.md).
