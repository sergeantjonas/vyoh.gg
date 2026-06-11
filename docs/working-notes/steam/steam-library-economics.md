# Steam library economics

**Status:** Reference — idea pool (2026-06-12 exploration, indexed in [idea-pool-2026-06.md](../cross-cutting/idea-pool-2026-06.md)), not scoped. Two ideas + one recorded dead end. The wishlist half extends feature-candidates **F4** ([feature-candidates-2026-06.md](../cross-cutting/feature-candidates-2026-06.md)) — F4's price-snapshot base ships first inside the [wishlist-upcoming](wishlist-upcoming.md) arc; this note only adds layers on top.

Before scoping either idea: read [api-client-consolidation.md](../cross-cutting/api-client-consolidation.md) (standing instruction before any new upstream integration), and probe each upstream with a real request before designing against it (house rule — see [[feedback_curl_upstream_before_proxy]]).

## 1. Backlog actuary

*"Your backlog is ~410 hours — about 9 months at your current pace."*

- **Data we already have** ([../cross-cutting/steam-api-unused-data.md](../cross-cutting/steam-api-unused-data.md)): owned-games totals fetched daily (175 owned, ~2,860 h lifetime, 41 % ever played) and 2-week activity per game (the pace denominator, already polled for the unlock poller — zero new Steam cost).
- **New upstream: IGDB** (Twitch client-credentials OAuth) for time-to-beat estimates per unplayed/unfinished game. Verify live coverage for the actual library before scoping — TTB coverage on small indie titles may be thin; the aggregate stays honest if it states coverage ("estimates for 121 of 154 unplayed games"). **HLTB is out**: no official API; scraping isn't an option for a public portfolio piece.
- **Surfaces:** one ConclusionCard verdict on `/steam` (the actuary headline), per-game "≈ 12 h to credits" chip on library rows / game detail, and a "shortest path through your backlog" list (sort unplayed by TTB ascending) — the actionable twist that pairs with feature-candidates F3's achievement planner.
- **Matching risk:** Steam appid → IGDB id mapping is the real work (IGDB carries external-game references; verify hit rate). Cache mappings permanently — they don't churn.

## 2. Wishlist market value (extension of F4)

F4 owns price snapshots + discount badges from data already polled. This adds the **market-value layer**:

- **New upstream: IsThereAnyDeal** (official API, key required) for historical lows and current best across stores.
- **Verdicts:** "your wishlist costs €214 today, €156 at each game's historical low"; "3 of 12 are at their historical low *right now*" — a timing verdict, not just a price list. Calendar tie-in: the wishlist-upcoming surface already thinks in dates; price timing is the same editorial register.
- **Sequencing:** strictly after F4's snapshot base lands. If ITAD's coverage disappoints at probe time, the degraded version (Steam-only price history from our own snapshots) still delivers the headline verdict — F4 alone enables that.

## Dead end — recorded so it isn't re-derived

**Cost-per-hour for the owned library** ("you paid €X per hour of fun") is not honestly buildable: price *paid* is OAuth-only (confirmed dead end in [../cross-cutting/steam-api-unused-data.md](../cross-cutting/steam-api-unused-data.md)), and current-price × playtime is a dishonest proxy (sale prices, bundles, regional pricing). Rejected 2026-06-12 — don't re-scope without a data source for actual purchase prices.
