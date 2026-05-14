# Open work index

One-line pointers into the owning notes. Read this first when scoping the next session — it answers "what's still open across the working notes" without re-scanning each doc.

**Maintenance rule:** when an item ships, descopes, splits, or promotes, edit this file in the same commit that lands the change. The detail lives in the owning note; this index only carries a one-line pointer and the current state. Entries here should never grow beyond a sentence.

---

## Tracked arcs — next action

- **LP forecast Phase LP2** — confidence calibration: validate that LP1's "directional only" verdicts correlate with outcomes once LP history has accrued; thread per-signal sample-size into weighting; add "How is this computed?" disclosure. Data-gated. → [lp-forecast.md](lp-forecast.md)
- **Recap density Phase 5** — add 3–5 sections (most-improved champ, signature game, worst/best patch, duo-of-year); decide on share-image + scrollytelling polish. 1–2 sessions. → [app-state-analysis.md](app-state-analysis.md)
- **Personal-baselines PB4** — cross-tile anomaly aggregator. Deferred until at least 2–3 more personal-baseline tiles ship past the current set. (PB1 doc-pass + PB2 weakest-matchup + PB3 patch-drift all shipped 2026-05-14.) → [personal-baselines.md](personal-baselines.md)
- **Match-depth Phase E remainder** — full rune page panel; composite "Score-of-game" S+/S/A grade. Deprioritized polish. → [match-depth-roadmap.md](match-depth-roadmap.md)
- **Match-depth Phase D remainders** — squad detection (3+ groupings), LP-overlay graphs per duo, per-duo champion pairs, match-list duo highlight, D.2–D.7. → [match-depth-roadmap.md](match-depth-roadmap.md)
- **PG4 peer-route post-game artifact** — explicitly v2; gated on the PG1–PG3 Profile framing proving out. → [post-game-close-the-loop.md](post-game-close-the-loop.md)
- **App Phase 6 (optional)** — Mastery integration, multi-account compare, live-tab audit. → [app-state-analysis.md](app-state-analysis.md)

## Adjacent maintenance (sub-session each)

- Verify SSE refresh-progress shipped (likely covered by `00d085c`); close or keep the parked follow-up. → [riot-investigation-2026-05-07.md](riot-investigation-2026-05-07.md)
- Strike the stale `feedback_visx_minimap` line from the 2026-05-11 visx decision-log entry. → [vnext-ideas.md](vnext-ideas.md)
- Re-measure MatchWindowProvider + ChampionsPage memoization fixes in host Chrome (devcontainer can't). Not a coding task. → [perf-baseline.md](perf-baseline.md)
- Riot-investigation parked tail: per-account cache TTL self-healing, re-derive `reservoirIncreaseInterval` when prod-tier key lands, sync fairness if accounts ever run in parallel. → [riot-investigation-2026-05-07.md](riot-investigation-2026-05-07.md)

## Unpromoted vNext top-tier candidates

ARAM dashboard · cross-account unified identity · "Same day last year" · match annotations · weekly markdown digest · PDF/image export of match detail · Discord webhook · drag-to-reorder Profile · empty-state illustrations · View Transitions API spike. → [vnext-ideas.md](vnext-ideas.md)

## Case-study write-ups due (post-ship)

Twelve full case studies shipped: `bundling-the-bounded-cdn`, `riot-rate-limits`, `historical-backfill-and-sse`, `frontend-perf`, `operator-console`, `lp-history-postgres`, `fullscreen-blur-flicker`, `motion-without-gimmicks`, `pagination-partial-failure`, `visual-layer`, `build-time-champion-assets`, `og-card-satori`. Descoped: runtime-validation (Cand 5, never shipped). Deferred: ConclusionCard pattern (Cand 9, gated on post-game close-the-loop). → [case-study-topics.md](case-study-topics.md)
