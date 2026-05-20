# Steam Player Portrait — design note

**Status:** Active — design draft. No code yet; chunk 0 (data sanity checks) is the first step.

A new section on the Steam route that synthesises the existing data into a *characterisation* of the owner as a player — who they are when they play, and (just as honest) who they are when they don't. Promoted from the broader [self-portrait-surfaces](../cross-cutting/self-portrait-surfaces.md) direction into a tracked Steam-specific design.

Sister note to [steam-integration](./steam-integration.md), which owns the integration roadmap. This note owns the Portrait *surface* only.

Read this before starting any of the chunks below, or when deciding how to score the backlog recommendations.

---

## Premise

The Steam Profile page today is a grid of correct-but-impersonal chips: library size, recent unlocks, platform mix, wishlist. The numbers are there; the *picture* isn't. The page doesn't answer the obvious questions a visitor will ask after one glance: *"what kind of player are you, what are you actually into right now, and what's the gap between your shelf and what you actually play?"*

The Portrait answers those questions as **evidence-backed trait cards** — each claim shows the underlying number and a one-line "because" footer. The format is deliberately not generated prose; templated claims age better than horoscope copy when the data drifts.

The portfolio framing is part of the design: Steam itself only ever surfaces your most-played titles. Surfacing the *shelf of shame* honestly is the distinctive angle ("a dashboard that's brutally honest about the data it shows") and the reason the Anti-Portrait half is not optional.

---

## Surface decision

**Recommendation: extend `/steam/`, do not carve a new `/steam/portrait` tab.**

The existing Profile chips are already partial portrait fragments (Platform Mix, Library Composition, Recent Unlocks). Grouping them into Portrait + Anti-Portrait headers in place is less work and reads better than a separate tab the visitor has to discover. The existing chips become the lightweight tier; new cards stack underneath.

Open if it becomes too dense — if the cumulative card count after Anti-Portrait exceeds ~10 cards, revisit and split.

---

## Data inventory

Everything below is already in the DB; no new Steam Web API calls are needed.

| Source | Surfaces it feeds |
|---|---|
| `SteamPlaytimeSnapshot` (latest row per game) | Lifetime + 2-week + per-OS minutes |
| `SteamOwnedGame.rtimeLastPlayed` | Last-launch timestamp per game |
| `SteamOwnedGame.firstSeenAt` | Owned-since timestamp (proxy for "how long has this been on the shelf") |
| `SteamOwnedGame.tagIds` (top-20 community tags) | Genre fingerprint — see caveat below |
| `SteamOwnedGame.featureCategoryIds` | Single-player / multiplayer / controller / etc. |
| `SteamGameAchievement` + `SteamPlayerUnlock` + global rarity | Completion %, rarest-unlock data, "single-achievement club" |
| `SteamPlaySession` (open/close transitions) | Session length distribution, return-day count |
| `SteamChronotype` (already a service) | Late-night share, hour-of-day buckets |
| `SteamLibrarySummary` | Owned / launched / untouched counts |
| Wishlist | "Longest cold streak" candidate set if combined with `firstSeenAt` |

### The genre caveat

Steam's public Web API does not expose publisher genre directly. We use **community tags as the genre proxy**, which is noisy: tags like `"Atmospheric"`, `"Great Soundtrack"`, `"Female Protagonist"` sit alongside real genres in the top-20. The Portrait must filter to a **curated genre-tag allowlist** (chunk 1) before any aggregation. The Portrait UI should also carry a small `← derived from community tags` affordance somewhere visible, to keep the portfolio framing credible.

---

## Data quality — the "meaningful engagement" floor

A 12-minute curiosity-launch of *Fallout 76* must not contribute 12 minutes of MMO to the genre fingerprint. Steam libraries are full of bundle leftovers, free-weekend pokes, and "does this run on my hardware" launches; without a floor the Portrait inherits all of that noise as identity.

A game contributes to **identity surfaces** only if it clears one of:

- `playtimeForeverMinutes >= 60` (past the tutorial, opinion formed for most genres), OR
- `>= 2 distinct launch days` in the `SteamPlaySession` table (rescues genres with short loops — roguelites, deckbuilders, sims where one run is the whole thing).

Per-surface application:

| Surface | Floor | Why |
|---|---|---|
| Lifetime genre fingerprint | ≥60 min OR ≥2 days | Identity claim, needs evidence |
| Recent genre (2-week / 90d) | ≥30 min in window | Less data, slightly lower bar |
| Completionist median | ≥10 h | Achievement % is meaningless on a 30-min game |
| Session shape | no floor | A 12-min session IS a session — the noise is the data |
| Backlog recommendations | floor applies to the *fingerprint*, not the candidates | Score *unplayed* games against the *cleaned* fingerprint |
| Anti-Portrait cohorts | **inverted** — only games *below* the floor | The whole point of those cards |

**The floor is not a hack — surface it.** A trait line like *"Based on 47 of your 312 owned games — those with ≥1h playtime or multi-day sessions"* is itself portrait material. The gap between owned and meaningfully played is one of the most telling numbers on the page.

Threshold constants live in `packages/shared/src/steam/portrait/` so they can be tuned once we see real data. Tradeoff considered and rejected: a percentile-based floor ("below the 25th percentile of launched games") would be less arbitrary but harder to explain in copy than a fixed minute floor.

---

## Card catalog

### Portrait half — who you are when you play

1. **Lifetime genre.** Top 3 genre tags weighted by lifetime playtime over the cleaned cohort. *"62% of your 4,800 hours sit in CRPG, Strategy, Soulslike."*
2. **Recently into.** Same calc on `playtime2WeeksMinutes` (and a 90d variant if we keep enough snapshot history). Surfaces drift: *"Lifetime CRPG; lately Roguelite Deckbuilder."*
3. **Completionist score.** Bucketed from per-game achievement %: % of finished games (≥80%), 100%-club count, median completion on titles with >10h. Honest variant when both fire: *"Selective completionist — you finish 12% of what you start, but those you finish, you 100%."*
4. **Session shape.** Median session length, marathon count (>4h), late-night share — from `SteamPlaySession` and the existing chronotype service. Steam-only on this surface; the cross-stream chronotype stays on `/`.
5. **Platform identity.** Reframe of the existing platform-mix chip inside the Portrait. *"83% Windows, 14% Deck — you're a docked-Deck commuter."*
6. **Library posture.** Counts + ratios: owned / ever-launched / untouched / tasted. The bridge into the Anti-Portrait half.

### Anti-Portrait half — who you are when you don't

Three explicit cohorts; do not collapse into one mushy "barely played":

| Cohort | Definition |
|---|---|
| **Bundle ghosts** | `playtimeForeverMinutes === 0` |
| **Tasted** | `0 < playtime < 60 min` and no multi-day rescue |
| **Single-session** | Exactly one row in `SteamPlaySession` for this appid, no later launches |

Cards:

7. **The Tasted Tier.** Count + the absurd total. *"47 games. 6h 12m total. An hour each, spread across half a year of half-trying."*
8. **Median bounce time.** How long you actually give a game before quitting. The value itself is character — 14 minutes is one kind of player; 47 minutes is another.
9. **Quickest abandons.** Top 5 shortest non-zero playtimes. Will surface absurdities — *"Disco Elysium — 3 minutes."*
10. **The Single-Achievement Club.** Games where you unlocked exactly one achievement (usually the launch-screen one, sometimes funnier). Achievement schema + your unlocks give us this for free.
11. **Genres you bounce off.** Tag fingerprint of the Tasted cohort. The inverse of "Recently into" — *"You've tried 8 Soulslikes, bounced off 7."*
12. **The longest cold streak.** Owned game with the largest gap between `firstSeenAt` and most recent activity (or never-launched + ancient `firstSeenAt`). *"Hollow Knight has been on your shelf since 2019."*
13. **Anti-Portrait one-liner.** A synthesised verdict combining the cohorts. *"You own 312 games, meaningfully played 47, finished 11. The gap is the hobby."* One card, one line.

---

## Backlog recommendations — the bridge

For every owned game with `playtimeForeverMinutes === 0`, compute a score from **local data only** (no Steam API call):

```
score = tag_overlap(game, recent_genre_fingerprint)
      + small_bonus(featureCategoryIds match user's category profile)
      - penalty(ancient releaseDate AND zero overlap with recent fingerprint)
```

Where `recent_genre_fingerprint` is the playtime-weighted vector over the curated genre-tag set from the last 90 days, computed from the cleaned cohort.

Three surfaces (all evidence-footnoted):

- **Pick up next.** Single hero card — top-scoring untouched game with a transparent reason. *"3 of its top 5 tags match what you've been playing the last 6 weeks."*
- **Sleeping on this genre.** When a recently-active genre has owned-but-untouched titles, show the largest cluster. *"You played 22h of Roguelite Deckbuilders in the last 2 weeks; you own Inscryption, Wildfrost, and Across the Obelisk and haven't launched them."*
- **Tasted but never returned.** Highest-regret abandoned-game card — had ≥1 session, never reopened, tags match recent fingerprint.

---

## Open decisions

1. **Trait copy strategy.** Pure deterministic templates (`"Genre anchor: {n}% in {top3}"`) vs. a small set of hand-written variants picked by which thresholds fire. Leaning deterministic for portfolio honesty; warmth can be layered later.
2. **Curated genre-tag list — author pass.** One-time manual sweep through the `SteamTag` catalog to mark tags as genre vs descriptor. Probably ~50–80 tags qualify. Stored as a constant in `packages/shared/src/steam/portrait/genre-tags.ts`.
3. **Snapshot retention for the 90d window.** The recent-90d genre card needs ≥90 days of `SteamPlaytimeSnapshot` rows. Verify in chunk 0 that nothing is trimming the table; if rows older than N days are being pruned, decide whether to extend retention or drop the 90d variant.
4. **Play-session retention.** The Anti-Portrait cohorts (tasted, single-session, median bounce time) are load-bearing on `SteamPlaySession`. Same verification as #3 — make sure session rows aren't being trimmed, and confirm session-tracking has been running long enough to make claims like "single-session" meaningful.
5. **Recommendation surface placement.** Inside the Portrait, or as its own block on `/steam/`? Probably inside — the bridge framing only works if it sits between the two halves.
6. **Mobile collapse.** With 13+ cards the section gets long on mobile. Decide between (a) accordion grouping at the half-headers, (b) a single condensed "summary card" on small viewports that links into a `/steam/portrait` deep page. Defer until cards are real and we can measure.

---

## Chunk plan

Each chunk independently committable. Stop and re-evaluate after each — the Portrait will reveal real numbers that may change the design.

**Chunk 0 — Data sanity checks.** Verify snapshot + session retention assumptions. Confirm enough history exists for the 90d and "single-session" claims. No code if everything checks out; otherwise a retention adjustment commit. Files: ad-hoc queries against the dev DB, no app code expected.

**Chunk 1 — Curated genre-tag list + shared helpers.** One-time author pass over the SteamTag catalog. Output: `packages/shared/src/steam/portrait/genre-tags.ts` (allowlist) + `packages/shared/src/steam/portrait/engagement.ts` (the meaningful-engagement predicate). Plus the `excludeBarelyTouched()`-style helper, following the *"centralise domain invariants"* convention in `docs/repo-conventions.md` — every aggregation in the Portrait must use it.

**Chunk 2 — Portrait half cards (cards 1–6).** API endpoints (or extensions of existing endpoints) + web cards. Reuses the cleaned cohort from chunk 1.

**Chunk 3 — Anti-Portrait half cards (cards 7–13).** New API computations for the three cohorts + web cards. The Anti-Portrait one-liner (card 13) is last because it synthesises numbers from earlier cards.

**Chunk 4 — Backlog recommendations.** Scoring service in the API; three surfaces on the web side. Sits between the two halves visually.

**Chunk 5 — Copy + footnote polish.** "Based on N of M owned games" affordance, `← from community tags` footnote, deterministic templating sweep. Plus the threshold-tuning pass once we've looked at real numbers.

Tests required in the same commit as the components (per `docs/repo-conventions.md` — every Portrait card has routing/interactive elements, so the same-commit testing rule applies; axe scan included).
