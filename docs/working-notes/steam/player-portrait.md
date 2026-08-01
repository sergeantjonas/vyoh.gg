# Steam Player Portrait — design note

**Status:** Active — chunks 0 and 1 complete (2026-08-01, findings below). Snapshots are viable; `SteamPlaySession` is not, so cards 4 and 8 and the single-session cohort are deferred to post-hosting. Chunk 2 (Portrait-half cards 1–6) is the next step.

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

**The second clause is inert today and must not be load-bearing.** Measured 2026-08-01: it rescues 0 of the 14 tasted games, because the session table only knows 5 appids at all (see chunk 0 findings). Keep it — it costs nothing and starts working once the api runs continuously — but write the predicate so the minute floor alone produces a correct cohort, and never gate a card on the rescue firing.

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

## Chunk 0 findings — measured 2026-08-01

Queries run against the dev DB. Every number below is the state on that date; they will move, but the *shapes* are what the design has to survive.

**Nothing prunes.** There is no `deleteMany` against `SteamPlaytimeSnapshot` or `SteamPlaySession` anywhere in `apps/api` — the only one in the codebase drops LoL champion abilities during a static sync. Retention is unbounded by omission rather than by decision, which is the answer open decisions #3 and #4 were asking for. No retention commit needed.

**Snapshots are viable; the gaps don't matter.** 9,974 rows over 195 games, `2026-05-14 → 2026-08-01`. That is a 79-day span carrying only **55 distinct snapshot dates** — 24 missing days, in gaps up to 10 days long, tracking the days the dev box was off. It doesn't corrupt anything, because `playtimeForeverMinutes` is a *cumulative counter*: the delta between two snapshots is exact no matter how many are missing between them. The consequence is only that the 90-day window doesn't exist yet — history crosses 90 days on **2026-08-12**.

So build the recent-genre card against **the oldest snapshot at least 90 days old, falling back to the oldest available**, and label it with the span actually used ("across the last 79 days"). It reads as honest rather than broken, and it heals itself without a follow-up commit. Prefer this delta over `playtime2WeeksMinutes` regardless: only **2 games** carry non-zero 2-week playtime right now, so Steam's own rolling window is too thin to characterise anything.

**`SteamPlaySession` is not viable, and won't be until hosting.** 28 rows, **5 distinct appids**, last row `2026-07-05`. Meanwhile 6 owned games report an `rtimeLastPlayed` after that date — Mortal Shell II, Resident Evil Requiem, Wallpaper Engine, The Witcher 3, Cyberpunk 2077, 3DMark — and four of them have never appeared in the session table at all. The cause is structural, not a bug: sessions are derived from a 2-minute `GetPlayerSummaries` cron inside the api process, so they only exist for launches that happened while the dev environment was up. `rtimeLastPlayed` doesn't have this problem because the daily owned-games sync reads a counter Steam maintains for us.

That blocks **card 4 (session shape)**, **card 8 (median bounce time)** and the **single-session cohort** — each would be computing a distribution over 28 events and 5 games, and would confidently report that everything is single-session because the table simply never saw the other launches. Deferred to a post-hosting revisit; see the chunk plan. **Card 9 (quickest abandons) is unaffected** — it reads `min(playtimeForeverMinutes)` over the tasted cohort and never touches sessions.

**The cohorts are the strongest thing here.** The floor does exactly what it was designed to do:

| | Games | Share |
|---|---|---|
| Owned | 195 | — |
| Cleared the floor (≥60 min) | **60** | 31% |
| Tasted (0 < p < 60 min) | 14 | 7% |
| Bundle ghosts (0 min) | **121** | 62% |

2,893 lifetime hours, of which **2,887 — 99.8% — sit inside the 60-game cohort**. That single pair of numbers justifies the whole engagement floor: it discards 0.2% of the hours to discard 69% of the games. It is also, as the note predicted, portrait material in its own right — *"195 games. 60 hold 99.8% of the hours. 121 have never been launched."* 118 of the 121 ghosts are `appType = 0`, so the count survives filtering to actual games.

**Card 10 (single-achievement club) lands at 7 games** — small, but that's the joke. 54 games carry any unlock at all against 157 with a schema.

**Tag data is ready for chunk 1, and confirms the caveat.** 225 of 227 enrichment rows carry `tagIds`; owned games use **249 distinct tags** out of the 476-tag global catalog, so the author pass is over 249 candidates rather than the whole catalog. Running the fingerprint *without* an allowlist returns, in order: `Action, Singleplayer, Third Person, Souls-like, RPG, Multiplayer, Open World, Story Rich, Action RPG, Co-op, Atmospheric, Difficult` — six of the top twelve are descriptors, and the top 3 would render as "Action, Singleplayer, Third Person", which characterises nobody. The allowlist isn't polish; the card is wrong without it.

Two aggregation traps the same query exposed, both fixed in chunk 1:

**Playtime has to be divided, not repeated.** A game contributes its full playtime to each of its up-to-20 tags, so raw sums exceed the true total (2,761 "hours of Action" against 2,893 hours lived). Each game's minutes must be split across its matched allowlist tags before aggregating, or the card reports percentages over 100.

**An allowlist can't catch a real genre applied as a joke — but rank can.** The first filtered run reported *614 hours across 2 Dating Sims*, which is Steam's community having fun: `Dating Sim` is tag **rank 20** on ELDEN RING NIGHTREIGN, `Rhythm` is rank 19 on Sekiro, `Stealth` is rank 20 on PUBG. Every one is a legitimate genre tag that no allowlist could reject on its own, and every one sits in the tail. Genuine genres cluster in the top dozen. Truncating each game's tag list to the first 12 by weight removes all of them, and costs nothing: swept across limits of 8, 10, 12, 14 and 20, the number of cohort games left with no genre signal stays at **1** throughout (a single unenriched app, *Deus Ex: Human Revolution*).

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
2. ~~**Curated genre-tag list — author pass.**~~ **Done in chunk 1.** 154 of the catalog's 476 tags qualify, not the estimated 50–80 — the estimate was low because it didn't account for the individual sports (24 entries, nearly all dead in this library but kept for consistency, since "Golf" characterises where "Sports" doesn't). The inclusion rule and the judgement calls that could have gone either way are documented at the top of [genre-tags.ts](../../../packages/shared/src/steam/portrait/genre-tags.ts); revisit there rather than re-deriving. Owner should skim the list — `Open World`, `Tactical` and `Sandbox` are the three most arguable calls.
3. ~~**Snapshot retention for the 90d window.**~~ **Answered in chunk 0.** Nothing prunes; the table holds 79 days with gaps that don't affect a cumulative-counter delta. Window becomes truly 90d on 2026-08-12 — build it adaptive and label the real span.
4. ~~**Play-session retention.**~~ **Answered in chunk 0, negatively.** Nothing prunes, but the poller is dev-machine-bound, so the table has 28 rows across 5 games and misses launches outright. The tasted cohort survives (it reads playtime, not sessions); single-session and median-bounce-time do not. Re-measure after ~60 days of continuous hosted uptime before building cards 4 and 8.
5. **Recommendation surface placement.** Inside the Portrait, or as its own block on `/steam/`? Probably inside — the bridge framing only works if it sits between the two halves.
6. **Mobile collapse.** With 13+ cards the section gets long on mobile. Decide between (a) accordion grouping at the half-headers, (b) a single condensed "summary card" on small viewports that links into a `/steam/portrait` deep page. Defer until cards are real and we can measure.

---

## Chunk plan

Each chunk independently committable. Stop and re-evaluate after each — the Portrait will reveal real numbers that may change the design.

**Chunk 0 — Data sanity checks.** ✅ Done 2026-08-01, no code needed. Findings section above; the load-bearing outcomes are that snapshots are fine, sessions are not, and the tag allowlist is confirmed necessary rather than merely tidy.

**Chunk 1 — Curated genre-tag list + shared helpers.** ✅ Done 2026-08-01. [genre-tags.ts](../../../packages/shared/src/steam/portrait/genre-tags.ts) carries the allowlist, the umbrella set, `GENRE_TAG_RANK_LIMIT` and `selectGenreTags()`; [engagement.ts](../../../packages/shared/src/steam/portrait/engagement.ts) carries the thresholds, `isMeaningfullyPlayed()`, `engagementCohort()`, `excludeBarelyTouched()`, `selectEngagementCohort()` and `summariseEngagement()`. Every Portrait aggregation goes through those rather than re-deriving a predicate, per the *"centralise domain invariants"* convention.

Verified end-to-end against the live library before landing: the fingerprint that read **"Action, Singleplayer, Third Person"** unfiltered now reads **"57% of your 2,356 hours sit in Souls-like, Action RPG, Third-Person Shooter."** One of 55 cohort games ends with no genre signal, and it is genuinely untagged upstream.

**Chunk 2 — Portrait half cards (cards 1–6).** API endpoints (or extensions of existing endpoints) + web cards. Reuses the cleaned cohort from chunk 1.

**Chunk 3 — Anti-Portrait half cards (cards 7, 9–13).** New API computations for the bundle-ghost and tasted cohorts + web cards. The Anti-Portrait one-liner (card 13) is last because it synthesises numbers from earlier cards. **Cards 4 and 8 and the single-session cohort are out of scope** until the session table has hosted history behind it — building them against 28 rows would ship a confident wrong answer.

**Chunk 4 — Backlog recommendations.** Scoring service in the API; three surfaces on the web side. Sits between the two halves visually.

**Chunk 5 — Copy + footnote polish.** "Based on N of M owned games" affordance, `← from community tags` footnote, deterministic templating sweep. Plus the threshold-tuning pass once we've looked at real numbers.

Tests required in the same commit as the components (per `docs/repo-conventions.md` — every Portrait card has routing/interactive elements, so the same-commit testing rule applies; axe scan included).
