# Steam — Sessions (`/steam/sessions`)

**Status:** Active — chunks 0, 1 and 2 shipped 2026-09-14: the data probe is recorded below, the pure beat model, unlock join and hour matrix live in `packages/shared/src/steam/sessions/`, and `GET /api/steam/sessions?weeks=N` serves the whole page from `SteamSessionsService`, measured at 89 kB / ~35 ms for 41 sessions. Chunk 3 (route, hero, records, and the tab-strip width decision) is next.

## Naming

Tab label **Sessions**, route `/steam/sessions`, matching `SteamPlaySession`. "Sitting" was the working name and appears nowhere in user-facing copy; where this note still says sitting, read session.

## Premise

The api has recorded every observed Steam launch since 2026-05-16 as a `SteamPlaySession` row, and every achievement unlock carries Steam's own `unlocktime`. Today those rows feed exactly one surface: the five-bucket duration histogram on the recap's rhythm band. Everything about *when* the owner plays, *how long a sitting runs*, and *what happened inside it* is sitting in Postgres unread. This page reads it.

The framing the owner set on 2026-09-14: unlocks are one signal among several, not the subject. A sitting with zero unlocks is not a placeholder; it is a sitting whose headline comes from a different axis. Nothing on this page ever renders "no unlocks this session".

## Surface decision

A seventh Steam tab, `/steam/sessions`, sibling to `/steam/portrait`. The existing six are Profile, Portrait, Library, Wishlist, Upcoming and Achievements, and none of them is about time. The portrait says who the owner is when they play; this page says what their evenings look like.

The `/steam` landing carries a single **last sitting** card linking in, per the one-curated-highlight rule in [repo-conventions.md](../../repo-conventions.md) § "Per-stream routes". Nothing about sittings goes on `/` except through the recap's cross-stream ranking (chunk 6, optional).

Every read on this page names a game, so the whole endpoint is viewer-scoped on both sides per [hidden-games.md](hidden-games.md): a hidden game's sessions drop out for a visitor, and aggregates (the heatmap, the window count, rank denominators, the first-observed date) still count them anonymously. Chunk 2 implements that split by running the session query unfiltered and projecting in the service, while the unlock query is filtered at the database because every unlock row names its game. A hidden *neighbour* is nulled before the beat pass, since `bounced-from` / `moved-on-to` would otherwise carry its name.

## Chunk 0 findings — measured 2026-09-14, local database

The prod database was not probed (the session's permission classifier blocked the ssh read). Prod has run continuously since 2026-07-27, so its table is denser than this; the numbers below are the floor, not the population.

| | |
|---|---|
| Closed sessions | 68 across 12 games, 2026-05-16 → 2026-09-13 |
| Duration buckets | `<30m` 28 · `30m–1h` 9 · `1h–2h` 18 · `2h–4h` 10 · `4h+` **3** |
| August + September | 40 sessions, 80.4 hours |
| Unlocks since 2026-07-27 inside an observed session (±4 min) | 56 of 237 |

Three things follow:

- **The `4h+` gate from [player-portrait.md](player-portrait.md) has opened.** It read 0 on 2026-08-06 and reads 3 now. Cards 4 and 8 there are unblocked by the same fact, and this page is where the marathon count belongs anyway.
- **The unlock↔session join is sound.** Shifting `unlockedAt` by −2, −1, +1 or +2 hours matched 28, 47, 32 and 24 unlocks against 56 at zero shift, so there is no timezone defect between the two naive-timestamp columns. The slack exists because `endedAt` is the *previous* 2-minute tick, not the moment the game closed.
- **The orphans are coverage, not error.** 181 unlocks since 07-27 sit outside any session: 43 in Mortal Shell II, 33 in Mortal Shell, 23 in Beast of Reincarnation and a 53-unlock day in a game with no session row at all. The nearest-session gap clusters at 4–10 hours, which is the local api being down while the owner played. These render as the **off-camera ledger** (below) rather than being force-fit into a neighbour.

The last twelve rows already read like the page: nine Onimusha sittings in one week, unlock counts of 0 to 5, a 260-minute Saturday marathon beside a 46-minute Tuesday. Two of the nine had no unlocks and both have a duration-rank or cadence headline available.

## The beat model

A sitting's headline is chosen, not templated. Each signal produces zero or one **beat** with a strength; the strongest becomes the hero prose, the next one or two become supporting chips. This is a pure pass in `packages/shared/src/steam/sessions/` (`selectSessionBeats` in `beats.ts`), sibling in spirit to `recap-scoring.ts`, and it is the reason the page has no boring branch.

Signals, all from existing tables:

| Signal | Source | Example copy |
|---|---|---|
| Duration + clock | `startedAt`, `endedAt`, Brussels | "A past-midnight run, 22:40 to 02:52" |
| Rank within game | other rows for the appid | "Third-longest Onimusha sitting of 14" |
| Rank within window | rows in the last N weeks | "Longest sitting in five weeks" |
| Cadence | gap to previous sitting, same appid | "First Cyberpunk since June" / "Fourth evening in a row" |
| Playtime milestone | `SteamPlaytimeSnapshot` delta across the sitting | "Elden Ring passed 400 hours tonight" |
| Share of lifetime | duration ÷ `playtimeForever` | "3h, all of them" for a first sitting |
| Neighbours | adjacent session rows | "Opened after 8 minutes of Wallpaper Engine" |
| Completion state | `SteamGameCompletion` | "Still 14 out" / "Nothing left to unlock, and still back" |
| Unlocks + rarity | `SteamPlayerUnlock` × `SteamAchievementGlobalRarity` | "Three unlocks, rarest *Blademaster* at 2.3%" |
| Usual slot | the heatmap cell this sitting lands in | "A Tuesday, in the usual slot" |

Absence is never a beat. "No unlocks" scores nothing; a five-hour dry sitting gets "longest in five weeks" and the unlock row simply isn't drawn. The fallback when every axis is quiet is the sitting's own shape: "Two hours of Nightreign, a Tuesday, in the usual slot", and "usual slot" is a real claim because the heatmap earns it.

Strengths are relative, not absolute: rank beats score by how far from the median they sit, cadence by the log of the gap, milestones by the roundness of the number crossed. Pin the weights in one file with a fixture per beat kind, the way `recap-scoring.ts` does.

## Page composition

Editorial hero band, then dense bands below, the shape the portrait's layout pass landed on ([subject-chapter-design-spec.md](../cross-cutting/subject-chapter-design-spec.md) applies).

1. **Hero: the last sitting.** Game art backdrop, duration as the masthead, the winning beat as prose, supporting beats as chips. Unlock icons cascade in as a row *only when present*, rarity under each, hidden achievements masked as `???` per the S4 decision. Calm: the duration does not count up.
2. **Sitting timeline.** Weeks as rows, hours as columns; each sitting a bar positioned by start hour and sized by duration, coloured by game accent, unlock dots pinned at their exact `unlockedAt` inside the bar. Hover a bar for the digest tooltip. A brush along the bottom scrubs the window. **visx**, because brush + timeline is exactly what visx is reserved for; plain SVG stays for the dot and line overlays.
3. **Hour-of-day heatmap.** 7 × 24 minutes-played per weekday-hour, Brussels time. The Steam sibling of the LoL chronotype; reuse the death-matchup heatmap plumbing. Unlock-free by nature.
4. **Per-game rhythm strips.** Small multiples: one strip per game in the window, sitting lengths as bars over time, unlocks as optional ticks. A game with no achievements at all still gets a strip. Plain SVG.
5. **Playtime milestones.** Which sittings pushed a game past 10, 50, 100, 500 hours. Pure duration data.
6. **Records chips.** Longest sitting, latest finish, most unlocks in one sitting, longest dry spell, quickest bounce. Each names the game and links to `/steam/library/$appid`. This is where the portrait's cards 4 and 8 land.
7. **Off-camera ledger.** Unlocks with no matching sitting, grouped by game and day, captioned "unlocked while the api wasn't watching", with the count. Turns the coverage caveat into a feature instead of a lie. Every aggregate above carries a "based on N sittings since <first observed>" footnote.

## Data shape

One endpoint, one type, one query:

```ts
// packages/shared/src/steam/sessions/sessions.ts
export type SteamSittings = {
  window: { from: string; to: string; observedSince: string; sittingCount: number };
  sittings: SteamSitting[];          // newest first; each carries its beats + unlocks
  hourMatrix: number[][];            // 7 × 24 minutes, Brussels
  perGame: SteamSittingGameStrip[];  // appid, name, accent, sittings[], unlockTicks[]
  milestones: SteamPlaytimeMilestone[];
  records: SteamSittingRecords;
  offCamera: SteamOffCameraUnlockGroup[];
};
```

`GET /api/steam/sessions?weeks=N` behind `@WithViewer()` + `@ViewerIsOwner()`, service takes the curation sets as an argument, web key ends in `viewerScope(isOwner)`, fetch sends `credentials: "include"`. The loader primes the *public* key; the page reads only our Postgres so it qualifies for SSR priming the same way the portrait did. **Measured 2026-09-14 against the dev api at 12 weeks: 89 kB in 33–42 ms over three runs, 41 sessions, 8 game strips, 2 milestones, 21 off-camera groups.** The bulk is the unlock rows (description and icon per unlock, once in the digest and once more in the ledger). That is 25× the portrait's payload and clears the SSR latency question but not the size one; chunk 3 decides whether the hero primes alone (a `weeks=1` read) with the rest fetched on the client, or whether unlock descriptions leave the payload.

The unlock join: `unlockedAt BETWEEN startedAt - 4 min AND endedAt + 4 min`, same appid. The slack is `SESSION_UNLOCK_SLACK_MS` in `unlocks-within.ts`, with the boundary pinned in its test.

## Chunk plan

**Chunk 0 — Data probe.** ✅ Done 2026-09-14, findings above. No code.

**Chunk 1 — Shared beat model + types.** ✅ Done 2026-09-14. `packages/shared/src/steam/sessions/`: the `SteamSessions` response family (`sessions.ts`), `SESSION_UNLOCK_SLACK_MS` + `unlocksWithin()` + `unlocksOffCamera()` (`unlocks-within.ts`), `buildHourMatrix()` + `localSlot()` (`hour-matrix.ts`, with fall-back and spring-forward fixtures), and `selectSessionBeats()` (`beats.ts`) with a fixture per beat kind and one proving a zero-unlock session still ends with a `shape` headline. Review changed four things before it landed: `unusual-slot` compared the whole session against its start cell and fired on a weekly habit, so it now subtracts only the session's own share of that hour; `longest-in-window` let tied durations both claim the title, so the newer one wins; `late-finish` fired on twelve minutes straddling midnight, so it needs an hour; and `completed-and-back` at hero strength would have headlined every later session of a finished game, so it sits at chip strength. Pure, no I/O.

**Chunk 2 — API.** ✅ Done 2026-09-14. [sessions.service.ts](../../../apps/api/src/steam/presence/sessions.service.ts) behind `GET /api/steam/sessions?weeks=N` (default 12, clamped 1–52), viewer-scoped per the four-piece contract, joining sessions, unlocks with schema and rarity, daily snapshots and completion counts. The snapshot join had to learn what a snapshot row is: keyed by owner-local day and rewritten every quarter hour, so the row dated D holds play through the end of D — the lookup reads the row for the day a session ended on and subtracts every later same-game session up to that day's end, otherwise an early session in a busy week carries the week's milestones. Review also floored `quickestBounce` at two minutes (a single-tick session closes at its own `startedAt`), clamped `latestFinish` to one day so a day-long run cannot outscore a real 02:52, and moved the hidden-game projection out of the session query so the aggregates count anonymously as decided above. Measurement recorded under *Data shape*.

**Chunk 3 — Route + hero.** Live data already says what the hero copy has to handle: `unusual-slot` at 0.35 wins the headline for three of the eight newest sessions, because a 20-hour matrix over eight games leaves most cells empty. Either the threshold rises with the matrix or the copy for it is written to carry a hero. Decide in this chunk, not the copy pass. `/steam/sessions` as the seventh tab (icon TBD; `Clock` is the obvious pick), loader-primed, carrying the hero band and the records chips. **The strip has to make room first**: the full-row tier breaks at 880 px, a number set for LoL's four tabs and a long Riot ID, and six Steam tabs already sit near it. Measure at 880, 980 and 1100 with the seventh tab in place, then give the shell a per-section full-row breakpoint (Steam ≈ 980) rather than a shared constant. Fallback if that feels late on laptops: icon-only labels between the break and ~1100 via the existing `data-tab-label` hook. Re-folding Upcoming into Wishlist was considered and rejected — it reverses the 2026-08-11 split. Test: hero renders a headline for a fixture sitting with no unlocks. Axe scan. Budget row in [repo-conventions-web.md](../../repo-conventions-web.md).

**Chunk 4 — Timeline + heatmap.** The visx timeline with brush, the hour heatmap. Engine-gate anything the brush does that Firefox or WebKit disagree with; probe in a real browser, happy-dom does not lay out.

**Chunk 5 — Strips, milestones, off-camera ledger, landing card.** The remaining bands, plus the single last-sitting card on `/steam` linking in. Then a copy pass off the live page, the way portrait chunk 5 was done.

**Chunk 6 — Recap candidate (optional).** A `steam-sitting` moment kind in `recap-scoring.ts` scored by hours + unlocks × 0.5, so a notable sitting can reach `/` through the ranking. Only if the recap's Steam cap (5 subjects) leaves room; check before building.

## Open decisions

1. ~~**Window default.**~~ **12 weeks, decided 2026-09-14** off the chunk 2 measurement: 41 sessions and 89 kB. Widening is a query param away; the open question is now payload size, tracked under *Data shape*.
2. **Demo and benchmark apps.** `Onimusha: Way of the Sword DEMO` and `…Benchmark` are separate appids with their own sittings. Fold into the parent by name heuristic, hide via curation, or show as-is? Leaning show-as-is with the curation overlay as the owner's lever, since a heuristic on names is the kind of thing hidden-games retired.
3. **Open sessions.** A sitting in progress (`endedAt IS NULL`) is the now-playing strip's job; this page shows closed rows only, and the hero says "now playing, N minutes in" if the newest row is open. Confirm against the strip so the two don't disagree.

## Related

- [player-portrait.md](player-portrait.md) — cards 4 and 8 and the single-session cohort move here.
- [steam-integration.md](steam-integration.md) § S6.C/S6.D — the session state machine and the event-driven unlock refresh this page reads.
- [hidden-games.md](hidden-games.md) — the viewer-scoping contract every read here must satisfy.
- [subject-chapter-design-spec.md](../cross-cutting/subject-chapter-design-spec.md) — hero band composition and cascade.
