# Steam Player Portrait — design note

**Status:** **Every chunk in the plan has shipped** (0, 1, 2, 3, L, P, 4 and 5, between 2026-08-01 and 2026-08-06), each verified against the running api or a real browser rather than the suite alone. **Cards 4 and 8 are the only catalog entries not built**, along with the single-session cohort: all three read session boundaries, which only exist where our own poller was watching, so all three wait on continuous uptime. **The layout pass (chunk L) is complete** (2026-08-02, L1–L6): each half opens with an editorial hero band — `Souls-like` for the Portrait, `120 never opened` for the Anti-Portrait — over a grid of compact chips whose bar rows carry tooltips naming the games behind them. Cards 1 and 13 are deleted into the two heroes. **Chunk P then moved both bands to their own route, `/steam/portrait`**, as a fifth Steam tab: the landing page's document halved, the new route server-renders its whole argument, and it baselines at 24–25 layers / ~53 ms. **Chunks 4 and 5 are complete** (4a 2026-08-05; 4b, 4c and 5 on 2026-08-06): a **What to play** band sits between the two halves, carrying `Pick up next`, `Sleeping on this genre` and `Worth reopening` off a scoring pass over the 117 never-launched games, and the copy pass that followed it flushed three restatements of the page's sharpest number. **Every chunk in the plan has now shipped.** What remains is not scoped work but blocked work: cards 4 and 8 and the single-session cohort all wait on the api running continuously long enough for `SteamPlaySession` to stop missing the long sittings — the gate is a non-empty `4h+` bucket, not a row count — and the owner still owes the 154-tag allowlist a skim (`Open World`, `Tactical` and `Sandbox` are the arguable calls).

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

**`SteamPlaySession` is not viable, and won't be until the api runs continuously.** 28 rows, **5 distinct appids**, last row `2026-07-05`.

> **Re-measured 2026-08-06, and the sample size was never the real objection.** The shipped `/home/session-lengths` endpoint buckets 25 closed Steam sessions as `<30m: 12 · 30m–1h: 4 · 1h–2h: 6 · 2h–4h: 3 · 4h+: **0**` — against 2,903 lifetime Steam hours, 434 of them in ELDEN RING NIGHTREIGN alone. **The 4h+ bucket is structurally empty, not empirically empty.** Card 4's marathon count would therefore render `0`, confidently and falsely, and card 8's median would skew short for the same reason. Compare LoL on the same endpoint: 185 sessions with 4 over four hours, on a *smaller* time investment — because LoL sessions are reconstructed from match timestamps Riot hands over retroactively, where Steam sessions only exist if our process happened to be watching. The bias is adversarial rather than random: the dev server is up while the owner works and down while they play, so the long sittings are precisely the ones never observed. What continuous uptime buys is not more rows — it is breaking the correlation between "was the poller running" and "was the owner playing". Meanwhile 6 owned games report an `rtimeLastPlayed` after that date — Mortal Shell II, Resident Evil Requiem, Wallpaper Engine, The Witcher 3, Cyberpunk 2077, 3DMark — and four of them have never appeared in the session table at all. The cause is structural, not a bug: sessions are derived from a 2-minute `GetPlayerSummaries` cron inside the api process, so they only exist for launches that happened while the dev environment was up. `rtimeLastPlayed` doesn't have this problem because the daily owned-games sync reads a counter Steam maintains for us.

That blocks **card 4 (session shape)**, **card 8 (median bounce time)** and the **single-session cohort** — each would be computing a distribution over 28 events and 5 games, and would confidently report that everything is single-session because the table simply never saw the other launches. Deferred to a post-hosting revisit; see the chunk plan. **Card 9 (quickest abandons) is unaffected** — it reads `min(playtimeForeverMinutes)` over the tasted cohort and never touches sessions.

**The cohorts are the strongest thing here.** The floor does exactly what it was designed to do:

Counts below are after filtering to `appType = 0` and `removedAt = null`, which is the population the cards will actually read. (Unfiltered, the owned table holds 195 rows and 2,893 hours; the difference is Wallpaper Engine, 3DMark and friends.)

| | Games | Share |
|---|---|---|
| Owned | 186 | — |
| Cleared the floor (≥60 min) | **55** | 30% |
| Tasted (0 < p < 60 min) | 11 | 6% |
| Bundle ghosts (0 min) | **120** | 65% |

2,385 lifetime hours, of which **2,380 — 99.8% — sit inside the 55-game cohort**. That single pair of numbers justifies the whole engagement floor: it discards 0.2% of the hours to discard 70% of the games. It is also, as the note predicted, portrait material in its own right — *"186 games. 55 hold 99.8% of the hours. 120 have never been launched."*

**Card 1 should show two genres with confidence, not three.** Running the probe's rank sweep, the top two are immovable — `Souls-like` and `Action RPG` hold positions 1 and 2 at every rank limit from 6 to 20. The third slot is noise: it reads `RPG` at 6, `Third-Person Shooter` at 8, `Roguelite` at 10, `Third-Person Shooter` at 12 and 14, `Survival` at 20. The cause is visible in the per-genre game counts — `Third-Person Shooter` (6.5%, 10 games) and `Roguelite` (6.1%, **1 game**) are within half a percentage point of each other, and the one-game entry is ELDEN RING NIGHTREIGN's 434 hours landing whole on a genre nothing else in the library carries.

So the card needs a **carrier count**, not just a share: a genre resting on one title is a fact about that title, not about the player. Either cut card 1 to the top two, or keep three and let the third be visibly thin ("Roguelite — one game, 145h"). The probe prints the carrier count next to every genre so this stays checkable as the library grows.

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
12. **The longest cold streak.** ~~Owned game with the largest gap between `firstSeenAt` and most recent activity.~~ **Re-specced 2026-08-02** — `SteamOwnedGame.firstSeenAt` defaults to `now()` on insert, so it records when *our poller* first saw the row (May 2026), not when the game was acquired. Nothing we hold knows an acquisition date, and "on your shelf since 2019" built on `firstSeenAt` would be fabricated. The card reads `rtimeLastPlayed` instead, which is genuine Steam data: *"Deus Ex: Human Revolution — 24 hours in it, untouched since July 2012."* Stronger claim, real column.
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
4. ~~**Play-session retention.**~~ **Answered in chunk 0, negatively.** Nothing prunes, but the poller is dev-machine-bound, so it misses launches outright — and the misses are not random. Measured 2026-08-06: **zero sessions over four hours** across the whole table, for an owner with 434h in a single game. The tasted cohort survives (it reads playtime, not sessions); single-session and median-bounce-time do not. The deploy tooling shipped 2026-07-27, so what remains is uptime rather than work: re-measure after ~60 days of the api running continuously, and treat a non-empty `4h+` bucket as the gate rather than a row count.
5. **Recommendation surface placement.** Inside the Portrait, or as its own block on `/steam/`? Probably inside — the bridge framing only works if it sits between the two halves.
6. **Mobile collapse.** With 13+ cards the section gets long on mobile. Decide between (a) accordion grouping at the half-headers, (b) a single condensed "summary card" on small viewports that links into a `/steam/portrait` deep page. Defer until cards are real and we can measure.

---

## Chunk plan

Each chunk independently committable. Stop and re-evaluate after each — the Portrait will reveal real numbers that may change the design.

**Chunk 0 — Data sanity checks.** ✅ Done 2026-08-01, no code needed. Findings section above; the load-bearing outcomes are that snapshots are fine, sessions are not, and the tag allowlist is confirmed necessary rather than merely tidy.

**Chunk 1 — Curated genre-tag list + shared helpers.** ✅ Done 2026-08-01. [genre-tags.ts](../../../packages/shared/src/steam/portrait/genre-tags.ts) carries the allowlist, the umbrella set, `GENRE_TAG_RANK_LIMIT` and `selectGenreTags()`; [engagement.ts](../../../packages/shared/src/steam/portrait/engagement.ts) carries the thresholds, `isMeaningfullyPlayed()`, `engagementCohort()`, `excludeBarelyTouched()`, `selectEngagementCohort()` and `summariseEngagement()`. Every Portrait aggregation goes through those rather than re-deriving a predicate, per the *"centralise domain invariants"* convention.

Verified end-to-end against the live library before landing: the fingerprint that read **"Action, Singleplayer, Third Person"** unfiltered now reads **"57% of your 2,356 hours sit in Souls-like, Action RPG, Third-Person Shooter."** One of 55 cohort games ends with no genre signal, and it is genuinely untagged upstream.

**Chunk 2 — Portrait half cards (cards 1–6).** Reuses the cleaned cohort from chunk 1. Run [probe-portrait-fingerprint.ts](../../../apps/api/src/scripts/probe-portrait-fingerprint.ts) before writing copy — it prints what each of these cards would currently say, including the carrier counts that decide whether card 1 shows two genres or three, and it ends by printing the shipped endpoint's own answer so a disagreement between the two readings is visible.

- **2a — API.** ✅ Done 2026-08-02. [portrait.service.ts](../../../apps/api/src/steam/portrait.service.ts) behind `GET /api/steam/portrait`, returning `SteamPortrait` (lifetime fingerprint, recency fingerprint + the window it actually covers, engagement posture). The genre weighting itself lives in [fingerprint.ts](../../../packages/shared/src/steam/portrait/fingerprint.ts) so chunk 3's card 11 and chunk 4's scoring share it rather than re-deriving the division rule.
- **2b — Web.** ✅ Done 2026-08-02. [portrait-section.tsx](../../../apps/web/src/steam/portrait/portrait-section.tsx) on `/steam`, carrying cards 1 (`Genre anchor`), 2 (`Lately`) and 6 (`Library posture`) as `FactCard`s under a bare-wrapper `SectionTitle`, with the `← derived from community tags` disclosure on the header. Which genres a claim may name lives in [leading-genres.ts](../../../apps/web/src/steam/portrait/leading-genres.ts): the leading three, minus any trailing entry resting on fewer than three games. **Primed in the route loader** — measured 3.6 kB in ~15 ms off our own Postgres, which clears all three questions in the SSR priming rule where the sibling live-Steam summary fails the latency one.
- **2c — Web + API.** ✅ Done 2026-08-02. Card 3 (`Completion`) and card 5 (`Platform`) join the section. Card 3 needed api work after all: completion has to be joined against playtime to apply the ten-hour floor, so `SteamPortrait` gained a `completion` block computed by [completion.ts](../../../packages/shared/src/steam/portrait/completion.ts) — the existing `achievements/library-completion` endpoint carries no playtime, and the alternative was joining it client-side against the 664 kB owned-games payload. Card 5 replaces `PlatformMixChip`, which is deleted; `platform-mix` is primed in the same loader (166 B / ~2 ms) so the card server-renders its claim rather than a spinner.

**Card 3's numbers make the "selective completionist" framing land exactly as specced:** of 186 owned games, **34** reach ten hours with a schema, and **17 of those 34 are at 100%** — median completion across the cohort is **95%**. Selective about what gets started, near-total about what gets finished.

**Card 5 could not use its specced copy.** The example in the catalog above ("83% Windows, 14% Deck — you're a docked-Deck commuter") assumes a mixed library; the owner's is **100% Windows**, so the card reads `Windows, exclusively.` The information the card adds instead is coverage: Steam attributes only **79%** of lifetime playtime to any platform at all (113,184 of 143,100 minutes), because per-OS counters only start when a title begins reporting them. The card discloses that whenever the gap exceeds 5%.

Both superseded chips are deleted. `PlatformMixChip` fell to card 5 by spec; `LibraryCompositionChip` fell to card 6 on the owner's call, since its untouched count and card 6's ghost count were the same number said twice. `useSteamLibrarySummary` survives — `steam-stat-band` still reads it. `OwnedGamesChip` ("Most played") stays in the grid: it highlights a single title rather than counting the library, so nothing in the Portrait repeats it.

**Verified against the running api 2026-08-02**, not just the test suite: `/steam/portrait` answers 3,726 B in ~18 ms over HTTP, and the served `/steam` document carries all five claims in its markup — *"59% of your 2,356h sit in Souls-like, Action RPG and Third-Person Shooter"*, *"Not enough recent play to call a drift"*, *"34 of 186 owned games reach 10 hours; 17 of those are at 100%"*, *"Windows, exclusively"*, *"55 of 186 owned games have had more than an hour"*.

**Card 2 has almost no data, and that is the finding.** Measured 2026-08-02 the recency window covers **80 days, 3 games, 29 hours** — every genre in it rests on a single game, at shares within 0.1 points of each other (Souls-like 17.3%, Stealth 17.3%, Survival 17.2%, Survival Horror 17.2%, Third-Person Shooter 17.2%). A "lifetime X, lately Y" claim built on that would be inventing a drift out of one weekend. Card 2 must gate on carrier count and say plainly that there has not been enough recent play, rather than rendering a confident ranking of noise. Re-measure once the window is genuinely 90 days of hosted history; the shape of the card can change then.

**Chunk 3 — Anti-Portrait half cards (cards 7, 9–13).** New API computations for the bundle-ghost and tasted cohorts + web cards. The Anti-Portrait one-liner (card 13) is last because it synthesises numbers from earlier cards. **Cards 4 and 8 and the single-session cohort are out of scope** until the session table has continuously-observed history behind it — building them against what the dev-bound poller caught would ship a confident wrong answer, not merely a noisy one.

- **3a — API.** ✅ Done 2026-08-02. `SteamPortrait` gained an `anti` block — the tasted cohort's count/total/median plus its quickest abandons and its genre fingerprint, the single-achievement cohort with the two denominators that make it read as small, and the coldest last-launch. The selections live in [abandonment.ts](../../../packages/shared/src/steam/portrait/abandonment.ts) beside the identity ones, each a separately-named call rather than a `not` flag on its twin. Card 11 needs no new API shape: `gameCount` on the tasted fingerprint and on the lifetime one are the two halves of "tried N, bounced off M". Card 13 needs none either — `posture` and `completion` already carry every number in it.
- **3b — Web.** ✅ Done 2026-08-02. [anti-portrait-section.tsx](../../../apps/web/src/steam/portrait/anti-portrait-section.tsx) on `/steam` below its twin, carrying cards 7 (`Tasted tier`), 9 (`Quickest abandons`) and 11 (`Genres you bounce off`). No new priming — the loader already awaits `portrait`, and the `anti` block rode in on it. Card 11's join lives in [bounce-rates.ts](../../../apps/web/src/steam/portrait/bounce-rates.ts): rank by rate rather than volume, drop any genre carried by a single game, and cap the list at three. The bar beside each row is load-bearing rather than decorative — 2-of-2 and 3-of-16 are both "three-ish abandoned games" until you see the width.
- **3c — Web.** ✅ Done 2026-08-02. Cards 10 (`Single-achievement club`), 12 (`Coldest shelf`) and 13 (`The gap`) close the section; 13 spans the row because it restates numbers the cards above already earned rather than adding one. Two things the live page corrected mid-chunk. Card 11's floor moved from *two games tried* to **two games abandoned** — the first version's third row was `Psychological Horror 1/2`, a true 50% resting on one dropped game, which is the trap card 2 is already gated for; the floor now covers the denominator for free, since a genre cannot be dropped more often than it was opened. And card 10 moved off `formatPlaytime`, which rounds to whole hours and rendered both 97 and 147 minutes as `2h` — the exact distinction the list exists to draw, so it uses `formatHoursMinutes`. Card 12's date formatter is pinned to UTC in [month-year.ts](../../../apps/web/src/steam/portrait/month-year.ts) per the container-divergence rule, and its test asserts `resolvedOptions().timeZone` rather than a rendered string, since a value assertion cannot catch a dropped pin while CI itself runs in UTC.

**The Anti-Portrait's numbers, measured 2026-08-02** off the shipped `anti` block, so the cards can be written against them rather than against the catalog's illustrative copy:

| Card | What it will say |
|---|---|
| 7 Tasted tier | **11 games, 265 minutes total, median 22 minutes.** The catalog's "47 games / 6h 12m" was illustrative; the real cohort is smaller and the total is absurd in the other direction — under four and a half hours across eleven games. |
| 9 Quickest abandons | NieR Replicant **1 min**, Blades of Time 3, FINAL FANTASY XV 5, Just Cause 2 15, METAL GEAR SOLID V: GROUND ZEROES 20. |
| 10 Single-achievement club | **6 games**, against 50 with any unlock at all and 152 carrying a schema. Apex Legends leads it at 147 minutes for one achievement. |
| 11 Genres you bounce off | Ranked by carriers, the line is **JRPG: tried 2, bounced off both**. Then MMORPG 2 of 3, Hack and Slash 3 of 7, FPS 3 of 13, Action RPG 3 of 16. |
| 12 Coldest shelf | **Deus Ex: Human Revolution**, last launched **2012-07-17**, with **1,462 minutes** in it. |
| 13 One-liner | Own **186**, meaningfully played **55**, finished **18**. |

**Steam answers an epoch sentinel for some pre-cloud titles.** `Call of Duty: Modern Warfare 2 (2009)` reports `rtime_last_played` of **1970-01-02** while carrying 410 recorded minutes. Card 12 ranks by oldest, so an unguarded version crowns the sentinel every single time and claims the shelf has been cold since before Steam existed. `isPlausibleLastPlayed()` floors it at Steam's 2003 launch. Worth remembering for any future surface that sorts on this column.

**Card 11 needs the carrier counts from both fingerprints, not the tasted one alone.** "Bounced off 7" is only a claim next to "tried 8" — a genre with 3 tasted carriers reads completely differently at 3-of-3 than at 3-of-16. Both numbers are already on the wire (`anti.tasted.fingerprint` and `lifetime`, each carrying `gameCount`), so the card joins them by tag rather than the api computing a rate. Rank by carriers there too: inside a cohort capped at 59 minutes, the minute-weighted `share` a fingerprint sorts by is noise.

**Chunk L — Layout pass.** Raised by the owner on 2026-08-02 against the shipped page: eleven cards of identical shape make `/steam` long to scroll and flat to read, with no signal about which claim is the thesis. Direction chosen: **an editorial hero band per half, dense chips below it**. Sequenced ahead of chunk 4 so the recommendations land into the new shape instead of being restyled after it. This note's own pre-registered trigger — *reopen the tab decision if the cumulative card count after the Anti-Portrait exceeds ~10* — fired here, at eleven.

- **L1 — Cards size to their own content.** ✅ Done 2026-08-02. [card-shell.tsx](../../../apps/web/src/components/card-shell.tsx) no longer claims `h-full`. Whether cards in a row share a height is the grid's decision, and asserting it in the card also overrode any grid that wanted otherwise. Both portrait grids now take `items-start`, so a short card beside a long one stops opening a void under itself. Card 13 loses its `md:col-span-2`, which was forcing card 12 to sit alone on a row; the span was also absent from the pending and error branches, so the card changed width mid-load. **A browser probe caught the one place the removal regressed.** The trends grid reaches its tiles through two wrappers (`Cell` → `DeferredMount`), and a stretched grid area only reaches the card if every link in the chain passes it on — `Win-rate trajectory` measured 145 px inside a 226 px cell until both wrappers became `grid`. Nothing in the suite sees that: happy-dom does not lay out, so the check has to be a real browser reading `getBoundingClientRect`.
- **L2 — A compact density for the supporting cards.** ✅ Done 2026-08-02. Density is declared by the band, not carried by the card: [card-density.tsx](../../../apps/web/src/components/card-density.tsx) is a context each section wraps its grid in, so eleven cards switch recipe without eleven components learning to accept and forward a prop — the shape `frosted` already has, and once was enough. Both grids go to three columns at `xl`. **Measured in the browser, the column change is worth much less than the row count suggests**: `main.scrollHeight` reads 2199 px at three columns against 2382 px at two, a 7.7% saving, because a 275 px column wraps prose that a 416 px one does not. Worth knowing before reaching for a fourth column — the page is content-long rather than layout-long, so the remaining length has to come out of the card *count*, which is what the hero bands do.
- **L3 — Portrait hero band.** ✅ Done 2026-08-02. [portrait-hero.tsx](../../../apps/web/src/steam/portrait/portrait-hero.tsx) opens the section with the anchor genre as a masthead, the claim that earns it as prose, and the three genres as bar rows; `GenreAnchorCard` is deleted, since the hero says everything it said. Eyebrow and masthead sit baseline-aligned on a flex-wrap row per the [design spec](../cross-cutting/subject-chapter-design-spec.md), the cascade rides `sectionChildVariants` rather than a hand-rolled variants object, and the prose keeps `max-w-prose` while the rows run the full width. **The shadow tiers turned out not to be needed** — the plan assumed lifting [chapter-shadows.ts](../../../apps/web/src/home/recap/chapter-shadows.ts) out of the recap package, but the Steam backdrop behind this band is already dimmed to near-black, and the masthead reads cleanly without a text-shadow. Left where it is rather than moved on a spec inference; revisit if a brighter backdrop ever sits under editorial text on `/steam`.
- **The chips flow in columns, not a grid.** [chip-band.tsx](../../../apps/web/src/steam/portrait/chip-band.tsx) carries both halves' supporting cards. A grid aligns independent one-line claims into rows, so the four-card Portrait band left one card alone beside two empty cells — the same orphan L1 had just removed, re-created by the hero taking a card out of the grid. CSS multi-column packs by height instead, which is what these cards want: they share no row semantics, only a band. Measured `main.scrollHeight` 2415 → 2279 px on the switch.
- **L4 — Anti-Portrait hero band.** ✅ Done 2026-08-02. [anti-portrait-hero.tsx](../../../apps/web/src/steam/portrait/anti-portrait-hero.tsx) opens the half with **120 never opened**, the page's sharpest single number, and card 13 is deleted into it. Under the prose the three counts become a funnel — owned, played past an hour, finished — each drawn as a share of the *same* denominator rather than of the step above it, so the bars shorten against one another and the collapse is visible instead of arithmetic the reader has to do. The `finished means…` disclosure survives the card's retirement as a footnote under the funnel; it is the narrowest word on the page and 18-of-186 would otherwise read as 18-of-everything.
- **L5 — Re-probe and record.** ✅ Done 2026-08-02. **`/steam` did already have a budget row** — under the handle `steam-library`, which predates `/steam/library` existing and measures the profile page. The plan expected to establish a number and instead defended one, and the pass came in *under* the previous baseline: **26 layers / 59–74 ms raster (median 67) / 0–1 long tasks / dropped 0** across a 3-run bracket, against 30 / 100 ms / 1 before. Eleven frosted fact cards became nine chips plus two hero bands that carry no `backdrop-filter`, so the editorial treatment cost less compositor work than the tiles it replaced. Both the budget row and the scenario definition now say which route the handle actually covers.

- **L6 — Tidy pass, on owner review.** ✅ Done 2026-08-02. The first cut of L1–L5 read as cluttered, and four of the causes were structural rather than taste. **The masthead was the only element off the band's left margin** — the design spec's baseline-aligned eyebrow indents it, which breaks the spine every other element shares; the eyebrow is gone in both heroes and the section header carries that job. **CSS multi-column was worse than the grid it replaced**, scattering cards so one column carried two while its neighbours stopped early; `ChipBand` is a grid again, and its column count is a prop, because four chips across three columns strand one on a row of its own. **`mt-auto` on the prescription was the actual L1 defect, not stretching** — in a stretched card it opens a hole in the middle rather than collecting slack at the bottom, so it now belongs to the comfortable density only, and the chips stretch to clean rows again. And **the Anti-Portrait band is ordered by what each card carries**: the three claim cards share row one, the two that render a four-row list share row two, which removed ~180 px of dead space that one outlier had been setting. Spacing between sections went to `gap-12` against `gap-6` inside them, so a band header stops reading as part of the band above it. The hero prose and bars now run the full column rather than a `max-w-2xl` measure — a text column narrower than the grid under it is standard editorially and read as a mistake here, because nothing else on the page stops short.
- **Statistic rows carry tooltips.** [stat-row.tsx](../../../apps/web/src/steam/portrait/stat-row.tsx) is the label · bar · figure row shared by both hero bands and the bounce card, in two size registers. Each row is a `button` rather than a hovered `li`, so the numbers behind the bar reach keyboard users too — verified in a browser on both hover and focus. The genre tooltip carries the one caveat the row can't: a game's hours are *divided* between its genres rather than counted once per genre, which is the only reason the shares add up.
- **And the tooltips name the games behind the bar.** `GenreShare` gained `examples` — the genre's biggest carriers, capped at three — built in [fingerprint.ts](../../../packages/shared/src/steam/portrait/fingerprint.ts) from carriers it was already collecting to count. Two things about them. The example's `minutes` is the **game's own** playtime, not the slice that genre was attributed, so they deliberately do not sum to `GenreShare.minutes`; the row answers *which games are these*, not *where did the total come from*, and the type says so. And the bounce card needed no new field at all: the tasted fingerprint's carriers **are** the abandoned games, so its examples answer "which ones did I drop?" for free — `JRPG 2/2` now names FINAL FANTASY XV (5m) and NieR Replicant (1m). Live check worth knowing: `Souls-like` and `Action RPG` list the same three games, because those games carry both tags. That is honest rather than broken, and it is also *why* the two genres track each other.

**The layout pass made the page taller, not shorter, and that is the trade the direction bought.** `main.scrollHeight` at 1440×900: **2199 px** with eleven compact cards and no heroes, **2279 px** after the Portrait hero replaced one, **2520 px** after the Anti-Portrait hero replaced another. Each hero costs roughly 120 px more than the card it retired, and returns a masthead the eye lands on. The pre-pass baseline was never measured, so the honest comparison is against L2 rather than against the page the owner complained about. If the length is still the sharper complaint, the remaining levers are the identity hero above the sections and the trophy-case + chip strip below them — the two portrait bands are now the *smaller* half of the page.

**Chunk P — The portrait becomes its own page.** ✅ Done 2026-08-02, on the owner's call after the layout pass. `/steam` was doing four unrelated jobs — identity, the portrait essay, the trophy case, three utility chips — and only one of them was an argument. [routes/steam/portrait.tsx](../../../apps/web/src/routes/steam/portrait.tsx) is now a fifth Steam tab (`Fingerprint` icon), carrying both bands and the loader prime that used to sit on the section landing. Four things fell out of it:

- **`/steam`'s document halved**, 41.3 kB → 20.3 kB, because the portrait payload left with the sections that read it. The landing page now has **no loader at all**: what remains is identity and counts, each chip owning its own query.
- **`/steam/portrait` server-renders its whole argument** — 2,372 characters of text carrying "Souls-like", "120 never opened", "The gap is the hobby" and "given up on". It clears all three questions in the SSR priming rule: indexable prose, small payload (3.6 kB + 166 B), and both endpoints answered from our own Postgres in ~15 ms.
- **The tab order had three copies and now has one.** `STEAM_TAB_SEGMENTS` in [steam/tabs.ts](../../../apps/web/src/steam/tabs.ts) is read by the strip, by `navigation-type.ts`'s slide classifier, and by the WebKit substitute animation. The old comment said to fold them "if a third surface needs the same ordering" — the actual trigger turned out to be a fifth *tab*, since a tab present in two of three literals does not fail, it slides the wrong way. The strip's chrome is keyed by segment and `satisfies Record<SteamTabSegment, …>`, so the next tab is a type error until it has a label and an icon.
- **The profile page's raster floor went *up* when content was removed**: 26 layers / ~67 ms → 31 / ~129 ms. The portrait bands used to push the trophy-case art and the wishlist capsule below the fold, where they never rastered at load. Both budget rows are updated in [repo-conventions.md](../../repo-conventions.md); `/steam/portrait` baselines at **24–25 layers / ~53 ms / 0 long tasks**, cheaper than the page it left despite carrying more.

The ⌘K palette carries a `Portrait` entry in the Steam scope, matching on *genres* and *backlog* as well as the name.

**The funnel's `Finished` row names its games too.** `CompletionSummary` gained `finished` — up to three, longest-played first, since every game there is already past the finished bar so completion no longer separates them. Only that step names anything: `Owned` and `Played past an hour` would each list whatever has the most hours, which the profile page already shows and which says nothing about the step. Live it reads *ELDEN RING NIGHTREIGN 434h · ELDEN RING 378h · DARK SOULS III 117h · +15 more*, which is the first time "finished 18" is a picture rather than a number.

**Chunk 4 — Backlog recommendations.** Scoring service in the API; three surfaces on the web side. Sits between the two halves visually.

- **4a — Shared scoring + API.** ✅ Done 2026-08-05. [backlog.ts](../../../packages/shared/src/steam/portrait/backlog.ts) scores every never-launched owned game against the portrait, and `SteamPortrait` gained a `backlog` block carrying the three picks with their arithmetic. **Scored against the lifetime fingerprint, not the recency window the catalog specced** — that window holds three games and 29 hours, so matching against it would recommend one recent purchase back at itself. Swapping the argument is the only change needed when the window fills.
  A candidate's score is the **share of the portrait its genres account for**, not a count of tag hits: matching two genres worth 3% between them must not beat matching one worth 30%. The age penalty counts back from the library's newest release rather than from the clock, because the score ships to the browser and is re-read at hydration — `Date.now()` on both sides of that boundary is the bug the SSR convention is about.
  **The measured lines, 2026-08-05, against 117 candidates:**

| Card | What it says |
|---|---|
| Pick up next | **Nioh 3** — 3 of its 3 genres match (Souls-like, Action RPG, Hack and Slash), scoring 55%. Runners-up: Nioh Complete 55%, Lords of the Fallen / Mortal Shell II / CODE VEIN 53%. |
| Sleeping on this genre | **Souls-like** — 705h played, **11 untouched** (Mortal Shell II, Ghost of Tsushima, Lords of the Fallen). |
| Tasted but never returned | **Where Winds Meet** — 49 minutes in it, matching Souls-like + Action RPG + Action-Adventure at 58%, the highest score on the page. |

- **4b — The band.** ✅ Done 2026-08-06. [backlog-band.tsx](../../../apps/web/src/steam/portrait/backlog-band.tsx) sits between the two halves under a **What to play** header, carrying the three cards as compact chips. No hero of its own: position does the bridging — the Portrait establishes the taste, this points it at the shelf, the Anti-Portrait explains why the shelf is that long — and a third masthead would make the page read as three essays instead of one. Verified in the browser rather than the suite alone, which changed three things.

  **Both single-game cards match on every genre they carry**, so the first cut had them opening with the same sentence side by side. The pick keeps the arithmetic (*"Every genre it carries is one you play: …, 55% of your portrait between them"*) and the reopen card leads with the contrast instead (*"Whatever stopped you, it wasn't the genre: …"*), which is its point anyway. `describeMatch` split into `describeCoverage` + `describeGenres` so the two compose differently rather than sharing one sentence. A test pins that only one card opens that way.

  **Both count indicators were repeating their own verdict** — `11 waiting` above *"own 11 you've never launched"*, `49 minutes` above *"got 49 minutes and stopped there"* — and at 275 px they cost enough width to wrap two of the three titles onto a second line, which left the verdicts starting at different heights across the row. Dropping both fixed the duplication and the ragged row in one move.

  **`ChipBand` gained a `3-up` column mode.** The default `md:grid-cols-2 xl:grid-cols-3` strands one of three cards for the whole md–xl range. Three-up from `md` costs 225 px columns at that breakpoint against the 275 px every other band settles at; measured, that is 37 px of extra card height and **223 px less band**, because the alternative is three full-width cards carrying a chip's worth of text each.

  Rhythm measured at 1440: 48 px above the band and 48 px below, matching the `gap-12` the two halves already sit at. All four claims are in the served HTML, console clean, no response ≥ 400.

- **4c — Re-probe.** ✅ Done 2026-08-06. **26 layers / 61–67 ms raster median ~63 / 0–1 long tasks / dropped=0** across a 3-run bracket, against a ≤ 30 / ≤ 100 ms budget — three more frosted chips cost ~2 layers and ~10 ms over the route's first baseline. The budget row in [repo-conventions.md](../../repo-conventions.md) records the new floor rather than widening the ceiling, so the next reader doesn't read the delta as drift.

- **The sleeping-genre ranking took a measurement to get right.** Ranked by waiting count alone — the obvious reading of the spec — it crowns `Action` (112 waiting, **1%** of the portrait) and `Adventure` (101 waiting, 1%): umbrella genres that every bundle leftover carries, which is the opposite of a genre the owner loves. Ranked by share alone it crowns the anchor genre, which is where "Pick up next" already draws from, so the two cards say the same thing twice. **Share × waiting count** is what shipped — "how much of the portrait is sitting unplayed here". The pick is also excluded from the named sample but not from the count, since both cards draw from the same pool and the strongest match in the strongest genre otherwise appears in both.

**Chunk 5 — Copy + footnote polish.** ✅ Done 2026-08-06. Scoped by reading every card's rendered copy off the live page at once rather than from the source, which is the only way the repetitions are visible — each card is defensible alone.

**The page stated its sharpest number three times.** `119 never opened` was the Anti-Portrait's masthead, the second line of `Library posture`, and the second line of `Tasted tier`. Both cards now spend that line on something they own: posture stops at the concentration claim, and the tasted tier states its own ceiling (*"not one of them reached an hour"*), which is what put those games in the cohort. The same defect caught the new `Sleeping on this genre` on its second pass — its first cut opened with *"706h across 16 Souls-like games"*, which is verbatim what the Portrait masthead two bands above already says, since the sleeping genre is usually the anchor genre. It leads with the untouched count instead: **"11 Souls-like games you've never launched, against 16 you've put 706h into."**

**Two claims named no population.** `Worth reopening` now says which pool it won (*"Best match of the 11 you dropped inside the hour"*) and `Sleeping on this genre` carries the played-carrier count, read off the lifetime fingerprint rather than added to the wire. That closes the *"based on N of M"* affordance; the `← from community tags` footnote had already shipped on the Portrait header in 2b.

**The threshold pass changed nothing, which is the result.** Every gate was checked against its live output: the 60-minute floor splits 186 into 56 / 11 / 119, the ten-hour completion floor admits 34, the bounce floor's rows are 2/2, 2/3 and 3/7, the rank limit holds the fingerprint at Souls-like / Action RPG / Third-Person Shooter, and every `*_LIMIT` of 3 or 5 is paired with a `+N more`. One thing to know rather than to fix: **`ANCIENT_PENALTY` cannot reach any rendered surface.** It applies only where the genre overlap is zero, and `bestMatch` drops zero-overlap candidates before ranking, so it sorts a tail nothing displays. `scoreCandidate` is exported, so a future surface that ranks the unmatched remainder would see it — until then, tuning it changes nothing on screen.

Tests required in the same commit as the components (per `docs/repo-conventions.md` — every Portrait card has routing/interactive elements, so the same-commit testing rule applies; axe scan included).
