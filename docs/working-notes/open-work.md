# Open work index

One-line pointers into the owning notes. Read this first when scoping the next session — it answers "what's still open across the working notes" without re-scanning each doc.

**Maintenance rule:** when an item ships, descopes, splits, or promotes, edit this file in the same commit that lands the change. The detail lives in the owning note; this index only carries a one-line pointer and the current state. Entries here should never grow beyond a sentence.

---

## Tracked arcs — next action

- **LP forecast Phase LP2** — confidence calibration: validate that LP1's "directional only" verdicts correlate with outcomes once LP history has accrued; thread per-signal sample-size into weighting; add "How is this computed?" disclosure. Data-gated. → [lp-forecast.md](lp-forecast.md)
- **Personal-baselines PB4** — cross-tile anomaly aggregator. Deferred until at least 2–3 more personal-baseline tiles ship past the current set. (PB1 doc-pass + PB2 weakest-matchup + PB3 patch-drift all shipped 2026-05-14.) → [personal-baselines.md](personal-baselines.md)
- **Match-depth Phase E remainder** — full rune page panel; composite "Score-of-game" S+/S/A grade. Deprioritized polish. → [match-depth-roadmap.md](match-depth-roadmap.md)
- **Match-depth Phase D remainders** — squad detection (3+ groupings), LP-overlay graphs per duo, per-duo champion pairs, match-list duo highlight, D.2–D.7. → [match-depth-roadmap.md](match-depth-roadmap.md)
- **PG4 peer-route post-game artifact** — explicitly v2; gated on the PG1–PG3 Profile framing proving out. → [post-game-close-the-loop.md](post-game-close-the-loop.md)
- **App Phase 6 (optional)** — Mastery integration, multi-account compare, live-tab audit. → [app-state-analysis.md](app-state-analysis.md)
- **Home deck — next tile** — chunks 1 and 2 shipped 2026-05-14 (bento + minimum-viable tile set, then chronotype 2×2 hero with Europe/Brussels hour bucketing). Next surface candidate(s) per the parent self-portrait note. → [home-deck.md](home-deck.md)
- **Steam Phase S4.5 (next) — Navigation + visual baseline** — inserted between S4 substrate and S5 achievement-surfaces so the achievement UI lands into a real IA, not the current card-grid shell. S1+S2+S3 shipped 2026-05-14 (S3 closed with forever-games drill-in `88896d1` backend + `d3d1806` frontend). S4.5 numbered as half-step to keep `lol-image-pipeline.md` "after Steam S5" reference stable. → [steam-integration.md](steam-integration.md)
- **Asset-pipeline pivot to runtime proxy** — content-driven deploys are a smell (new LoL champion, Steam wishlist add). Decision 2026-05-14 to pivot LoL + Steam image handling onto a server-side proxy with stale-while-revalidate cache; reverses the Parked-section "Backend image proxy" decision from 2026-05-10. Sequenced after Steam S5 — validate bundled approach against achievement-icon scale first, then retire it with empirical evidence. → [lol-image-pipeline.md](lol-image-pipeline.md#phase-4--runtime-image-proxy-planned-multi-stream)
- **Owner auth (pre-deploy)** — GitHub OAuth + `OwnerGuard` to gate the three unguarded status POSTs and forward-looking admin surfaces. Plan written 2026-05-14; deferred until pre-deploy sweep, not gated to Steam S2 finishing. → [owner-auth.md](owner-auth.md)

## Adjacent maintenance (sub-session each)

- Re-measure MatchWindowProvider + ChampionsPage memoization fixes in host Chrome (devcontainer can't). Not a coding task. → [perf-baseline.md](perf-baseline.md)
- Riot-investigation parked tail: per-account cache TTL self-healing, re-derive `reservoirIncreaseInterval` when prod-tier key lands, sync fairness if accounts ever run in parallel. → [riot-investigation-2026-05-07.md](riot-investigation-2026-05-07.md)
- CodeQL SAST evaluation — deferred from the 2026-05-14 security baseline; freelance-signal layer, not threat-model-justified. Revisit when bandwidth allows or auth surface lands. → [security.md](security.md)
- Folder-structure cleanup — Chunks 1 + 2 shipped 2026-05-14 (`lol-analytics.service.ts` extracted; `lol/_shared/` split into 6 non-asset buckets). Asset buckets deferred to the runtime-proxy pivot; Chunks 3 + 4 remain conditional (Steam subfoldering on S4.5 re-look, cross-domain `_assets/` only if TFT lands). → [folder-structure-cleanup.md](folder-structure-cleanup.md)
- LoL breadcrumb consistency pass — triggered post-Steam-S4.5 once the shadcn `@/components/ui/breadcrumb` primitive becomes canonical; decide per-surface whether deep drill-ins (match detail, champion detail) gain a breadcrumb trail alongside the existing `AccountLayout` tab bar. → [steam-integration.md](steam-integration.md) S4.5 post-ship follow-up
- Section layout extraction — pull the sticky compact header + animated tabs + page-slide system shared between `routes/lol/$accountSlug.tsx` and `routes/steam.tsx` into an `_shared/section-layout/` primitive. Surfaced during S4.5 C-1; deferred until C-2/C-3 land so the identity slot's shape is informed by the profile-background + animated-avatar work. → [section-layout-extraction.md](section-layout-extraction.md)

## Unpromoted vNext top-tier candidates

ARAM dashboard · cross-account unified identity · "Same day last year" · match annotations · weekly markdown digest · PDF/image export of match detail · Discord webhook · drag-to-reorder Profile · empty-state illustrations · View Transitions API spike. → [vnext-ideas.md](vnext-ideas.md)

## Case-study write-ups due (post-ship)

Twelve full case studies shipped: `bundling-the-bounded-cdn`, `riot-rate-limits`, `historical-backfill-and-sse`, `frontend-perf`, `operator-console`, `lp-history-postgres`, `fullscreen-blur-flicker`, `motion-without-gimmicks`, `pagination-partial-failure`, `visual-layer`, `build-time-champion-assets`, `og-card-satori`. Descoped: runtime-validation (Cand 5, never shipped). Deferred: ConclusionCard pattern (Cand 9, gated on post-game close-the-loop). → [case-study-topics.md](case-study-topics.md)
