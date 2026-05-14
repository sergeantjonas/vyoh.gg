# TFT integration

A working note for the planned TFT (Teamfight Tactics) integration. Stated cadence (owner, 2026-05-14): **warm but not urgent** — owner played TFT heavily in earlier sets but is not playing the current set, so promoting this is a "when it's cheap, not when it's urgent" move. Steam ([steam-integration.md](steam-integration.md)) is the more committed near-term arc.

TFT shares the Riot API key, rate-limiter (Bottleneck reservoir), and authentication scaffolding already in place for LoL. It's a separate `match-v5` endpoint family with TFT-specific match shape, and it's a separate ranked queue. **Architectural rule: share the recap / `ConclusionCard` engine and the rate-limiter; do not build TFT as a parallel system.** Same engine, second timeseries source — same rule as Steam.

Sibling docs: [self-portrait-surfaces.md](self-portrait-surfaces.md) (parent reframe — TFT panels are part of the self-portrait engine), [steam-integration.md](steam-integration.md) (mirror structure, more committed cadence).

---

## Status

- **Warm, not urgent.** Owner is not actively playing the current TFT set; do not propose starting this ahead of LoL feature work or Steam integration.
- **Lowest activation cost of any "new game" integration.** Riot key, rate-limiter, asset pipeline, puuid model all already exist — TFT lights up by adding the new match endpoint and a TFT-specific match schema.
- **Strongest narrative payoff:** the cross-game framing. "Same player across LoL and TFT" is the visible move that lifts vyoh.gg from "LoL stats" to "Riot account portrait."

---

## Candidate surfaces (when scoping begins)

None committed — listed for when work starts:

- **Ranked timeseries.** TFT LP / rank history, same chart shape as LoL LP history. Reuses `profile-lp-history`.
- **Composition fingerprint.** Which traits and units the owner gravitates toward across games. Analogous to the LoL signature-radar / "what kind of player are you" idea.
- **Set-by-set retrospective.** Each set is ~3–4 months; a `ConclusionCard` per set is a natural recap surface. Fits the existing recap engine.
- **Cross-game unified Profile.** Single Profile-level view spanning LoL + TFT (and eventually Steam) for the same identity. The strongest visible argument for the self-portrait reframe.
- **Mode mix.** Ranked vs Hyper Roll vs Double Up vs normals.

---

## Open questions (to revisit when scoping begins)

- **Rate-limit budget.** TFT shares the Riot key's app-rate-limit pool with LoL. Need to confirm the existing reservoir leaves headroom or partition the budget; document the choice up-front.
- **Backfill story.** TFT match-v5 retention mirrors LoL — likely the same 2-year horizon. Reuse the historical-backfill SSE pattern from [riot-investigation-2026-05-07.md](riot-investigation-2026-05-07.md).
- **Asset pipeline.** Champions, traits, items, augments are versioned per set. Mirror the build-time-champion-assets pattern; do not hotlink Riot's CDN. (Caveat: if the [lol-image-pipeline.md](lol-image-pipeline.md) runtime-proxy pivot has shipped by then, TFT lands on the proxy directly — no bundled assets.)
- **Cross-domain `apps/web/src/_assets/` hoist** ([folder-structure-cleanup.md](folder-structure-cleanup.md) Chunk 4). TFT becoming the third asset-handling domain is the trigger to lift the asset-manifest pattern out of `lol/_shared/` and `steam/_shared/` into a top-level location. Skip if the runtime-proxy pivot has already retired bundled assets — the hoist only earns its keep against the bundled pattern.
- **Set boundaries as patch-equivalents.** TFT sets are coarser than LoL patches but the same "shade chart background at set boundaries" idiom applies — see [vnext-ideas.md](vnext-ideas.md) "Patch-aware everything."

---

## Cross-references

- [self-portrait-surfaces.md](self-portrait-surfaces.md) — the parent reframe.
- [steam-integration.md](steam-integration.md) — sibling integration roadmap; closer to active.
- [riot-investigation-2026-05-07.md](riot-investigation-2026-05-07.md) — Riot rate-limiter and backfill patterns to reuse.
- Existing case studies: `riot-rate-limits`, `build-time-champion-assets`, `historical-backfill-and-sse`.
