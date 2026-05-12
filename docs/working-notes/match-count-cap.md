# Match count cap — analytics vs. storage

The `MatchCountSelector` is capped at `MAX_COUNT = 100` (in `match-count-selector.tsx`). This value is also enforced at the route boundary in `$accountSlug.tsx` `validateSearch` via `Math.min(search.count, MAX_COUNT)`.

**Why:** Accounts with 900+ games caused noticeable tab-navigation lag when 200+ matches were loaded into the Trends/Champions pages. 100 is enough for meaningful trend analysis and keeps Recharts renders within budget.

**How to apply:** Don't raise this without profiling. The match list itself is unbounded (infinite scroll from DB) — the cap is only for the analytics window, not the full history. Backend storage is negligible (~0.5 KB/game) so there is no backend row cap; the historical backfill walks to genesis and stops via `historicalDoneAt`.
