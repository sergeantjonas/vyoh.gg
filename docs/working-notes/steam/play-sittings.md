# Steam — Sessions (`/steam/sessions`)

**Status:** Active — chunks 0–3 shipped 2026-09-14/15: the data probe is recorded below, the pure beat model, unlock join and hour matrix live in `packages/shared/src/steam/sessions/`, `GET /api/steam/sessions?weeks=N` serves the whole page (89 kB / ~35 ms for 41 sessions), and `/steam/sessions` is live as the seventh Steam tab with the last-session hero and the five records chips, baselined at 33 layers / ~61 ms. The tab strip fits seven tabs at 880 px with 50 px to spare, measured, so no per-section breakpoint was needed. A stitched 29-hour row the owner spotted on the records band led to a poll-gap boundary in the session state machine on 2026-09-15. **Chunk 3b (the live-session hero) shipped 2026-09-15**: while a game is open the hero counts up from the open row's start, gated on the poller having ticked within fifteen minutes. Chunk 4 (timeline + heatmap) is next.

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
| Duration buckets | `<30m` 28 · `30m–1h` 9 · `1h–2h` 18 · `2h–4h` 10 · `4h+` **3** — one of the three is a stitched row, see below |
| August + September | 40 sessions, 80.4 hours |
| Unlocks since 2026-07-27 inside an observed session (±4 min) | 56 of 237 |

Three things follow:

- **The `4h+` gate from [player-portrait.md](player-portrait.md) has opened.** It read 0 on 2026-08-06 and reads 2 real rows now (a third is the stitched row described below). Cards 4 and 8 there are unblocked by the same fact, and this page is where the marathon count belongs anyway.
- **The unlock↔session join is sound.** Shifting `unlockedAt` by −2, −1, +1 or +2 hours matched 28, 47, 32 and 24 unlocks against 56 at zero shift, so there is no timezone defect between the two naive-timestamp columns. The slack exists because `endedAt` is the *previous* 2-minute tick, not the moment the game closed.
- **The orphans are coverage, not error.** 181 unlocks since 07-27 sit outside any session: 43 in Mortal Shell II, 33 in Mortal Shell, 23 in Beast of Reincarnation and a 53-unlock day in a game with no session row at all. The nearest-session gap clusters at 4–10 hours, which is the local api being down while the owner played. These render as the **off-camera ledger** (below) rather than being force-fit into a neighbour.

**One `4h+` row is not a sitting.** The owner spotted it on the live records band on 2026-09-15: `Mortal Shell II`, 2026-08-18 19:56 → 08-20 01:16, 29 h 20 m. The unlocks inside it cluster 22:00–01:00 on both nights, and the daily playtime snapshots for those days add 381 + 260 minutes — under eleven hours of actual play. The api had stopped polling for most of a day (the dev laptop asleep) with the game showing on both sides of the gap, and `computeTransition` treated same-appid ticks as a no-op regardless of how long since the last one, so two evenings became one row. Fixed forward in [play-sessions.service.ts](../../../apps/api/src/steam/presence/play-sessions.service.ts): a gap over `SESSION_POLL_GAP_MAX_MS` (15 min, seven missed ticks) closes the open session at the last tick that saw it and opens a fresh one. **The historical row cannot be split faithfully** — there is no poll log, only the unlock timestamps hint at where the evenings were — so it stays until the owner decides between deleting it and leaving it. The gate (a non-empty `4h+` bucket) is still met at 2 real rows.

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

**Chunk 3 — Route + hero.** ✅ Done 2026-09-15. [routes/steam/sessions.tsx](../../../apps/web/src/routes/steam/sessions.tsx) is the seventh tab (`Clock`), second in the strip after Portrait since both are about the player rather than the shelf; [last-session-hero.tsx](../../../apps/web/src/steam/sessions/last-session-hero.tsx) opens it with the duration as masthead, the lead beat as prose, the next two beats as chips and the unlock row only when there is one; [records-band.tsx](../../../apps/web/src/steam/sessions/records-band.tsx) carries the five records as `FactCard` chips; [session-copy.ts](../../../apps/web/src/steam/sessions/session-copy.ts) is the one place beats become sentences. Four decisions landed here rather than as planned:

- **Not loader-primed, reversing the plan.** The 12-week payload is 89 kB and the ledger is half of it; inlining that into the document for a 2 kB hero is the wrong trade. The route renders its skeleton on the server and the hero cascades in. Priming is one line in the hook and one in the route once chunk 5 makes the ledger compact.
- **The strip needed nothing.** Measured in Chromium at 880, 940, 980, 1024, 1100 and 1280 with the seventh tab in place: the tab row ends at 804 px inside an 856 px strip at 880, no overflow, no wrap. The 880 break was sized for a long Riot ID, and `Vyoh` is short. The per-section breakpoint stays unbuilt until a measurement asks for it.
- **`unusual-slot` is gated on texture.** `BEAT_UNUSUAL_SLOT_MIN_CELLS = 40` filled cells before an empty cell reads as unusual; the live matrix filled ~25, which is why three of the eight newest sessions were headlining it.
- **Rarity copy uses `formatRarityPercent`**, the shared helper with Steam's 0.05 resolution, after review caught two local copies with a different cutoff.

Baselined at 33 layers / 55–101 ms raster median ~61 / 0–1 long tasks / dropped 0 over three runs; the budget row in [repo-conventions-web.md](../../repo-conventions-web.md) records it. Live copy observation for chunk 5: the records band currently names a 29 h 20 m Mortal Shell II sitting as *Longest* — a game left running overnight is a real row and an honest number, but "in one sitting" is the wrong phrase for it, and a duration cap or an idle heuristic is a data question before it is a copy one. Test: hero renders a headline for a fixture sitting with no unlocks. Axe scan. Budget row in [repo-conventions-web.md](../../repo-conventions-web.md).

**Chunk 4 — Timeline + heatmap.** The hero's clock line and the records chips already give the page its time vocabulary; the timeline should reuse `clockOf` from `session-copy.ts` rather than format a third way. The visx timeline with brush, the hour heatmap. Engine-gate anything the brush does that Firefox or WebKit disagree with; probe in a real browser, happy-dom does not lay out.

**Chunk 5 — Strips, milestones, off-camera ledger, landing card.** The remaining bands, plus the single last-sitting card on `/steam` linking in. Then a copy pass off the live page, the way portrait chunk 5 was done.

**Chunk 6 — Recap candidate (optional).** A `steam-sitting` moment kind in `recap-scoring.ts` scored by hours + unlocks × 0.5, so a notable sitting can reach `/` through the ranking. Only if the recap's Steam cap (5 subjects) leaves room; check before building.

## Live session (owner idea, 2026-09-15)

While a game is open, the hero should be the *current* session: "Now playing · Onimusha" as the eyebrow, a duration counting up from the open row's `startedAt` as the masthead, and the beats the session has already earned as chips (a streak or a return is known at launch; unlocks arrive with the event-driven refresh on close, so mid-session the unlock row stays empty and honest). This answers open decision 3 below and replaces the plan to defer to the now-playing strip. Needs: the api to carry `live: { game, startedAt } | null` from the open `SteamPlaySession` row (today the service drops open rows), the web hook's `staleTime` to shorten while `live` is set, and a minute-resolution ticker — the number moves, it does not spin; per the calm-aesthetic rule the masthead re-renders once a minute with a soft pulse on the eyebrow dot rather than counting seconds. Scoped as **chunk 3b**, ahead of the timeline, because it is the page's most visible moment and the cheapest remaining one.

✅ **Done 2026-09-15.** `SteamSessions.live` carries the open row with `selectLiveSessionBeats()` — the pass filtered to the seven kinds known at launch, run over a matrix that includes the running session so the slot arithmetic stays sound. Review added the guard the first cut lacked: an open row is live only if the player-state poll is within `SESSION_POLL_GAP_MAX_MS` **and** still shows that game, because the row closes on the tick that sees the game gone and no tick comes while the api is down. On the web, `useElapsedMinutes` re-renders on the elapsed-minute boundary (not a wall-clock interval, so the number steps exactly when it changes), reads the clock on first render because the route is not server-primed, and the hook polls the endpoint every two minutes only while `live` is set. The now-playing strip on `/` reads `SteamPlayerState`, not this row, so the two *can* momentarily disagree by one tick; the freshness gate keeps that to a tick rather than an outage.

Verified live: at 00:52 Brussels on 2026-09-15 the dev api reported Onimusha open since 22:20 with the last poll a minute old, and the hero read `2h 31m`.

**Owner review, 2026-09-15: "could be a little more interesting" — accepted, parked behind chunk 4.** With no launch-time beat the live hero is a clock and a start time. Candidates, cheapest first: a *running rank* beat ("already longer than 6 of your 10 Onimusha sessions" — the closed rows are in the payload, so the web can compute it against the ticking minutes with no api change, and it moves during the session, which the clock alone does not); the game's median session as a quiet tick under the masthead so the reader sees where this one sits; the *usual finish* for this weekday slot ("you usually stop around 01:00"); a mid-session unlock refresh so unlocks appear while playing rather than at close (api: run `refreshUnlocksForGame` on a timer while a session is open, not only on close). Pick after the timeline exists, since the timeline gives the live session a visual home too.

**Chunk 0 amendment, 2026-09-15.** The 29-hour row was split along its unlock clusters rather than deleted, on the owner's call: `cmsz31xfw0004d5nds7lrrxa1` now ends 2026-08-19 00:35Z (4 h 39 m, five unlocks), and two new rows cover 08-19 14:45 → 18:20Z (3 h 35 m, two unlocks) and 08-19 21:30 → 08-20 01:16Z (3 h 46 m, three unlocks). Twelve hours against the snapshots' ten-and-a-bit; the boundaries are estimates and the note is their only record. The `4h+` bucket reads 3 again, all of them real.

## Open decisions

1. ~~**Window default.**~~ **12 weeks, decided 2026-09-14** off the chunk 2 measurement: 41 sessions and 89 kB. Widening is a query param away; the open question is now payload size, tracked under *Data shape*.
2. **Demo and benchmark apps.** `Onimusha: Way of the Sword DEMO` and `…Benchmark` are separate appids with their own sittings. Fold into the parent by name heuristic, hide via curation, or show as-is? Leaning show-as-is with the curation overlay as the owner's lever, since a heuristic on names is the kind of thing hidden-games retired.
3. ~~**Open sessions.**~~ **Decided 2026-09-15: the hero becomes the live session while one is open** — see *Live session* above. The now-playing strip on `/` keeps its job; the two read the same open row so they cannot disagree.

## Related

- [player-portrait.md](player-portrait.md) — cards 4 and 8 and the single-session cohort move here.
- [steam-integration.md](steam-integration.md) § S6.C/S6.D — the session state machine and the event-driven unlock refresh this page reads.
- [hidden-games.md](hidden-games.md) — the viewer-scoping contract every read here must satisfy.
- [subject-chapter-design-spec.md](../cross-cutting/subject-chapter-design-spec.md) — hero band composition and cascade.
