# LoL data stories — pool

**Status:** Reference — idea pool (2026-06-12 exploration, indexed in [idea-pool-2026-06.md](../cross-cutting/idea-pool-2026-06.md)), not scoped. Seven independent ideas over data we already cache (or one cheap projection away); promote individually. All aggregations go through `excludeRemakes()` per convention.

## 1. Win-probability curve — "the moment the game flipped" ★ strongest

Per-match curve from timeline frames: logistic (or even hand-weighted) model over gold diff + objective state per minute, rendered as a chart with one editorial verdict: *"Decided at 23:41."* Fits the `ConclusionCard` voice exactly; aggregate follow-on ("you win 64 % of games that are even at 20") feeds Trends. Pairs with the [timeline replay scrubber](timeline-replay-scrubber.md) — "the flip" is its marquee jump-marker. Keep the model deliberately simple and **say so on the surface** (it's an editorial estimate, not Riot's WP) — honest-labeling beats false precision.

## 2. Comeback / clutch index

From cached timelines: win rate from ≥3k gold deficit at 20 min, biggest comeback ever (deficit overcome), throw rate from ≥3k leads. Three numbers, one verdict tile ("you're a closer / you're a comeback player"). Cheapest idea here; Trends or Profile tile.

## 3. Champion learning curves

Win rate by *n*-th game on a champion across the pool: "you peak on a new champion around game 12." Fresh angle on the queued mastery integration ([app-state-analysis.md](app-state-analysis.md) Phase 6) — sequence them together. Sample-size honesty matters (few champions have 20+ games); show the curve only where n supports it.

## 4. Ping fingerprint

Match-V5 participant DTOs carry per-category ping counts (`enemyMissingPings`, `onMyWayPings`, `assistMePings`, …). A "communication style" tile — pings per game by category vs lobby average; characterful and unmined by the genre. **Verify the fields exist in our cached payloads first** (older cached matches may predate projection of these fields).

## 5. Death autopsy

`CHAMPION_KILL.victimDamageReceived` on the owner's deaths → burst vs sustained vs chip classification: "your deaths this month: 41 % burst, mostly {champion}." Position data is minute-granular, so **"caught alone" detection is not honestly derivable** — record that limit now. Surface: match-detail death rows + a Trends rollup.

## 6. Vision rhythm

Ward timing (not placement maps — `WARD_PLACED` events carry no position, see [timeline-replay-scrubber.md](timeline-replay-scrubber.md)): control-ward purchase cadence, trinket-swap timing, wards-before-objectives. Role-sensitive — check against the parked role-mix triggers in [lol-owner-data-features.md](lol-owner-data-features.md) before scoping (same reason the support tiles parked).

## 7. Patch × pool profile rollup (weakest — mostly shipped)

Profile-level "patch 26.12 touched 3 of your top-5 champions." The per-champion version **already shipped** (patch-aware everything + PB3 patch-drift verdict); [profile-patch-notice.tsx](../../../apps/web/src/lol/patches/profile-patch-notice.tsx) already surfaces patch arrival on Profile. Residual scope is only the pool-impact *aggregation* — check what ProfilePatchNotice renders before scoping; if it already counts pool impact, delete this entry.

---

**Shared sequencing note:** 1, 2, and 5 all read cached timeline JSON. If picked together, do one "timeline projection" pass (extract per-minute gold/objective/death series onto a queryable shape) instead of three ad-hoc readers — and that same projection is what the replay scrubber and match-depth Phase E need. One projection, five consumers.
