# Open work index

One-line pointers into the owning notes. Read this first when scoping the next session — it answers "what's still open across the working notes" without re-scanning each doc.

**Maintenance rule:** when an item ships, descopes, splits, or promotes, edit this file in the same commit that lands the change. The detail lives in the owning note; this index only carries a one-line pointer and the current state. Entries here should never grow beyond a sentence.

**Companion index:** [parked.md](parked.md) carries the inverse — items deliberately set aside until a trigger condition holds. Read it when looking for "what could we revisit when the mood strikes."

---

## Tracked arcs — next action

- **Patch notes PN1 (next-up)** — version detection cron + wiki wikitext parse job + DB schema. No UI yet; validate by running manually. → [lol-patch-notes.md](lol-patch-notes.md)

- **LP forecast Phase LP2** — confidence calibration: validate that LP1's "directional only" verdicts correlate with outcomes once LP history has accrued; thread per-signal sample-size into weighting; add "How is this computed?" disclosure. Data-gated. → [lp-forecast.md](lp-forecast.md)
- **Personal-baselines PB4** — cross-tile anomaly aggregator. Deferred until at least 2–3 more personal-baseline tiles ship past the current set. (PB1 doc-pass + PB2 weakest-matchup + PB3 patch-drift all shipped 2026-05-14.) → [personal-baselines.md](personal-baselines.md)
- **Match-depth Phase E remainder** — full rune page panel; composite "Score-of-game" S+/S/A grade. Deprioritized polish. → [match-depth-roadmap.md](match-depth-roadmap.md)
- **Match-depth Phase D remainders** — squad detection (3+ groupings), LP-overlay graphs per duo, per-duo champion pairs, match-list duo highlight, D.2–D.7. → [match-depth-roadmap.md](match-depth-roadmap.md)
- **PG4 peer-route post-game artifact** — explicitly v2; gated on the PG1–PG3 Profile framing proving out. → [post-game-close-the-loop.md](post-game-close-the-loop.md)
- **App Phase 6 (optional)** — Mastery integration, multi-account compare, live-tab audit. → [app-state-analysis.md](app-state-analysis.md)
- **Home deck — next candidate tile** — chunks 1 + 2 shipped 2026-05-14 (bento + chronotype hero). Next change is the chronotype tile going cross-stream via Steam S8.2 (entry below). New candidate tiles per [home-deck.md](home-deck.md) + [self-portrait-surfaces.md](self-portrait-surfaces.md) once S8.2 lands.
- **Steam Phase S8 chunks 1–2 (next-up)** — **S7.D shipped 2026-05-16** (`TrophyCaseStrip` on `/steam` between `NowPlayingChip` and the chip grid; reuses `useCrossGameRarest` + owned-games join, sub-10% gate, deep-links into the per-game achievement panel — closes S7's headline-visibility gap). Remaining: S8.1 builds the Steam chronotype substrate on `/steam/achievements/signature`; S8.2 makes the `/home` chronotype tile actually cross-stream (LoL + Steam hour-bucketing), realizing the synthesis rule from `1a41fb1`. Each chunk independently committable. → [steam-integration.md § S7.D](steam-integration.md#phase-s7--achievement-signature-surfaces) + [§ S8 chunk plan](steam-integration.md#phase-s8--temporal--cross-stream)
- **Match cache storage Tier 1A** — **Fully shipped 2026-05-17.** Chunks A–C landed; `VACUUM FULL` recovered 152 MB (195 MB → 43 MB, 78% — 3× better than projected). Feature-ideation sweep complete → [lol-owner-data-features.md](lol-owner-data-features.md). Tiers 1B / 2 / 3 parked → [match-cache-storage.md](match-cache-storage.md)
- **Owner auth (pre-deploy)** — GitHub OAuth + `OwnerGuard` to gate the three unguarded status POSTs and forward-looking admin surfaces. Plan written 2026-05-14; deferred until pre-deploy sweep, not gated to Steam S2 finishing. → [owner-auth.md](owner-auth.md)

## Adjacent maintenance (sub-session each)

- Re-measure MatchWindowProvider + ChampionsPage memoization fixes in host Chrome (devcontainer can't). Not a coding task. → [perf-baseline.md](perf-baseline.md)
- Riot-investigation parked tail: per-account cache TTL self-healing, re-derive `reservoirIncreaseInterval` when prod-tier key lands, sync fairness if accounts ever run in parallel. → [riot-investigation-2026-05-07.md](riot-investigation-2026-05-07.md)
- CodeQL SAST evaluation — deferred from the 2026-05-14 security baseline; freelance-signal layer, not threat-model-justified. Revisit when bandwidth allows or auth surface lands. → [security.md](security.md)
- Folder-structure cleanup — Chunks 1 + 2 shipped 2026-05-14 (`lol-analytics.service.ts` extracted; `lol/_shared/` split into 6 non-asset buckets). Asset buckets deferred to the runtime-proxy pivot; Chunks 3 + 4 remain conditional (Steam subfoldering on S4.5 re-look, cross-domain `_assets/` only if TFT lands). → [folder-structure-cleanup.md](folder-structure-cleanup.md)
- LoL breadcrumb consistency pass — triggered post-Steam-S4.5 once the shadcn `@/components/ui/breadcrumb` primitive becomes canonical; decide per-surface whether deep drill-ins (match detail, champion detail) gain a breadcrumb trail alongside the existing `AccountLayout` tab bar. → [steam-integration.md](steam-integration.md) S4.5 post-ship follow-up
- Section layout extraction — fully shipped 2026-05-15. `_shared/section-layout/` primitive (`section-shell.tsx` + context + slide-direction hook); both LoL and Steam routes now compose `<SectionShell>` with identity/actions/nav slots. Tabs kept inline (per-section variation too wide). TFT will compose the same shell when it lands. → [section-layout-extraction.md](section-layout-extraction.md)

## Unpromoted vNext top-tier candidates

ARAM dashboard · cross-account unified identity · "Same day last year" · match annotations · weekly markdown digest · PDF/image export of match detail · Discord webhook · drag-to-reorder Profile · empty-state illustrations · View Transitions API spike. → [vnext-ideas.md](vnext-ideas.md)

## Case-study write-ups due (post-ship)

Twelve full case studies shipped: `bundling-the-bounded-cdn`, `riot-rate-limits`, `historical-backfill-and-sse`, `frontend-perf`, `operator-console`, `lp-history-postgres`, `fullscreen-blur-flicker`, `motion-without-gimmicks`, `pagination-partial-failure`, `visual-layer`, `build-time-champion-assets`, `og-card-satori`. Descoped: runtime-validation (Cand 5, never shipped). Deferred: ConclusionCard pattern (Cand 9, gated on post-game close-the-loop). → [case-study-topics.md](case-study-topics.md)
