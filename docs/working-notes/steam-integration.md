# Steam integration

A working note for the planned Steam integration. Stated cadence (owner, 2026-05-14): **start soon, once the LoL feature backlog runs lower** — Steam is the next big content axis after LoL, not a parallel track.

Steam shares the recap / `ConclusionCard` engine with LoL: *"you played 6h of Helldivers this week, mostly in 2-hour sessions, longest break in three months"* reads exactly like a LoL trends conclusion. The architectural rule: **do not build Steam as a parallel system.** Share the trends/recap primitives, the verdict-card pattern, and the timeseries plumbing.

Sibling doc: [self-portrait-surfaces.md](self-portrait-surfaces.md) — Steam panels are part of the same "vyoh.gg as self-portrait engine" reframe.

---

## Confirmed first surfaces

**Wishlist panel.** *"47 games in backlog."* Steam wishlist is a public-profile endpoint (no OAuth needed for public profiles) and runs entirely server-side. Calm chip + optional drill-in to the list with date-added timestamps. Owner explicitly named this as a wanted surface (2026-05-14).

---

## Account model & routing (decided 2026-05-14)

- **Single hardcoded SteamID64.** Not multi-account like LoL. Eliminates the account-switch UI on Steam panels and simplifies polling.
- **Game detail route at `/steam/game/:appid`**, mirroring `/champion/:name`. Steam panels on Profile link into this route.

---

## Privacy prerequisites

Steam's privacy is granular, not all-or-nothing. The owner's account needs:

1. **Profile visibility = Public.**
2. **Game Details = Public**, with the "Always keep my total playtime private" sub-toggle **off**. This one setting gates `GetOwnedGames`, `GetRecentlyPlayedGames`, `GetPlayerAchievements`, and the `gameid` field on `GetPlayerSummaries` — everything except wishlist.
3. **Wishlist not hidden** (separate toggle).

Friends list, inventory, and profile comments can stay locked down — we don't use friend data, and there's no "show only summary stats" middle ground for game data.

---

## Steam Web API surface — what we can derive

**No OAuth needed for any of the below** — Web API key + public profile only.

| Endpoint | Gives us |
|---|---|
| `IPlayerService/GetOwnedGames` | Lifetime + 2-week playtime per game; OS split (windows/mac/linux/deck); `rtime_last_played` |
| `IPlayerService/GetRecentlyPlayedGames` | Last 10 played, 2-week window |
| `ISteamUser/GetPlayerSummaries` | Profile + currently-playing (`gameid`, `gameextrainfo`) |
| `ISteamUserStats/GetPlayerAchievements` | Per-game unlocks with **real `unlocktime` timestamps** |
| `ISteamUserStats/GetSchemaForGame` | Static achievement schema (names, icons, hidden flag) |
| `ISteamUserStats/GetGlobalAchievementPercentagesForApp` | Per-achievement global rarity |
| `store.steampowered.com/api/appdetails` | Genre tags, header/library art, sp/mp flags. Rate-limited — build-time only |
| `store.steampowered.com/wishlist/profiles/{steamid}/wishlistdata/` | Wishlist with date-added timestamps. Undocumented-but-stable. |

**Not exposed** (so we don't promise it):

- Per-session playtime history. Cumulative + rolling-2-week + last-played only.
- Library purchase dates → kills the "on this day you bought X" chip.
- Friend overlap, private games, hidden playtime totals.
- Price paid → kills cost-per-hour panels (OAuth-only territory).

---

## Backfill strategy

Steam's data shape is asymmetric to Riot's — no match log. Two complementary sources fill the gap:

1. **Daily polling diff.** Poll `playtime_forever` per game daily, store the delta. Forward-only — trend history starts when we start polling. Drives active trend cards.
2. **Achievement-anchor reconstruction.** Achievement `unlocktime` is the only endpoint that gives real historical timestamps. Clustered per game, it yields a *"when did you actually play this"* timeseries — backfillable years deep, with uneven coverage (CS2 / Dota / no-achievement games miss out).

Combine both: daily polling = active trend layer; achievement-anchor reconstruction = historical layer. Both feed the same recap engine.

Reuse the Bottleneck pattern from the rate-limiter case study; don't introduce a second limiter library. Mirror the build-time champion-asset pipeline (case study `build-time-champion-assets`) for game header/library art — don't hotlink Steam's CDN.

---

## Candidate surface board (feasibility-tagged)

Already confirmed: wishlist panel. The rest is plausible — none committed yet.

### High-confidence, direct API mapping

- **Owned games.** Lifetime hero per game + 2-week delta. *"1,847h into CS2 across 8 years. 14h in the last two weeks."*
- **Library composition / backlog economy.** *"412 owned, 67 ever played, 12 fully completed."* Honest mirror; pairs with wishlist.
- **Currently / recently played strip.** Calm Profile chip; `GetPlayerSummaries` + `GetRecentlyPlayedGames`.
- **Platform-mix panel.** OS-split fields are free in `GetOwnedGames`. *"42% of your time is on Deck."* Identity signal, zero extra calls.
- **Singleplayer vs multiplayer mix.** Tag-derived at build time. *"68% of 2025 playtime was singleplayer."*
- **Returned-to / gone-quiet verdicts.** `rtime_last_played` delta. Inverts the existing LoL gone-quiet flag.
- **Genre drift over time.** Tag-derived; needs daily polling to build the timeseries.
- **Achievement tracking family.** Per-game and cross-game; large enough surface to brainstorm separately — see [Achievement family](#achievement-family) below.

### Cross-stream (the self-portrait engine payoff)

- **Weekly gaming-total bento card.** LoL match count + Steam hours = total gaming this week. Smallest surface that proves the recap-engine reuse claim — best first cross-stream pick.
- **LoL-vs-Steam evening split.** Requires Steam-side session reconstruction (achievement-anchor or polling-derived) before it's honest. Tier-2.
- **Yearly hero across both games.** Pairs with the LoL career-arc panel for a true cross-stream "self-portrait by year."

### Behavioral mirror (analogues of LoL surrender-vote / queue-cadence work)

- **Session-length distribution.** Achievement-anchor-derived where coverage exists; degraded gracefully for non-achievement games.
- **First-game-of-the-day chip.** Same coverage caveat.

### Filtered out / not feasible

- **On-this-day-you-bought-X.** Purchase dates not exposed publicly.
- **Price-paid-vs-hours-played.** OAuth-only; outside current public-profile-only filter.
- **Friends-overlap.** Filtered on the no-other-player-exposure principle.
- **True session log.** Steam doesn't expose one; everything session-shaped is reconstructed.

---

## Achievement family

Owner-flagged 2026-05-14 as a wanted feature. Deep brainstorm in same session.

**Why it leads the execution order.** `GetPlayerAchievements` is the only Steam endpoint that returns real historical timestamps (`unlocktime` per achievement). Building the achievement data layer also produces the session-anchor substrate used by the cross-stream insights in the candidate board (LoL-vs-Steam evening split, session-length distribution, first-game-of-the-day). The family pays double — direct surfaces *and* historical reconstruction for the rest of the trends engine. **Day 1 looks like year N**, because every `unlocktime` returned by the API backfills the timeline retroactively.

### Core surfaces (MVP)

- **Per-game achievement panel.** Spine of `/steam/game/:appid`. Scrollable list per achievement: icon, name, description (or `???` if locked & hidden), unlock timestamp if unlocked, inline global-rarity badge. Locked/unlocked visual distinction mirrors the LoL not-played-champion treatment.
- **Recent unlocks strip.** Cross-game feed of last N unlocks in timestamp order. Calm Profile chip. Works cold-start from day 1.

### Verdict family (per-game `ConclusionCard`s)

- **Completion verdict.** *"34/87 unlocked. Three are <5% rare globally."*
- **Time-to-100%.** For fully completed games. *"Inside: 4h from first to last unlock. Stardew Valley: 4 years."*
- **Hidden-unlock reveal.** Hidden achievements you've already unlocked, surfaced fully — the spoiler is moot once unlocked.
- **Stuck-at-X / abandoned-at-X mirrors.** *"Disco Elysium: 47/49 unlocked."* / *"Slay the Spire: 12%, last progressed 14 months ago."* Honest framing, never a nudge.

### Signature-fingerprint family

- **Rarity-weighted score per game.** *"Average unlock rarity in Hades: 18%."* Pairs with the LoL signature radar.
- **Rarest unlock chip.** Per-game and cross-game variants.
  - **Trophy case on `/steam` (flagged 2026-05-16, owner idea).** Surface the top-N rarest as a small "trophy case" on the main Steam profile section — pulls the signature pulls forward of the drill-in so the headline view shows pride-of-place, not just summary cards. Composition TBD — likely 3–4 capsules/icons in a compact strip near the existing chips, distinct visual register from the per-game `RarestUnlockCard` and from the `/steam/achievements/signature` full list.
- **Completionist axis verdict.** *"Median completion 14%. You only fully complete roguelikes."*
- **Achievement game-design analysis.** Plot a game's *global* rarity distribution as a tiny chart — hardcore-vs-generous achievement design. Tier-3 quirky.

### Temporal / chronotype family

- **Per-game unlock timeline.** Vertical timeline on the game-detail page — first unlock → most recent. Shape of how the game was played.
- **Cross-game unlock heatmap.** Hour-of-day × day-of-week. Singleplayer chronotype panel, directly mirrors the [LoL chronotype panel](self-portrait-surfaces.md#live-candidates-).
- **First-played-meaningfully chip.** First unlock timestamp as de-facto "first real session" date. Joins the anniversary-chips family.
- **Last-progressed chip.** Combined with `rtime_last_played`, reveals "still launching, not progressing" state.

### Yearly / career-narrative

- **Your year in achievements.** Total unlocks, rarest, most-completed game, fastest 100%. Folds into the yearly-recap engine.
- **100%'d games hall.** Career-narrative chip.

### Constraints pinned now

- **No nudges.** *"47/49 unlocked"* is descriptive; *"finish the last 2"* is not done. Same rule as tilt-protection.
- **Coverage gaps.** Games with no achievements (CS2) must degrade gracefully — playtime + recently-played still render, achievement panel hides.
- **Hidden achievements.** Unlocked ones show fully. Locked hidden ones stay `???`, respecting dev intent for things the owner hasn't yet unlocked.
- **No friends comparison.** Global rarity is descriptive, allowed. Named-friend comparison is filtered (no other-player exposure).

### Data layer

- **Schemas** via `GetSchemaForGame` — fetched once per owned game, cached. Icons mirrored at build per the asset-pipeline pattern (`build-time-champion-assets` case study).
- **Global rarity** — weekly poll per owned-with-achievements game.
- **Per-player unlocks** — daily poll, diff against last state, emit "new unlock" events for the recent-unlocks strip and recap composer.
- **First read backfills history for free** — every `unlocktime` is real historical data.

### Open design question

- **Long achievement lists (100+).** The per-game panel must render calmly at scale. Probably the same answer as match-list pagination (virtualize or paginate), but worth deciding before the first wire.

---

## Phased execution plan

Confirmed 2026-05-14. Cadence: gated on the LoL feature backlog winding down. Phases sized for one chunk plan each; chunks scoped at the start of each phase. Order can be revisited at any phase boundary.

Phase-ordering decisions confirmed at the same time:

- **S2 before S3** — wishlist as the warm-up that exercises S1's plumbing before daily polling lands.
- **S4 acceptable as a substrate-only phase** — no user-visible surface for that stretch is fine.
- **Cross-stream stays at S7** — foundations first; the weekly gaming-total bento does *not* jump forward.

### Phase S1 — Foundation

Steam Web API client + key/env handling, Bottleneck reservoir matching the Riot pattern, public-profile probe via `GetPlayerSummaries`, routing scaffold for `/steam/game/:appid` (stub), Profile-page Steam section placeholder. Lands the integration plumbing with no user-facing surface.

**Status (2026-05-14): shipped.**

- Chunk 1 backend — commit `d9af63b`. Module `apps/api/src/steam/` with `STEAM_OWNER_ID` config, `SteamRateLimiterService` (Bottleneck reservoir mirroring the Riot pattern with a 15s schedule deadline), `SteamClientService` wrapping `ISteamUser/GetPlayerSummaries`, `SteamService.getOwnerSummary` returning a typed `SteamSummary` (shared via `@vyoh/shared`), `GET /api/steam/summary` controller. Privacy verdict shape — `profilePublic: boolean`, `gameDetailsPublic: boolean | "unknown"` — surfaces visibility honestly rather than throwing on a locked profile. End-to-end verified via curl on 2026-05-14.
- Chunk 2 frontend — commit `16fcccd`. Routes `/steam` (landing) and `/steam/game/$appid` (dynamic stub), both placeholder text only. No data wiring; both routes are intentionally inert until S2 starts.
- **Descope (commit `023dd26`):** no `ProfileSteamSection` on the LoL profile page. Cross-stream comparisons live exclusively on `/` per [self-portrait-surfaces.md](self-portrait-surfaces.md); the LoL profile is LoL-scoped only. Where S2's wishlist chip and future Steam surfaces will live on the home page is decided when that work starts.

**Chunk plan (set 2026-05-14, picked up in a later session):**

- **S1 chunk 1 — Backend foundation.**
  - New module under `apps/api/src/steam/`, mirroring the LoL module layout.
  - `STEAM_API_KEY` env var; `STEAM_OWNER_ID` constant (hardcoded SteamID64 in shared config, per the single-owner decision).
  - Bottleneck reservoir matching the Riot rate-limiter pattern (`riot-rate-limits` case study). One shared limiter for all Steam Web API calls — wishlist endpoint can sit on a separate limiter later if `store.steampowered.com` rate limits differ enough to justify it.
  - Low-level client wrapping `ISteamUser/GetPlayerSummaries`. Shared response types live in `packages/shared/src/steam/`.
  - One controller endpoint surfacing the owner's public-profile summary. Verifiable end-to-end via curl. Returns `communityvisibilitystate` + currently-playing (`gameid`, `gameextrainfo`) when available.
  - **Done when:** `curl /api/steam/summary` returns the owner's profile state; if the owner's privacy prerequisites aren't met, the response surfaces that explicitly rather than failing opaquely.

- **S1 chunk 2 — Frontend scaffold.**
  - TanStack route `/steam/game/$appid` rendering a stub ("Steam game detail: $appid"). Optional `/steam` index route if it falls out cheaply.
  - Profile page Steam-section placeholder — empty-state copy, no data wiring yet. Slots into Profile where future Steam chips (wishlist S2, library composition S3, recent unlocks S5) will live.
  - **Done when:** visiting `/steam/game/440` shows the stub; the Profile page renders the Steam-section placeholder cleanly without layout regressions.

**Phase S1 exit criteria:** both chunks land; the Steam integration is alive end-to-end (HTTP probe works); the routing + Profile-section surface for S2 (wishlist) is ready to receive its chip. No data is being polled or stored yet — that starts in S3.

Subsequent phases (S2–S8) get their own chunk plans at the start of each phase.

### Phase S2 — Wishlist surface

Wishlist endpoint poller + cache, wishlist `ConclusionCard` chip on the `/steam` landing, drill-in list with date-added timestamps. The confirmed first surface; small enough to be a one-chunk warmup that exercises S1's plumbing end-to-end.

**Status (2026-05-14): shipped.**

- Chunk A backend — commit `d25e8bc`. `SteamClientService.getWishlist` + `getStoreItems` wrap `IWishlistService/GetWishlist/v1/` and `IStoreBrowseService/GetItems/v1/`. `SteamService.getOwnerWishlist` joins the wishlist with resolved names and store URLs behind two in-memory TTL caches (wishlist 1h, names 24h) — no DB, no scheduler, fits the "one-chunk warmup" framing. `GET /api/steam/wishlist` returns the typed `SteamWishlist` from `@vyoh/shared`. Negative-cache for appids GetItems silently omits avoids retrying every request.
- Chunk B frontend — wishlist `ConclusionCard` chip on `/steam` (reusing `@/lol/trends/_shared/conclusion-card`) with a drill-in link, drill-in route at `/steam/wishlist` rendering the full list with date-added formatted in `Europe/Brussels` and sorted by Steam priority (unranked items last). Hook lives at `apps/web/src/steam/use-wishlist.ts` and mirrors the existing TanStack Query patterns.
- **Endpoint pivot vs. original plan:** the doc anticipated the legacy `store.steampowered.com/wishlist/profiles/.../wishlistdata/` endpoint. Live probes returned 302 → store root; pivoted to the modern `IWishlistService` + `IStoreBrowseService` pair on `api.steampowered.com`, both behind the existing Steam API key. No extra rate-limiter needed — both endpoints share the existing Bottleneck reservoir.
- **Where the chip lives:** `/steam` landing, not the LoL profile (cross-stream synthesis stays on `/` per [self-portrait-surfaces.md](self-portrait-surfaces.md)).
- **S2.b polish 2026-05-16** — chip→page deep-link pivot. Profile chip rows now navigate to `/steam/wishlist?appid=X` instead of jumping straight to Steam (mirrors the achievement chip → game-detail pattern). Destination page accepts the `?appid=` search param, scrolls the matching row into view, and flashes an amber ring for 2.5s (same effect as `AchievementPanel`'s deep-link land). External-link affordance moved from "the whole row" to an explicit `View on Steam ↗` button per row. Release info wired through: `getStoreItems` now sets `include_release: true` (same endpoint, no extra budget), `SteamWishlistItem` carries `releaseDate: number | null` + `comingSoon: boolean`, and the page row shows `Released <year>` or `Coming <Mon YYYY>` next to the added-date.
- **S2 deferred:** price / discount info on wishlist rows. Needs `IStoreBrowseService/GetItems` with `include_pricing: true` (returns `best_purchase_option` with `formatted_final_price` + `discount_pct`), a price-aware cache (sales windows are short — 24h cache TTL is too coarse, but per-row revalidation is heavier than the surface needs), and UI for the discount badge. Not gated on anything; revisit if a wishlist-rich session makes the absence feel like a gap.

### Phase S3 — Owned games + library composition

`GetOwnedGames` poller storing baseline + daily delta, library-composition chip, owned-games surface, platform-mix chip, build-time asset pipeline for game header/library art. First *data-derived* trend surfaces; introduces the daily-polling layer.

**Status (2026-05-14): shipped.**

- Chunks 1–2 backend — daily `GetOwnedGames` poller (04:00 Europe/Brussels), `SteamOwnedGame` + `SteamPlaytimeSnapshot` tables, `SteamOwnedGamesService` with `getLibrarySummary` / `getPlatformMix` / `getOwnedGames` reads. `GET /api/steam/{library-summary,platform-mix,owned-games}`. (Originally shipped as `getForeverGames` / `/forever-games`; renamed 2026-05-15 for clarity — see commit log.)
- Chunk 3 asset pipeline — commit `e1ab677`. Bundled-manifest pipeline for capsules mirroring the LoL approach; planned for retirement after S5 per [lol-image-pipeline.md Phase 4](lol-image-pipeline.md#phase-4--runtime-image-proxy-planned-multi-stream).
- Chunk 4 owned-games drill-in — commits `88896d1` (backend), `d3d1806` (frontend). `OwnedGamesChip` on `/steam`, `/steam/library` drill-in route sorted by lifetime, minimal `/steam/game/$appid` detail showing lifetime + 2-week.
- **Deferred:** `rtime_last_played` capture — not needed for the owned-games surface (lifetime + 2-week was the explicit scope). It belongs to the **returned-to / gone-quiet verdicts** surface (see candidate board) and to the eventual "last played 14mo ago" line on `/steam/library`. Picked up when either of those lands — small chunk: Prisma column on `SteamOwnedGame`, migration, upstream raw type, upsert write, shared type, two render sites.

### Phase S4 — Achievement data layer

Schema fetch per owned game, daily per-player unlock poll with diff, weekly global rarity poll, asset mirroring for achievement icons, storage schema for unlocks (timestamp, rarity, schema link). No user-facing surface — purely substrate. Unblocks both S5 and the cross-stream work in S7.

**Chunk 1 (shipped 2026-05-15)** — schema + Steam client methods + raw types. Four Prisma tables: `SteamGameAchievement` (per-game schema rows, composite PK `(appid, apiName)`, captures `hidden` spoiler flag + absolute icon URLs); `SteamPlayerUnlock` (append-only owner unlocks, composite PK same, `unlockedAt` from Steam's `unlocktime` epoch — every poll backfills real history retroactively, the "Day 1 looks like year N" property); `SteamAchievementGlobalRarity` (weekly-refreshed 0..100 percent per achievement); `SteamGameAchievementMeta` (sidecar bookkeeping per owned appid — `achievementCount` lets pollers short-circuit games with no achievements like CS2/demos, plus three independent `last*CheckedAt` timestamps for the three pollers). Three client methods on `SteamClientService`: `getGameSchema(appid)` returning `[]` for schema-less games, `getPlayerAchievements(steamId, appid)` returning `null` on Steam's `success: false` (no playerstats) vs `[]` (zero unlocked), `getGlobalAchievementPercentages(appid)` on the unkeyed public endpoint but routed through the same Bottleneck limiter for budget bookkeeping. New rate-limiter families: `game-schema`, `player-achievements`, `global-rarity`. Migration `20260515221549_s4_achievement_data_layer`.

**Chunk 2 (shipped 2026-05-15)** — schema poller. `SteamAchievementSchemaService.refreshSchemas(appids)` iterates per-game (the endpoint isn't batched), upserts achievement rows + stamps the meta sidecar's `achievementCount` and `lastSchemaCheckedAt`. A single appid's failure is logged and skipped — one bad id never aborts the rest. Empty-achievement games (CS2, demos) still get a meta row with `count=0` so later passes can distinguish "checked, none" from "never checked". Schema removals aren't reconciled (Steam essentially never removes shipped achievements, and a partial-fetch race would risk delete-then-restore). `SteamAchievementSchemaPoller`: monthly cron at `0 5 1 * *` Europe/Brussels (30 min after enrichment, an hour after daily owned-games sync) + `OnModuleInit` boot backfill targeting games with no meta row yet, plus on-add hook via `syncOwnedGames` diff (mirrors the enrichment-poller pattern — schema fetches in the same sync tick as a newly-owned game so the per-game panel can render immediately rather than waiting up to a month for the cron).

**Chunk 3 (shipped 2026-05-15)** — player unlocks poller. `SteamPlayerUnlocksService.syncUnlocks(appids)` iterates per-game (endpoint isn't batched), inserts new unlock rows via `createMany({ skipDuplicates: true })` — composite PK `(appid, apiName)` makes the operation idempotent across re-runs, preserving the historical `unlockedAt` from Steam's `unlocktime`. Steam's `success: false` (no playerstats configured — privacy toggle, never launched stats, library hidden) returns `null` from the client; we still stamp `lastUnlocksCheckedAt` so the meta row reflects the attempt, but skip the insert. Daily re-polls in that state are fine — playerstats visibility can flip back. Caller filters appids by `achievementCount > 0` upstream so the FK on `SteamPlayerUnlock(appid, apiName) → SteamGameAchievement` always resolves; service trusts the input. `SteamPlayerUnlocksPoller`: daily cron at `0 6 * * *` Brussels (2h after owned-games sync — gives the on-add schema bootstrap time to land for any games added in the morning's tick) + `OnModuleInit` boot backfill for games with `achievementCount > 0` but `lastUnlocksCheckedAt: null`, plus on-add hook after the schema bootstrap in `syncOwnedGames` (filters `diff.added` by `SteamGameAchievementMeta.achievementCount > 0` since schema-less games would fail the FK insert).

**Chunk 4 (shipped 2026-05-15)** — global rarity poller. `SteamGlobalRarityService.refreshRarity(appids)` iterates per-game, upserts each achievement's global unlock percentage. Endpoint is unauthenticated (no API key required) but still routed through the limiter for budget bookkeeping. Per-row upsert is used over `createMany`+`skipDuplicates` because rarity values shift over time — `skipDuplicates` would ignore stale rows. Wrapped in a per-game `$transaction` so a partial-fetch interrupt doesn't leave a game with mismatched timestamps. Stamps `lastRarityCheckedAt` on the meta row. `SteamGlobalRarityPoller`: weekly cron at `30 5 * * 0` (Sunday 05:30 Brussels — well clear of daily and monthly windows) + boot backfill for games with `achievementCount > 0` but `lastRarityCheckedAt: null`, plus on-add hook in `syncOwnedGames` reusing the same eligibility set as the unlocks bootstrap (the weekly cadence would otherwise delay rarity badges for a freshly-added game by up to a week).

**Chunk 5 (shipped 2026-05-15)** — read endpoints + DTOs. New `SteamAchievementsService` exposes two reads: `getGameAchievements(appid)` joins schema + unlock state + rarity into a single payload, with in-memory sort (unlocked-newest first, then locked alpha) — small N per game makes the Prisma relation-orderBy with nulls-last overkill. Returns `achievements: null` when the meta sidecar says `achievementCount === 0` so the frontend hides the panel block entirely on schema-less games (CS2, demos). `getRecentUnlocks(limit)` walks the `unlockedAt` index, clamps limit to `[1..200]` (default 10), includes the achievement's game name + display name + icon + rarity in one round-trip. Two new endpoints on `SteamController`: `GET /steam/game/:appid/achievements` and `GET /steam/achievements/recent?limit=N`. DTOs in `packages/shared/src/steam/achievements.ts` — `SteamAchievement`, `SteamGameAchievements`, `SteamRecentUnlock`, `SteamRecentUnlocks`. Spoiler masking explicitly deferred to the frontend (server returns truth, client renders `???` only when `hidden && !unlockedAt`) so other surfaces can apply their own rules.

### Phase S4.5 — Navigation + visual baseline

Inserted after the S3 retro (2026-05-14). The Steam section today is a single `/steam` card grid with two drill-ins (`/steam/wishlist`, `/steam/library`) and a stub game detail — fine as a foundation, but too thin to host the achievement surfaces in S5 without them feeling tacked-on. Lands as a named phase so it doesn't get folded into S5 and skipped.

Scope (chunks set when scoped, per the phase-plan convention):

- **Real navigation surface.** Sub-sections along the lines of *Profile / Achievements / Library / Wishlist*, not just chips on `/steam`. Mirrors the LoL section's pattern of having shape rather than a single landing page. Final IA decided at scoping time — the names above are a starting set, not committed.
- **Visual baseline.** The section currently reads as sober even by vyoh.gg standards. Pass to bring it closer to the LoL section's visual density and presence — typography hierarchy, breathing room around chips, hero/landing treatment for `/steam`, capsule treatment on detail pages. Decided at scoping time which surfaces lead.
- **Re-look at Steam web feature subfoldering** ([folder-structure-cleanup.md](folder-structure-cleanup.md) Chunk 3). `library` now meets the numeric ≥3-files threshold (chip + hook + route), `wishlist` and `platform-mix` still sit at 2 files each. Adding S4.5's new shared components is the moment to decide whether to subfolder one, two, or none — premature when only one bucket crosses the line, more obvious once S4.5 reshapes what's grouped together.
- **Done when:** `/steam` is navigable as a section, not a card grid; achievement surfaces in S5 have an IA slot waiting for them rather than needing a structural retrofit.

**Chunk B shipped 2026-05-15** (commit TBD). Profile tab (`routes/steam/index.tsx`) now has a heading + description. `LibraryCompositionChip` gains a "See the full library →" link matching the WishlistChip and OwnedGamesChip pattern.

**Chunk A shipped 2026-05-15** (commit `3fd332e`). Layout shell at `routes/steam.tsx` with 4-tab nav (Profile / Library / Wishlist / Achievements), achievements stub satisfying the IA-slot done-when criterion, redundant per-page section headings/breadcrumbs stripped on shallow tabs, and the shadcn `@/components/ui/breadcrumb` primitive wired on `game.$appid` (the only deep route where breadcrumb earns its keep). Known follow-up to fold into Chunk C: on `/steam/game/$appid` no tab is highlighted because the route isn't under `/steam/library/*`. Most natural fix is teaching the tab matcher to treat `/steam/game/*` as Library-active — couples tab definitions to specific route shapes, so deliberately deferred from Chunk A's IA-only scope.

**Chunk C-1 shipped 2026-05-15** (commits `882e562` + `57c256c` + `f0ccac2` + `210d938`). Steam identity row with avatar + persona name, animated tabs (icon spring pop, `layoutId` indicator with infinite glow pulse, blue/cyan/sky gradient), `/steam/game/*` taught to Library-active via `extraPrefixes`, directional x-axis outlet slide between tabs, sticky compact header mirroring LoL's hysteresis + cooldown pattern, skeleton placeholders for avatar + persona name on both Steam and LoL (defeats late-summary layout jank), full-bleed gradient bottom border matching LoL. Section-layout duplication between LoL and Steam surfaced and parked as a deferred follow-up — see [section-layout-extraction.md](section-layout-extraction.md).

**Chunk C-2 shipped 2026-05-15** (commit `cd10362`). Backend: `SteamSummary` extended with `animatedAvatarUrl`, `profileBackgroundUrl`, `profileBackgroundVideoUrl` resolved from `IPlayerService/GetProfileItemsEquipped/v1/`. Defensive `Promise.all` in `getOwnerSummary` — a cosmetic-items failure logs and continues rather than rejecting the summary. CDN base verified via live probe: Steam's `image_large`/`movie_*` fields are pre-prefixed with `items/<appid>/...`, so the correct base is `https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/` (not `.../images/items/` — that path doubles and 404s). Animated-avatar mapping uses `image_small` (the `.gif`) since Steam doesn't return `movie_*` on the avatar slot — `image_large` is the static jpg fallback.

**Chunk C-3 shipped 2026-05-15** (commits `b0c0244` + `29f23ee`). Frontend: profile background portaled to `document.body` as a full-viewport backdrop (animated `<video autoPlay loop muted playsInline>` when motion permitted with the static jpg as `poster`, plain `<img>` fallback otherwise, `blur-[2px] scale-105` for softness, `from-background/40 via-background/70 to-background/95` gradient mask, 0.6s entry fade). Animated avatar (`.gif`) swapped over the static one in the identity row when present + motion permitted. Header band restructured from the in-flow `absolute inset-0` div to a `position: fixed inset-x-0` element inside the header — fixed positioning escapes `<main>`'s `overflow-x: clip` so the band spans the true viewport width including the `[scrollbar-gutter:stable both-edges]` reserve, eliminating the seam at `<main>`'s content edge. Band height + viewport top tracked via `ResizeObserver` on the header + `window.resize` (nav reflows). New `bandOpaque` state (threshold 16px, no cooldown) drives band opacity separately from `compact` (96/8 hysteresis), so the tint catches up to the first scroll — otherwise content goes under a still-transparent header. Pattern applied to LoL header for consistency in the same arc.

**Chunk C-4 shipped 2026-05-15** (commit TBD). `/steam/game/$appid` redesigned with a `library_hero.jpg` banner (1920×620 aspect locked, gradient mask) + `logo.png` overlay positioned bottom-left, mirroring Steam's library-page aesthetic. Two new helpers in `_shared/steam-image.ts`: `steamLibraryHeroUrl` and `steamLibraryLogoUrl`, both proxied through wsrv.nl following the existing `steamCapsuleUrl` pattern. Hero img has a 500ms opacity fade on `onLoad`. Older titles (CoD MW2 Multiplayer, demos, dedicated-server entries, anything pre-2019 library-presentation spec) don't ship these assets — a blurred + `scale-110` `header.jpg` sits underneath as both the loading placeholder (avoids a dark `bg-muted` block while the hero streams in) and the permanent fallback when `library_hero.jpg` 404s. Logo's `onError` swaps to the game-name `<h2>` styled to match the logo's position. Heading + playtime card have pulsing skeletons while `useSteamOwnedGames` resolves.

**Post-ship follow-up — LoL breadcrumb pass.** S4.5 is the first surface to actually wire in the shadcn `@/components/ui/breadcrumb` primitive (installed but never used pre-S4.5). Once it's the canonical pattern, do a consistency pass through the LoL section to find breadcrumb opportunities — `/lol/$accountSlug/matches/$matchId`, `/lol/$accountSlug/champions/$championKey`, and recap/trends leaves all currently rely on the `AccountLayout` tab bar + `BackButton` affordance without a breadcrumb trail. Decide per-surface whether a breadcrumb adds anything the tab bar doesn't (likely yes for the deep match/champion drill-ins, likely no for the top-level tabs). Lives in the same "Adjacent maintenance" lane as the folder-structure cleanup — tidy-up pass, not a content arc.

Numbered S4.5 (half-step) rather than renumbering S5–S8 to keep the existing cross-doc references stable (notably the `lol-image-pipeline.md` Phase 4 "after Steam S5" sequencing decision, which refers to the achievement-surfaces-MVP milestone semantically).

### Phase S4.6 — Library enrichment

`/steam/library` evolves from a single lifetime-sorted list into a browse surface: tile layout, name search, filter, and sort. Introduces the first Steam *enrichment* poller (per-app metadata layered on top of the daily `GetOwnedGames` baseline). Inserted as a half-step rather than after S8 because library is a higher-traffic destination than achievements will be initially, and the asset-hash enrichment (see Chunk 2 below) unblocks an image-quality lift across every existing Steam image surface. Independent of the S5–S8 achievement arc in both directions.

**Chunk 1 (shipped 2026-05-15)** — UI-only browse surface, no new backend data:

- Layout toggle. Rows ↔ tiles switch on `/steam/library`. Tile layout uses `library_600x900.jpg` (the legacy unhashed portrait asset) with a Steam-client-style hero+logo fallback for titles where the portrait is missing. Rows stay default; preference persisted in `localStorage`.
- Search. In-page substring match on `name`. Client-side over the existing dataset.
- Sort. Lifetime playtime (default), name (A–Z), 2-week playtime. *Recently-played sort deferred until `rtime_last_played` lands.*
- Filter — no new data. Played / never-launched (derivable from `playtimeForeverMinutes`).

**Why the tile art looks dated for some titles** — the public unhashed `…/apps/{appid}/library_600x900.jpg` path is a *frozen mirror* of the original 2019 upload. Steam's own client renders the current art using `IStoreBrowseService/GetItems`, which returns hash-prefixed paths like `…/apps/367520/1eebc7e077ee345f126df35cd99c124273c4e4e3/library_capsule.jpg?t=1776125684`. Same story for every other image we serve: `header.jpg`, `library_hero.jpg`, and `logo.png` all have hashed-modern variants we're not consuming. The hash can't be guessed — it has to be fetched per appid. That's Chunk 2.

**Chunk 2 (shipped 2026-05-15)** — enrichment poller + asset-hash image pass:

- Endpoint pivot. Use `api.steampowered.com/IStoreBrowseService/GetItems` (proper Steam Web API, much higher rate limit than `store.steampowered.com/api/appdetails`) with `data_request.include_assets: true` and `include_categories: true`. One call per appid returns the full asset manifest *and* type/categories/release date.
- Persist per-app asset hashes (`library_capsule`, `library_capsule_2x`, `library_hero`, `library_hero_2x`, `header`, `hero_capsule`, and `asset_url_format` with its `?t=` timestamp). Plus type (`game` / `tool` / `dlc` / `demo`), release date, categories.
- Image-pass across every existing Steam image surface once hashes are populated:
  - `steamLibraryCapsuleUrl` (S4.6 C-1 tile) → switch to hashed `library_capsule.jpg`. Renders the current Steam-client art.
  - `steamLibraryHeroUrl` (S4.5 C-4 game-detail hero) → switch to hashed `library_hero.jpg`. Matches current Steam art when publishers refresh promo material.
  - `steamCapsuleUrl` (S2 row view, S2 wishlist chip, S4.5 C-4 blurred backdrop) → switch to hashed `header.jpg` / `capsule_231x87.jpg`.
  - `steamLibraryLogoUrl` (S4.5 C-4 logo overlay) — investigate during chunk start. `IStoreBrowseService/GetItems` doesn't expose a `logo` key; the Steam client may render the wordmark from a separate community-CDN path. Possible outcomes: (a) find the right endpoint, (b) fall through to title-text only, (c) keep the unhashed `logo.png` as a "good enough" sibling.
- New genre/type filters in `/steam/library` controls. Genre is the user-visible browse axis (likely genres + curated tags). Type filter hides non-games (Wallpaper Engine, 3DMark, SteamVR Performance Test, dedicated-launcher entries) cleanly via the `type` field.

**Done when:** every existing Steam image surface renders the current hashed asset (no more 2019-frozen art), `/steam/library` can filter on genre + hide non-games, and the enrichment table has refresh cadence (monthly + on-add for newly-owned titles).

**Chunk 3 — Steam-client-style tile hovercard.** Library tiles on `/steam/library` gain a hover popover modeled on the Steam desktop client's tile-hover surface — rotating screenshots, game name, lifetime + last-two-weeks playtime block. Hover only (the tile's `<Link>` keeps owning click navigation). Two sub-chunks so the popover shell can ship without blocking on a Prisma migration.

- **C-3.1 shipped 2026-05-16** — hovercard shell. `@radix-ui/react-hover-card@1.1.15` added as direct dep on `apps/web` (umbrella `radix-ui` package re-exports it, but the project lists each primitive directly to match the `react-tooltip`/`react-popover`/`react-dialog` pattern). New `apps/web/src/steam/library/library-tile-hovercard.tsx` renders `library_hero.jpg` (with the same `wsrv` silent-404 `naturalWidth === 0` trick the outer `HeroFallback` uses) → blurred `header.jpg` fallback when hero is absent, title, and Steam-faithful "TIME PLAYED" block with stacked rows ("Last two weeks" + "Total"). Local `formatPlaytime` helper differs from the tile's `Xm`/`Yh` — uses Steam's "0 min" / "N min" / "N.N hrs" (sub-10h tenths) / "N hrs" (rounded ≥10h) bands; the never-played zero case renders "0 min" rather than hiding. `library-tile.tsx` wraps the existing `<Link>` in `HoverCardPrimitive.Root` (200ms open / 100ms close) + `Trigger asChild`; content portaled with `side="right"`, `align="start"`, `sideOffset={8}`, `collisionPadding={16}` so the rightmost grid column flips to `side="left"` without the popover crossing the viewport edge. ~320px wide (`w-80`). Adjusted the tooltip class for HoverCard's `data-state` (no `delayed-open` state — that's Tooltip-only). Click still navigates via the tile's `Link` — hover-only popover, no `pointer-events-none` so users can mouse into screenshots once Chunk 2 lands.
- **C-3.2 shipped 2026-05-16** — rotating screenshots. Schema: two columns on `SteamGameEnrichment` (the natural home — same sidecar that holds asset hashes; FK already keyed off `SteamOwnedGame.appid`) — `screenshots Json @default("[]")` + `screenshotsFetchedAt DateTime?`. Migration `20260516114913_s4_6_c_3_2_steam_game_screenshots`. New dedicated shared DTO `SteamGameMedia` (`packages/shared/src/steam/media.ts`) returned by the new endpoint — kept off `SteamOwnedGame` so the daily owned-games request isn't bloated with screenshot URLs for 167+ games that will never be hovered. New `SteamScreenshotService` calls `store.steampowered.com/api/appdetails?appids=<id>&filters=screenshots&l=english` directly (the existing `SteamClientService` is hardcoded to `api.steampowered.com`; store.steampowered.com is a different host with a separate ~200 req / 5 min per-IP budget). Routed through `SteamRateLimiterService` under family `appdetails-screenshots` — over-charges the Web API reservoir but volume is low enough (lazy on hover) the bookkeeping mismatch is negligible; the alternative of a second Bottleneck instance was rejected as premature. SWR semantics: first hover blocks on a fresh fetch so the popover renders with screenshots inline rather than empty-then-filled; subsequent hovers within the 30-day TTL serve cached; past TTL serves cached + revalidates in background (catch-and-log on failure). `MAX_SCREENSHOTS = 6` cap on persisted JSON — Steam returns 10–30 per game, but the hovercard rotates through 3–5 and the smaller payload keeps DB rows tight. Empty upstream responses (delisted / region-blocked / `success: false`) persist `screenshots: []` with a timestamp so the same appid doesn't re-fetch on every hover. Non-owned appids 404 rather than upserting partial enrichment rows (the FK would fail anyway; explicit 404 is clearer). New `GET /steam/game/:appid/media` controller route. Frontend: new `useGameMedia(appid, enabled)` TanStack hook with 1h client stale-time (server SWR carries the 30-day refresh — in-session re-hovers are free). `library-tile-hovercard.tsx` fires the hook unconditionally (`enabled: true`) because Radix unmounts the portal content on close, so the query only runs while the popover is open. Rotation: `useInterval` at 2.5s cycles `index` mod `screenshots.length`; `document.visibilityState === "hidden"` skips the increment without clearing (tab returned-to picks back up). Cross-fade via N stacked `<img>` layers, only the active one at `opacity-100` (`duration-700`). Hero image stays underneath as the loading + zero-screenshot fallback — fades in via the existing `naturalWidth === 0` wsrv silent-404 trick, with `header.jpg` blurred as the further fallback when the game predates the `library_hero` spec. **No library-wide prefetch** — appdetails rate budget is small enough that touching all 167+ games on a single `/steam/library` visit would exhaust it; only the games the owner actually hovers ever populate.

- **C-3.3 shipped 2026-05-16** — screenshot strip on `/steam/game/$appid`. Reuses the C-3.2 data plumbing (same `useGameMedia` hook + appdetails-backed 30-day server cache primed by hovercards) — zero new backend, zero new schema, no new endpoint. New `apps/web/src/steam/game/game-screenshot-strip.tsx` renders an `aspect-video` (16:9) full-content-width letterbox slotted between the playtime block and the verdict grid (visual break between info-dense rows, doesn't fight the hero for top-of-page attention). Same fade-to-black blink as the hovercard (`duration-300` per side, `delay-300` on incoming, asymmetric `ease-in`/`ease-out`) so the rhythm reads consistent across both surfaces; rotation slowed to 3.5s (vs the hovercard's 2.5s) since page dwell is longer than hover dwell. Component returns `null` when the upstream had no screenshots (delisted / demo / region-blocked) — same null-render contract the verdict cards use, so the layout collapses cleanly. Click opens `path_full` (1920×1080) in an in-app modal (`@radix-ui/react-dialog` base primitives, bypassing the project's shadcn `DialogContent` wrapper which is sized for typical content modals — too constrained for an image lightbox; max-w-[95vw] / max-h-[95vh] with object-contain instead). Cursor-on-strip + modal-open both pause rotation so the screenshot you clicked is the one the modal opens with — solves the otherwise-real edge case of an image swap landing between intent and click. **Tabs deferred.** Considered grouping per-game content into Overview/Media/Achievements tabs but rejected for current density — the page reads as a single self-portrait and tab-switching hides content from passive scanners. Revisit when S8's per-game unlock timeline lands and the page genuinely earns IA.

**Chunk 2 shipped 2026-05-15** across sub-chunks C-2.1 through C-2.5 (commits `03e32cb` + `574d25a` + `2666fb1` + `88352b6` + `8d28985` + `576d292` + `6035fbb` + `d3e8b4e` + `830fde4` + `8074fc3`). New `SteamGameEnrichment` table keyed off `SteamOwnedGame.appid` (one-to-one) storing per-asset hashed paths (`libraryCapsulePath`, `libraryCapsule2xPath`, `libraryHeroPath`, `libraryHero2xPath`, `headerPath`, `heroCapsulePath`), `assetUrlFormat` template, `assetTimestamp` cache-buster (BigInt epoch extracted from the `?t=` suffix), `appType` (Steam StoreItemType int — 0 = Game, 6 = Application/Tool), `releaseDate`, `isFree`, top-20 `tagIds` (community tags ordered by weight desc — genre stand-in, since `GetItems` doesn't expose `genres` directly), and `featureCategoryIds`. `SteamEnrichmentService.enrichApps` batches `IStoreBrowseService/GetItems` at 50 ids/call, skips items where `success !== 1` (delisted / region-blocked / hidden), and upserts via a single transaction per app. `SteamEnrichmentPoller`: monthly cron at `30 4 1 * *` Europe/Brussels (30 min after the daily owned-games poll so the windows never overlap), boot backfill of unenriched rows via `OnModuleInit` (self-healing — re-deploys are no-ops once every owned appid has a row), plus on-add coverage triggered from the `syncOwnedGames` diff in `owned-games.service.ts` (newly-owned apps enrich within the same sync tick, no monthly-cron lag). Image helpers (`steamCapsuleUrl`, `steamLibraryHeroUrl`, `steamLibraryCapsuleUrl`) accept the hashed path + `assetTimestamp` and compose the content-addressed CDN URL via `composeSrc` (host `shared.akamai.steamstatic.com/store_item_assets/steam/apps/<appid>/<hashedPath>?t=<timestamp>`), falling through to the legacy unhashed filename when enrichment hasn't resolved. wsrv source is URL-encoded to keep the `?t=` intact end-to-end — previously-unencoded cache entries take a one-time miss. Library controls gained a type filter (All types / Games / Tools, defaults to Games per `8074fc3`; unenriched rows treated as Games to avoid them disappearing between owned-sync and enrichment) and a tag filter popover with searchable list, OR-match within the selected set, frequency floor of 3 across owned games, selected-tags pinned to top. Global tag catalog backed by new `SteamTag` table + monthly `GetTagList` poller (`6035fbb`); `GET /steam/tags` returns id/name pairs with `lastSyncedAt`. Tile hover polish (`e50ce5d` + `d88093b` + `be00325`): anchored sheen via registered `@property --sheen-extent` for smooth gradient-stop interpolation (the bright corner stays pinned; only the transparent end-stop animates inward — no edge translated across the card), 3D tilt on hover using `perspective(700px) rotateX(7deg) rotateY(-9deg) scale(1.02)` with `transform-origin: top` so the bottom-right lifts toward the viewer, downward-offset shadow grows on hover. `IStoreBrowseService/GetItems` ruled out as a logo source — its payload doesn't expose a `logo` key, so `steamLibraryLogoUrl` stays on the unhashed `logo.png` path as a working fallback. The underlying anomaly (recent titles like RE Requiem render a logo in the Steam client yet have nothing at the unhashed path) is unsolved and tracked under [Still open](#still-open). Genre-granularity decision: surfaced `tagIds` as the user-visible filter axis (community tags as the genre proxy), skipped `genres`/`categories` (genres aren't returned by GetItems; categories are mostly feature-flags). `featureCategoryIds` persisted but not yet surfaced — reserved for a later feature-flag filter (single-player, achievements, cloud save) if it earns its keep.

**Risks / open questions:**

- `IStoreBrowseService/GetItems` stability — Valve-published Web API, more stable than `appdetails`. Backstop is still appdetails for genres if Valve narrows GetItems scope, but the assets specifically only come from GetItems.
- Logo-asset gap — see above. Investigate at chunk-start whether there's an authenticated/community-CDN path for the wordmark, or whether Steam composes it differently. Worst case: drop the logo overlay in favor of the title-text-on-gradient pattern we already use as the fallback.
- Cache busting — the `asset_url_format` returned by GetItems includes a `?t={timestamp}` query that changes when the publisher updates art. Storing the timestamp alongside the hash lets us refresh selectively when the timestamp moves.
- Genre granularity. Steam exposes three levels via the same response: `genres` (coarse, e.g., "Action"), `categories` (feature-level, e.g., "Single-player"), and `tags` (community). Decide at scope-time which to surface — likely genres + a curated tag subset; categories are mostly feature-flags, not browse axes.
- Asset pipeline pressure — capsules cap at ~600×900 across ~200 titles. Reasonable trigger to validate the runtime image proxy decision against capsule scale. Cross-link to [lol-image-pipeline.md Phase 4](lol-image-pipeline.md#phase-4--runtime-image-proxy-planned-multi-stream).

**Coupling with the runtime image proxy** ([lol-image-pipeline.md Phase 4](lol-image-pipeline.md#phase-4--runtime-image-proxy-planned-multi-stream)). Chunk 2's hashed-asset enrichment is the data Phase 4's proxy needs to resolve canonical Steam image URLs. Once Chunk 2 lands and the hash columns are populated, Phase 4's Steam-side resolver reads from this enrichment table instead of looking up `appdetails` on every cache miss. That answers Phase 4's open question on `appdetails` rate-limit mitigation: the resolver doesn't need to memoize appid → versioned-URL itself, because Chunk 2 already persists the canonical hashed paths from `IStoreBrowseService/GetItems`. Sequencing options when both are due to ship: (a) ship Chunk 2 first with URL helpers still rewriting unhashed paths client-side — image quality lifts immediately, proxy lands later as an optimization; (b) ship them together as a paired arc where Chunk 2 lands the data and Phase 4's Steam consumer reads it directly, skipping the intermediate client-side URL-helper update. Decide at scope-time based on the state of [hosting.md](hosting.md) — option (b) is only attractive once the Hetzner VPS + Nginx topology is live.

### Phase S5 — Achievement surfaces MVP

`/steam/game/:appid` achievement panel, recent-unlocks strip on Profile, completion verdict `ConclusionCard` per game. First user-facing achievement work — lands the spine.

**Chunk 6 (S5.A) shipped 2026-05-15** — per-game `AchievementPanel` wired into `routes/steam/game.$appid.tsx` below the playtime block. New `useGameAchievements` TanStack hook mirroring the owned-games pattern (30min stale-time matches the daily poller cadence; same shape as `useSteamOwnedGames`/`useSteamTags`). Panel renders nothing when `data.achievements === null` (game has no schema — CS2, demos), an "in flight" hint when the schema exists but rows haven't ingested yet (first-deploy edge case), and otherwise a 2-column grid of unlocked-newest-first / locked-alpha rows (server already sorts). Default preview is 12 rows with a "Show N more" expand affordance — large libraries (Stardew ~50, Hades 49, occasional 100+) don't need virtualization at this scale and the preview keeps the playtime block from being dwarfed. **Spoiler masking lives on the frontend** per the S4 decision: server returns truth, and the row renders `???` + "Hidden achievement" only when `hidden && !unlockedAt`. Once unlocked, hidden achievements reveal fully — matches Steam client behavior. Locked icons use `iconGrayUrl` at 60% opacity; unlocked use the full `iconUrl`. Global rarity (when available) renders right-aligned alongside the display name. The "achievements...land in a later phase" copy in the page subtitle was replaced with the active framing.

**Chunk 7 (S5.B) shipped 2026-05-15** — `CompletionVerdictCard` composes `CardShell` (M/N · % indicator, evidence callout for rare-unlocks counts, banded verdict copy from "Just getting started" through "Closing in — N to go" to "100% complete — every achievement earned"). Rare = global <5% unlocked; very-rare = <1%; only counts owner-unlocked rows (the value is "what you pulled off", not "what exists"), and `globalPercent === null` rows are excluded rather than treated as 0. Card hides when no schema, schema empty, or while loading — same null-render contract as `AchievementPanel`. Bolder rare-row treatment landed in `AchievementPanel` in the same chunk: under 1% gets amber row tint + shadow ring + star prefix + "Very rare ·" label; under 5% gets amber accent + "Rare ·" label; locked rare rows don't get the treatment (earned-not-aspirational). Per-game search input renders when `total ≥ 30` and disables the 12-row preview cap while active. Logo-asset gap on recent titles (RE Requiem case) remains parked — see [Still open](#still-open). The S4.6 C-2 enrichment work ruled out `IStoreBrowseService/GetItems` as a source; the underlying mystery of where the Steam client actually fetches the logo from is still open.

**Chunks 8 + 9 not shipped.** Both were assumed shipped during S7 scoping 2026-05-16 but surfaced as still-pending: the Profile recent-unlocks chip never landed, and `/steam/achievements` is still the S4.5-chunk-A stub. S6 was pulled forward of them ("S6 is independent of S5's remaining chunks (8 + 9) and chosen to land first because the unlocks-cadence question naturally bleeds into it" — bottom of this section). Now rescoped as an **S5 completion pass** ahead of S7, since S5.9 is the natural home for several S7 cross-game surfaces and shipping it first lets S7.C extend a real page rather than rewriting a stub.

**Chunk 8 (S5.C) shipped 2026-05-16** — Profile recent-unlocks chip on `/steam`. New `useRecentUnlocks(limit)` TanStack hook (30min stale-time matches the 4-hour backstop + event-driven cadence — chip notices new unlocks shortly after the next poller tick). New `RecentUnlocksChip` composes `CardShell` directly: title "Recent unlocks", indicator carries the most-recent relative time, verdict frames the most-recent's game ("Last progressed in <gameName>."), evidence is a 5-row list including the latest (icon + display name + game name + per-row relative time), each row a `<Link to="/steam/game/$appid">` into game detail. Hidden achievements render fully (server returns truth; once unlocked, masking is moot per the S4 rule). Loading/error/empty states all degrade to `CardShell ... empty` with appropriate copy. Slotted into the Profile grid in `routes/steam/index.tsx` as the second chip (right after `NowPlayingChip` — both are "what am I doing right now" surfaces). `FETCH_LIMIT = 5` keeps the card compact next to its siblings; the full cross-game feed lives on the page S5.9 lands.

**Chunk 9 (S5.D) shipped 2026-05-16** — Global `/steam/achievements` page, replacing the S4.5-chunk-A stub. MVP scope per plan: cross-game recent-unlocks feed (`FEED_LIMIT = 100`), grouped by month with `Intl.DateTimeFormat({ month: "long", year: "numeric" })` headers (always year-qualified so "May 2025" vs "May 2026" reads unambiguously). Summary line at the top — "N unlocks across M games", with M derived from `Set(unlocks.map(u => u.appid)).size`. Rows are 2-column grid (`sm:grid-cols-2`) of `<Link>` cards (icon 40px + display name + game name + short "Mmm D" date), denser than the chip's row to suit a dedicated page. Server returns rows sorted by `unlockedAt` desc, and JS `Map` keys preserve insertion order, so `groupByMonth` falls out without an explicit sort pass. Loading/error/empty states are bordered-card paragraphs (matched to the page's existing visual register). Page copy points forward: "Rarity-weighted signature, completionist axis, and the 100%'d hall land next." Deferred to S7.C as planned: cross-game rarest, completionist axis verdict, 100%'d games hall.

### Phase S6 — Live presence + event-driven unlocks

`GetPlayerSummaries` is the cheapest Steam endpoint we touch (one call per tick regardless of library size). Poll it often, use the state transitions as the *signal source*: when the owner stops playing a game, fire an achievement refresh for that specific appid — collapses the S5 full-library unlocks sweep (13.6k → ~3k calls/day) while making "you just earned X" detection effectively near-realtime. "Now playing: X" chip + future activity feed fall out of the same data.

**Chunk 1 (S6.A) shipped 2026-05-16** — persisted player-state foundation. New `SteamPlayerState` model (singleton by `steamId`, holds `personaName`, `avatarUrl`, normalized `personaState` string, `profileVisibility` int, `currentAppid`/`currentGameName` for in-game state, plus `lastPolledAt` + `updatedAt`). `SteamPlayerStateService` does a single `GetPlayerSummaries` call → upsert; persona-state mapping duplicates the constant from `SteamService` rather than refactoring shared code (this row becomes the canonical home going forward — later chunks read sessions off this table). `SteamPlayerStatePoller` runs every 2 min (`*/2 * * * *` Europe/Brussels) — 720 calls/day, sub-1% of Steam's budget — with anti-overlap guard and a boot backfill via `OnModuleInit` so the read endpoint serves a row immediately. New shared DTO `SteamPlayerState` reuses `SteamCurrentGame` from `SteamSummary`. New `GET /steam/player-state` endpoint translates a null state row to 404 (boot-backfill should close that gap; frontend handles it as a loading state). Distinct from `/steam/summary` which makes a live call + fetches equipped cosmetics — the cached path is what surfaces poll on a short stale-time without amplifying Steam load. Migration `20260516001515_s6_player_state`.

**Chunk 2 (S6.B) shipped 2026-05-16** — "Now playing" chip on Profile. New `useSteamPlayerState` TanStack hook with 30s stale-time + 30s `refetchInterval` (matched to the 2-min server cadence so the chip notices in-game/leave-game transitions within ~30s of the next poller tick); 404s don't retry (fresh-DB gap). New `NowPlayingChip` composes `CardShell` directly: in-game state gets emerald-accented border + pulsing live dot + 231×87 capsule image (via existing `steamCapsuleUrl` — falls through to legacy `header.jpg` filename since the chip can hit non-owned/family-shared appids without enrichment data) wrapped in a `<Link to="/steam/game/$appid">`; not-in-game falls back to a regular chip with persona-state dot (online=sky, busy/away=amber, offline=muted) + "Last checked N min ago" relative-time evidence. Wired into `routes/steam/index.tsx` as the first chip in the grid. Inline `Intl.RelativeTimeFormat` helper covers minute/hour/day buckets without a new util — single use site.

**Chunk 3 (S6.C) shipped 2026-05-16** — persisted session transitions. New `SteamPlaySession` model (`id` cuid PK, `appid`, `gameNameSnapshot`, `startedAt`, `endedAt?`; indexed on `endedAt` and `(appid, startedAt)`). Migration `20260516010317_s6_play_sessions`. New `SteamPlaySessionsService` exposing a pure `computeTransition` function (testable without Prisma, mirrors `diffOwnedGames` shape) returning one of `noop | open | close | closeAndOpen`. The DB's currently-open row — not the prior player-state — is the source of truth, so orphan sessions left behind by a pre-Chunk-3 deploy converge on the next tick. `endedAt` is anchored to the *previous* tick's `lastPolledAt` when the open session matches the prior `currentAppid`, which preserves "last seen in game" semantics across poller downtime (a crash window of N hours closes at the pre-crash lastPolledAt, not the post-reboot wall clock). Orphan close (open appid doesn't match prior state, or no prior state at all) falls back to `now`. `SteamPlayerStateService.syncPlayerState` reads the previous row, calls `playSessions.recordTransition(...)` **before** the upsert, and only then writes `lastPolledAt`. Write order is load-bearing: a session row's `startedAt` defaults to Postgres `CURRENT_TIMESTAMP` at insert, while `lastPolledAt` is `new Date()` from Node's clock — if the upsert ran first, a single-tick session would record `endedAt < startedAt` by a few ms because the next tick's close uses this tick's just-written `lastPolledAt`, which precedes the session's `startedAt`. Reordering also gives implicit failure recovery: if the transition write fails, the upsert doesn't run, so the next tick retries with the same prior state instead of silently missing the event. The explicit boot reconciliation pass turned out to be unnecessary because the transition logic — driven off the DB's open row — naturally force-closes any stale open session on the next tick. No UI surface yet — backend prep for chunk 4. 8 unit tests on `computeTransition` cover the full transition matrix including the two orphan paths.

**Chunk 4 (S6.D) shipped 2026-05-16** — event-driven unlocks + recently-played backstop. Three landable sub-chunks:

- **S6.D-1** (foundation). New `SteamPlayerUnlocksService.refreshUnlocksForGame(appid)` pre-checks `SteamGameAchievementMeta.achievementCount > 0` before delegating to `syncUnlocks([appid])`, so schema-less games (CS2, demos) short-circuit cleanly and the per-game callers don't need to repeat the meta lookup. `player-unlocks.poller` cron slowed `5,20,35,50 * * * *` (every 15 min, ~13.6k calls/day) → `5 */4 * * *` (every 4 hours, ~850 calls/day) — full sweep now sits in backstop role.
- **S6.D-2** (event-driven trigger). `TransitionAction.close` and `closeAndOpen` carry `closedAppid` (sourced from the open-session row's `appid` that `computeTransition` already had in hand). `SteamPlaySessionsService` injects `SteamPlayerUnlocksService` and fires `refreshUnlocksForGame(closedAppid)` fire-and-forget after the close write lands. Decoupled from the player-state tick on purpose — a slow `GetPlayerAchievements` or saturated limiter mustn't delay the next 2-min tick or wedge the anti-overlap guard upstream. Drops are reconciled by the 4-hour backstop and the hourly recently-played poller. `play-sessions.service.spec` updated to assert `closedAppid` on every close-bearing transition (X→null, X→Y, orphan close, fresh-DB orphan).
- **S6.D-3** (recently-played backstop). New `SteamClientService.getRecentlyPlayedGames(steamId)` on a fresh `recently-played` limiter family wraps `IPlayerService/GetRecentlyPlayedGames/v1/`. New `SteamRecentlyPlayedUnlocksPoller` runs hourly at `15 * * * *` Brussels, filters the rolling-2-week set by `playtime_2weeks > 0`, and calls `refreshUnlocksForGame` per appid. Catches offline-play sessions the in-game detector missed (`personastate` never flipped to in-game). **Proactive owned-games resync** — if any returned appid is missing from `SteamOwnedGame` (newly-purchased game launched between daily owned-syncs), the poller fires `ownedGames.syncOwnedGames()` ahead of the unlock refresh so the on-add hooks (enrichment, schema, unlocks, rarity) bootstrap immediately rather than waiting up to 24h.

**Net call volume:** ~13.6k → ~950 calls/day on the unlocks path (full sweep 6×142 ≈ 852, recently-played hour-call 24, per-game refreshes ~50, event-driven ~5), *plus* near-realtime "you just earned X" detection on every session-end. The doc's "keep weekly full sweep" reads as the kept full-sweep cadence — at 6×/day it's a 42×/week safety net, so no separate weekly cron added; easy to layer one in later if the 4-hour cadence proves insufficient.

### Phase S7 — Achievement signature surfaces

Rarity-weighted score, time-to-100%, hidden-unlock reveal, stuck-at-X / abandoned-at-X mirrors. Per-game `CardShell` expansion. Hidden-unlock reveal already shipped in S5 chunk 6 (mask + click-to-reveal pattern on `AchievementPanel`).

**Chunk plan (set 2026-05-16, picked up after the S5 completion pass).** Signature surfaces only — Profile recent-unlocks chip + global page shell are S5's responsibility (chunks 8 + 9). S7.C extends the page S5.9 lands rather than creating it.

- **S7.A.1 — Per-game backdrop swap shipped 2026-05-16.** Small polish on top of S7.A: while the user is on `/steam/game/$appid`, the page backdrop fades from the profile background to the game's own store-page art and back on exit. Implementation:
  - `SteamProfileBackdrop` was promoted from a leaf component to a context provider; `routes/steam.tsx` now wraps the section with it instead of rendering it as a sibling. The provider exposes `useSteamGameBackdrop({ appid, assetTimestamp } | null)` and renders a portaled game layer on top of the profile layer via `AnimatePresence` so the cross-fade survives unmount on navigate-away.
  - Backdrop source is the image `store.steampowered.com/api/appdetails` exposes as `background` / `background_raw`: `https://store.akamai.steamstatic.com/images/storepagebackground/app/<appid>?t=<assetTimestamp>`. Note the **different host and path** than the rest of the asset family — store-page backgrounds live under `store.akamai.steamstatic.com/images/storepagebackground/app/...`, not the `shared.akamai.steamstatic.com/store_item_assets/...` tree the capsule/hero/logo helpers compose against. New helper `steamPageBackgroundUrl(appid, assetTimestamp, width)` in `_shared/steam-image.ts` composes the URL by hand instead of going through `composeSrc`, then wraps it in wsrv for resize + WebP transcode.
  - Initial Round 1 used `library_hero.jpg`; Round 2 switched to `page_bg_raw.jpg` (the `raw_page_background` field on `IStoreBrowseService/GetItems`) and shipped — but `page_bg_raw.jpg` 404s for many titles (confirmed against appid 3489700, Stellar Blade) where the appdetails background asset returned 200. Final implementation uses the appdetails path; spot-probed against CS2, Dota 2, BG3, Helldivers 2, Terraria, Rust, and Stellar Blade — 200 across the board. No per-game fallback wired since the asset appears universally available; the wsrv `naturalWidth === 0` silent-404 guard from S7.A.1 Round 2 is kept as a defensive net.
  - Zero backend changes. The URL keys off appid + the existing `assetTimestamp` cache-buster (already on `SteamGameEnrichment`); no new schema column.
  - Files: `apps/web/src/steam/profile-backdrop.tsx` (refactor to provider + game layer), `apps/web/src/steam/_shared/steam-image.ts` (new `steamPageBackgroundUrl`), `apps/web/src/routes/steam.tsx` (wrap with provider), `apps/web/src/routes/steam/game.$appid.tsx` (call hook).

- **S7.A — Per-game verdict expansion shipped 2026-05-16.**
  - Three new verdict cards alongside `CompletionVerdictCard` (S5 chunk 7) on `/steam/game/$appid`, all composing `CardShell` and sharing the `useGameAchievements` query (TanStack dedupe → one wire fetch per page).
    - **`TimeTo100Card`** (title "Timeline") — for 100%-complete games, `formatSpan(days)` between first and last unlock with densest-unit copy ("a single session" / "N days" / "N weeks" / "N months" / "N.N years"). For partial games, `Intl.RelativeTimeFormat` framing — "First unlock 2y ago — still pecking away." Indicator carries the raw day count ("47d" or "47d in" for partial).
    - **`RaritySignatureCard`** (title "Signature") — mean of `globalPercent` across unlocked rows where rarity is populated (`null` rows skip; missing data ≠ 0%). Five verdict bands by mean (sub-10% "Hunter signature", 10–25% "Goes for the rare ones", 25–50% "Mix of standards and rarities", 50–75% "Mostly the standard track", ≥75% "Surface-level unlocks so far"). Sub-3-unlock sample renders an empty-state "Too few unlocks to read a signature yet." with `empty` flag. Indicator: `${mean.toFixed(1)}% avg · n=${sample.length}` — sample size is visible so the user can judge confidence.
    - **`RarestUnlockCard`** — lowest `globalPercent` among unlocked rows. Verdict is the achievement's `displayName`; evidence shows the icon + rarity qualifier ("Very rare" < 1%, "Rare" < 5%, "Uncommon" < 25%, "Common" else) + description. Amber indicator for the percent. Hides entirely when no unlocked row has rarity data (still possible on a freshly-added game before the weekly rarity poller has covered it).
  - Zero new backend — every needed field was already on `SteamGameAchievements`.
  - Layout: replaced the inline `<CompletionVerdictCard />` placement with a `grid grid-cols-1 md:grid-cols-2` row holding all four cards (Completion → Timeline → Signature → Rarest, reading top-left → bottom-right). `AchievementPanel` continues to render below the grid.
  - All cards null-render gracefully when their preconditions fail — `data === undefined` (loading), `achievements === null` (schema-less game like CS2), empty achievements array, or per-card empty (no unlocks for Timeline, no rarity data for Signature/Rarest). `CompletionVerdictCard` carries the only "owned but untouched" empty-state copy; the other three hide instead, so the grid collapses from 4→1 cell rather than showing four "no data yet" tiles.
  - Files: `apps/web/src/steam/game/{time-to-100,rarity-signature,rarest-unlock}-card.tsx` (new), `apps/web/src/routes/steam/game.$appid.tsx` (modify: import + grid wrapper).

- **S7.B — `rtime_last_played` + Last-progressed verdict shipped 2026-05-16.** Picked up the deferred S3 follow-up.
  - **Backend (commit `8d2a6dc`).** `rtimeLastPlayed DateTime?` on `SteamOwnedGame` with migration `20260516160248_s7_b_rtime_last_played`; `rtime_last_played?: number` added to `SteamOwnedGameRaw`; `syncOwnedGames` narrows Steam's `0`-means-never-launched to `null` at write time, so the column distinguishes "never started" from "started long ago." Projected through `SteamOwnedGame.rtimeLastPlayedAt: string | null` on the existing `getOwnedGames` read path — no new endpoint. Verified live via the existing `sync-steam-owned-games.ts` script: 175 owned, 72 populated, top by recency Silksong / Wallpaper Engine / RE4 / RE3 / Pragmata. The 103 nulls are titles where Steam emits `rtime_last_played: 0` — distinct from "field absent." No boot self-heal predicate (unlike S5.5.B's monthly enrichment) since owned-games already runs every 15 min.
  - **Frontend (commit `dd103c4`).** `LastProgressedCard` composes `useSteamOwnedGames` (for `rtimeLastPlayedAt`) + `useGameAchievements` (for latest `unlockedAt`); both share cache keys with the page's existing consumers (library list, AchievementPanel) so the card adds zero wire fetches. 7-band verdict logic — 100% terminal ("100% complete — last touched 2mo ago"), no-schema fallback ("Last launched 8d ago"), owned-but-no-unlocks ("Launched 4mo ago — no achievements earned yet"), active recently (both launch + unlock ≤ 14d), launching-not-progressing (launch ≤ 14d but unlock > 30d, the canonical chunk-spec call-out), stuck-at-X/Y (partial + stale unlock), and a "Last played" fallback. Indicator is a compact `Xd` / `Xmo` / `X.Yy` ago. Slotted into the existing 2-col grid as the 5th tile (Completion → Timeline → Last progressed → Signature → Rarest).
  - **Library tile decluttering (decided in flight).** Original chunk plan added `· last played Nmo ago` inline on tile + row. Live on the page, the tile subtitle (200px-ish column under a 2:3 portrait capsule) truncated the hint to "...last played..." before the relative time was visible — the new info was always ellipsis'd out. Pivoted: dropped *both* the "last played" hint and the pre-existing "last two weeks" suffix from tile subtitles, leaving just `Xh lifetime` or `Never launched`. All three temporal facets (Last two weeks · Total · Last played) now live in the hovercard's existing "TIME PLAYED" block, where there's actual layout space. Row variant keeps the inline `· last played Nmo ago` hint (suppressed when the 2-week marker is set) — row has the full container width, no truncation concern. Adopted as a soft rule: tile subtitles are for the single most-load-bearing fact; multi-facet temporal context belongs in the hovercard.
  - **No nudges held.** Verdict copy stays descriptive — "Stuck at 47/49", "Launching but not progressing" — never prescriptive. Matches the pinned [constraint](#constraints-pinned-now).
  - **Done.** `rtimeLastPlayed` populates on every owned-games sync; game-detail renders the verdict card; library hovercard exposes the timestamp.

- **S7.C — Cross-game signature on `/steam/achievements` shipped 2026-05-16** across two commits (`f3206b7` cross-game rarest, `821cff1` completionist axis + 100%'d hall).
  - **C-1 backend (commit `f3206b7`).** New `getCrossGameRarest(limit)` in `SteamAchievementsService` — ordered by `achievement.rarity.percent` asc with `rarity` joined-`isNot: null` to skip rows the weekly poller hasn't covered yet (null rarity isn't "very rare," it's "unknown"). Reuses the existing `SteamRecentUnlocks` shape since every field needed is already on the DTO; cap tightened to 50 vs recent-feed's 200 because past ~50 the visual register stops being a "signature" and starts being noise. Route `GET /steam/achievements/rarest?limit=N` on `SteamController`.
  - **C-1 frontend (commit `f3206b7`).** `useCrossGameRarest(limit)` hook (30-min stale matching the recent feed); `RarestSection` + `RarestRow` slotted above the recent-feed grouping on `/steam/achievements`. Sub-5% rows take an amber accent (border, ring, percent text) mirroring per-game `RarestUnlockCard`; the rest render plain card-bg. Pending/empty collapses silently (no banner above primary content); error renders inline. Subtitle expanded to flag the new section while completionist axis was still pending.
  - **C-2 backend (commit `821cff1`).** New `getLibraryCompletion()` returning `SteamLibraryCompletion = { stats: SteamGameCompletion[] }` where each stat is `{ appid, total, unlocked, lastUnlockedAt }`. Two grouped queries fired in `Promise.all` and joined in JS — `SteamGameAchievement.groupBy({ by: ['appid'], _count: { apiName } })` for totals + `SteamPlayerUnlock.groupBy({ by: ['appid'], _count, _max: { unlockedAt } })` for unlocks. Schema-less games (`total === 0`) filtered server-side; schema-present-zero-unlocks rows kept so the page's "untouched on the achievement front" group remains visible. Sort left to the client — completion-axis math wants pct asc, 100%'d hall wants `lastUnlockedAt` desc, neither is the right server-side default. Route `GET /steam/achievements/library-completion` on `SteamController`. Two new types exported from `@vyoh/shared`: `SteamGameCompletion` + `SteamLibraryCompletion`.
  - **C-2 frontend — completionist axis (commit `821cff1`).** `CompletionistAxisCard` composes `useLibraryCompletion` + `useSteamOwnedGames` + `useSteamTags` with two memos — `cohort` (games with `unlocked > 0`) and `tagSlice` (per-tag median across the cohort using `SteamOwnedGame.tagIds`, requires ≥3 games per tag). Library median computed across the cohort, with a 5-band verdict — "Hard completionist" (≥90), "Sees it through" (≥60), "Honest middle ground" (≥30), "Skim, then move on" (≥10), "Pulls a few, drops it" (else). Optional tag-slice verdict ("Sees it through — except Roguelike.") fires only when the top tag's median beats the library median by ≥15pp; the lead threshold keeps it from triggering on rounding noise. Cohort under N=5 renders an empty-state in the CardShell rather than collapsing — the slot stays held so the recent feed below doesn't shift as the query resolves. Indicator shows `{round(median)}% · n={cohort.length}` so confidence is legible.
  - **C-2 frontend — 100%'d hall (commit `821cff1`).** `HundredPercentHall` filters `total === unlocked && total > 0`, joins with `useSteamOwnedGames` for name + capsule paths + assetTimestamp, sorts by `lastUnlockedAt` desc. Renders a responsive grid (2 / 3 / 4 / 5 columns at sm/md/lg breakpoints) of 2:3 library capsules via `steamLibraryCapsuleUrl`. Title and achievement count under each tile; clicks route to `/steam/game/$appid`. Collapses silently when pre-completion (no games at 100%) or on query error — the page's lower sections still render.
  - **Page wiring.** `routes/steam/achievements.tsx` now renders, top to bottom: heading + subtitle, completionist axis card (in a 2-col grid wrapper to reserve a future slot), rarest section, 100%'d hall, recent feed. Subtitle trimmed of the "land next" hint since all three surfaces are now live.
  - **Files:** `apps/api/src/steam/achievements.service.ts` (+ `getCrossGameRarest` + constants + `getLibraryCompletion`), `apps/api/src/steam/steam.controller.ts` (+ two routes), `packages/shared/src/steam/achievements.ts` (+ DTOs) + `packages/shared/src/index.ts` (re-exports), `apps/web/src/steam/use-cross-game-rarest.ts` (new), `apps/web/src/steam/use-library-completion.ts` (new), `apps/web/src/steam/achievements/completionist-axis-card.tsx` (new), `apps/web/src/steam/achievements/hundred-percent-hall.tsx` (new), `apps/web/src/routes/steam/achievements.tsx` (wire + format).
  - **Done.** Three new surfaces render on `/steam/achievements` alongside the recent feed; completionist axis hides gracefully when sample < 5; 100%'d hall collapses when no game is fully complete.
  - **Post-ship route split 2026-05-16.** Live, having axis + hall + rarest stacked above the recent feed pushed the running unlocks below several screens of signature content — recent kept feeling buried. Rejected tabs (third nav layer above the app + Steam navs); split the signature surfaces to `/steam/achievements/signature` as a contextual drill-in. `/steam/achievements` is now recent-feed-only again with a `View signatures →` link under the heading; the sub-route hosts axis + hall + rarest with an `← Recent unlocks` back link. Steam tab's `exact: false` keeps the parent Achievements tab active on the sub-route, so no Steam-level nav addition. `RarestSection` moved out of `routes/steam/achievements.tsx` into `apps/web/src/steam/achievements/rarest-section.tsx` (self-contained, no props). New file: `apps/web/src/routes/steam/achievements.signature.tsx`.

- **S7.D — Trophy case on `/steam` shipped 2026-05-16.** Closed S7's last visible-deficit: signature surfaces used to live two clicks deep, headline view showed summary cards only. Now the top-rarest unlocks read as a pride-of-place strip on the main Steam profile section, with the full vertical list still owning `/steam/achievements/signature`.
  - **Implementation.** `TrophyCaseStrip` (`apps/web/src/steam/profile/trophy-case-strip.tsx`) composes `useCrossGameRarest(10)` + `useSteamOwnedGames` — fetch 10 so the sub-10% gate has headroom, render up to 5, drop entries with `globalPercent >= 10`. Each tile is a 184×69 small capsule with the publisher art behind a left-fading gradient, the achievement icon as a 40px medallion in the lower-left, and a tabular `N.N%` chip top-right. Sub-5% tiles inherit the amber border + tinted display-name treatment from `RarestSection`/`RarestUnlockCard`; the rest read as plain trophies — the capsule does the framing either way. `displayName` + `gameName` truncate beneath; per the Radix-tooltip rule no native `title=` is used.
  - **Wiring.** Slotted into `routes/steam/index.tsx` between `<NowPlayingChip>` and the chip grid. `Link to="/steam/game/$appid"` with `search={{ ach: unlock.apiName }}` deep-links to the achievement panel. `prefetchSteamGameBackdrop` fires on both `onMouseEnter` and `onFocus`, using the assetTimestamp joined from owned-games so the prefetched key matches the game-detail page.
  - **Section header.** "Trophy case" eyebrow on the left, "See full signature →" link on the right pointing at `/steam/achievements/signature` — preserves the headline-to-drill-in path for owners who want the cards.
  - **Collapse behavior.** Hides silently while either query is pending, and when the joined list is empty (pre-rarity-poll, or all rarest unlocks ≥ 10%). The recent-unlocks chip below renders unchanged.
  - **Files.** `apps/web/src/steam/profile/trophy-case-strip.tsx` (new), `apps/web/src/routes/steam/index.tsx` (slot + import).
  - **Validation.** `pnpm run check:cc`, `pnpm run typecheck:cc`. Browser verify: renders on `/steam`, links navigate to the right achievement, capsules load via `/img/steam/capsule/*`.

**Sequencing:** A → B → C → D. A is the smallest highest-visible delta (mirrors S5 chunk 7's shape); B introduces the only new data; C is the largest cross-game lift and depends on chunk 9 having shipped the page shell. D ports the cross-game rarest into a headline-visible strip. Order can be revisited at chunk boundaries.

**Phase S7 exit criteria:** all four verdict families from the [achievement family brainstorm](#verdict-family-per-game-conclusioncards) visible somewhere — per-game on `/steam/game/$appid`, cross-game on `/steam/achievements`. Temporal surfaces (per-game timeline, cross-game heatmap, first-played-meaningfully, chronotype) stay in **Phase S8**.

### Phase S8 — Temporal + cross-stream

Cross-game unlock heatmap, per-game timeline, LoL-vs-Steam evening split (uses S4 achievement-anchor reconstruction), weekly gaming-total bento card, session-length distribution. The cross-stream payoff lands here.

**Chunk plan (set 2026-05-16, after S7.D).** Two chunks open S8 by realizing the cross-stream rule that was sharpened in `1a41fb1` (`/` is for synthesis, not feeds). The `/home` chronotype tile today buckets LoL match `playedAt` only — making it actually cross-stream is the smallest demonstrable payoff. Chunks 1 + 2 ship the substrate and the synthesis tile; the remaining S8 surfaces (per-game timeline, LoL-vs-Steam evening split, weekly bento, session-length distribution) chunk separately after these two land.

- **S8.1 — Steam chronotype substrate (shipped ce2346e 2026-05-17).** Steam side of chronotype, owner-local hour-bucketing over `SteamPlayerUnlock.unlockedAt`. Lives on `/steam/achievements/signature` per the cross-stream rule; substrate enables S8.2.
  - **New (api).** `apps/api/src/steam/steam-chronotype.service.ts` — `getChronotype(count = 500)` against indexed `SteamPlayerUnlock` rows ordered by `unlockedAt desc`. Server-side bucketing in `Europe/Brussels` via `Intl.DateTimeFormat({ timeZone: "Europe/Brussels", hour: "2-digit", hourCycle: "h23" })`. Returns `{ timeZone, hours: ChronotypeHour[] }`. Mirrors the LoL chronotype service shape — find it via LSP and pattern-match the file structure.
  - **New (api).** `apps/api/src/steam/steam.controller.ts` — `@Get("chronotype")`.
  - **New (shared).** `packages/shared/src/steam/chronotype.ts` — `SteamChronotype` + `SteamChronotypeHour`. Barrel export from `packages/shared/src/index.ts`. Mirror `packages/shared/src/lol/chronotype.ts` so chunk 2 can treat both streams uniformly.
  - **New (web).** `apps/web/src/steam/use-steam-chronotype.ts` — react-query hook. `apps/web/src/steam/achievements/steam-chronotype-tile.tsx` — 24-bar heatmap mirroring LoL `TileChronotype`. Slot onto `/steam/achievements/signature` between hall + axis.
  - **Decisions baked in.** 500-unlock window matches LoL chronotype's 500-match default; the `[appid, unlockedAt]` index already exists. Color encoding is count-density only (no win-rate axis to color by) — single muted accent ramp; bars *are* the verdict. No sample-size gate (`SampleSizeBadge` carries n). Verdict-less, same as LoL chronotype.
  - **Validation.** check + typecheck + unit test for the bucketing logic (pure function, deserves a `steam-chronotype.service.spec.ts`).

- **S8.2 — `/home` chronotype becomes cross-stream (shipped `07197df` 2026-05-17).** The synthesis payoff. The home-deck chronotype tile, today fed by LoL matches only, becomes the canonical cross-stream surface — bucketed across LoL `playedAt` + Steam `unlockedAt`. Directly realizes the rule from `1a41fb1`.
  - **Modify (api).** The existing home chronotype endpoint (verify location via LSP — likely under `apps/api/src/home/` or `apps/api/src/lol/`) merges both streams server-side and returns a single `{ timeZone, hours }` with summed counts. Per-stream endpoints (LoL chronotype, S8.1 Steam chronotype) stay untouched as drill-in data.
  - **Modify (web).** `apps/web/src/home/tile-chronotype.tsx` — copy update ("across LoL and Steam"). Single bar per hour summing both streams. Sample-size badge becomes "N matches + M unlocks".
  - **Graceful degrade.** Empty-Steam case still renders LoL-only; the Steam contribution drops to zero without breaking the tile. Verifies at the API layer (Steam side returns empty `hours[]` if no unlocks) — no special-casing in the UI.
  - **Out of scope (S8 follow-ups, not this chunk).** Per-stream toggle on the tile (stacked / LoL-only / Steam-only); per-game unlock timeline on `/steam/game/$appid`; first-played-meaningfully chip; LoL-vs-Steam evening split (separate S8 surface); weekly gaming-total bento; session-length distribution.
  - **Validation.** Browser verify the merged tile reads cleanly with both streams populated. Then dev-test the empty-Steam path (or confirm by code-reading the merge logic).

- **S8.3 — Per-game unlock timeline (shipped `bb6d911` 2026-05-17).** Monthly bar chart of achievement unlocks on `/steam/game/$appid`, slotted between the screenshot strip and the verdict grid. Lives on the per-game route — not cross-stream, but a temporal surface the S8 exit criteria list. sqrt-scaled bar heights so outlier months don't crush sparse activity; zero-count months render at zero height but preserve time proportionality; minimum 12 bars via client-side padding avoids the single-bar full-width edge case; `min-w-2` + `overflow-x-auto` keeps bars usable on long spans. Reuses `SteamPlayerUnlock` directly (no schema change). New `getGameUnlockTimeline(appid)` on `SteamAchievementsService`, `GET /steam/achievements/games/:appid/unlock-timeline`, `apps/web/src/steam/game/game-unlock-timeline.tsx`.

- **S8.4 — Weekly gaming-total bento tile (planned).** Cross-stream "this week" surface on `/`. LoL match count + LoL hours (sum `durationSec`) + Steam hours (per-appid playtime delta from `SteamPlaytimeSnapshot`) = total gaming this week. Smallest cross-stream surface beyond chronotype, called out in [self-portrait-surfaces.md](self-portrait-surfaces.md) as "best first cross-stream pick."
  - **New (api).** `apps/api/src/home/home-weekly-totals.service.ts` — rolling 7-day window anchored on now (avoids the Monday-morning-empty cliff a calendar week would have). Pure-function `diffPlaytimeMinutes(rows, windowStart)` carve-out: per-appid, `latest.playtimeForeverMinutes − latestBaseline.playtimeForeverMinutes` where baseline is the latest snapshot at or before `windowStart`. Appids without a baseline at-or-before `windowStart` are excluded — within-window playtime is unknown. Negative deltas are clamped to 0 (defensive against family-share / refund anomalies). LoL: `match.findMany({ where: { remake: false, playedAt: { gte: weekStart } }, select: { durationSec: true } })`, sum and convert to minutes at the service boundary.
  - **New (api).** `apps/api/src/home/home.controller.ts` — `@Get('weekly-totals')`. Module wires the service.
  - **New (api).** `apps/api/src/home/home-weekly-totals.service.spec.ts` — covers the eight snapshot-diff cases (empty, no-baseline, exact-boundary-baseline, multi-appid sum, negative-delta clamp, idle-week, mixed-baseline exclusion).
  - **New (shared).** `packages/shared/src/home/weekly-totals.ts` — `HomeWeeklyTotals` DTO + barrel export.
  - **New (web).** `apps/web/src/home/use-home-weekly-totals.ts` (react-query hook, 30-min staleTime mirroring chronotype). `apps/web/src/home/tile-weekly-totals.tsx` — `Shell`/`Heading`/`Empty` mirroring `tile-chronotype.tsx`. Headline metric is total hours, two-line breakdown beneath: `LoL · N matches · Xh Ym` and `Steam · Zh Wm` (em-dash when Steam contributes 0). Sample-size footer: "Last 7 days · ending {date}".
  - **Modify (web).** `apps/web/src/routes/index.tsx` slots `<TileWeeklyTotals />` as `width={2}` between LastMatch and BuildBadge.
  - **Decisions baked in.** Rolling window over calendar week; snapshots over sessions (canonical daily series, sessions are gappy outside actively-monitored windows); negative-delta clamp; no verdict copy — the numbers are the verdict.
  - **Out of scope (later S8 surfaces).** LoL-vs-Steam evening split (needs session reconstruction); session-length distribution; first-played-meaningfully chip.
  - **Validation.** check + typecheck + the new spec; browser-verify the tile reads cleanly; dev-test the empty-Steam path by querying with a `weekAgo` so far back no snapshots predate it.

**Closing S8 (set 2026-05-17, after S8.4).** Four chunks finish the phase: S8.5 + S8.6 are the secondary items called out in S8.2's out-of-scope list; S8.7 + S8.8 are the two remaining exit-criteria surfaces. Substrate decision baked in for both exit-criteria chunks: `SteamPlaySession` (forward-only, poller-driven since S6) is the canonical source for Steam sessions — achievement-anchor reconstruction stays parked until/unless historical depth becomes a limiter.

- **S8.5 — First-played-meaningfully chip (shipped 2026-05-17).** Cross-stream `/` tile carrying *one* event: the most-recent "new in the rotation" between (a) first LoL match on a previously-unplayed champion and (b) Steam game crossing 30 min `playtimeForeverMinutes` for the first time. Copy: "Newest in the rotation: {name} — {time-ago}, {sample-so-far}." Not a list; the synthesis is "what's *new*", not "what's been played".
  - **New (api).** `apps/api/src/home/home-first-played.service.ts` — pure-function carve-outs `detectFirstLolChampion(matchRows)` and `detectFirstSteamCrossing(snapshotRows, thresholdMinutes)`. Service picks the most recent of the two. LoL: per-championId first occurrence, remakes excluded. Steam: per-appid first snapshot with `playtimeForeverMinutes >= 30` *after* an earlier row with `< 30` (true crossing observed); appids with no pre-threshold baseline are excluded (lower-bound unknown, same discipline as S8.4).
  - **New (api).** `home-first-played.service.spec.ts` — per-stream detection, most-recent tie-breaking, no-event empty, multi-champion / multi-appid pick correctness.
  - **New (shared).** `packages/shared/src/home/first-played.ts` — `HomeFirstPlayed` discriminated union over `{ kind: "lol" | "steam" | "none", ... }` so the tile renders the right framing without runtime sniffing.
  - **New (web).** `use-home-first-played.ts` + `tile-first-played.tsx` — `Shell`/`Heading`/`Empty` mirroring weekly-totals. 30-min staleTime.
  - **Modify (api).** `home.controller.ts` + `home.module.ts` register the service.
  - **Modify (web).** `apps/web/src/routes/index.tsx` slots `<TileFirstPlayed />` between WeeklyTotals and BuildBadge.
  - **Decisions baked in.** Threshold 30 min for Steam; 1 match for LoL (a played match already implies commitment). 30-day staleness window — older first-played events drop to the "Same rotation as last month." empty verdict. Single event, not a feed.
  - **Out of scope.** Backfilling Steam first-played from pre-snapshot history. Surfacing both streams' newest game simultaneously.
  - **Validation.** check + typecheck + spec; browser-verify empty + populated paths.

- **S8.6 — Per-stream toggle on home chronotype (shipped 2026-05-17).** The merged chronotype tile shipped in S8.2 gains a Both/LoL/Steam segmented control. One fetch, three views.
  - **Modify (api).** `home-chronotype.service.ts` — returned `hours[]` carries `{ hour, total, lol, steam }`. Per-stream counts kept alongside the total instead of summed into a single field.
  - **Modify (shared).** `packages/shared/src/home/chronotype.ts` — DTO extended.
  - **Modify (api).** `home-chronotype.service.spec.ts` — per-stream attribution covered.
  - **Modify (web).** `apps/web/src/home/tile-chronotype.tsx` — segmented control (Both default); bars + sample-size badge derive from the active stream.
  - **Decisions baked in.** Toggle state is component-local — passive surface, not a deep view. Default "Both" preserves S8.2's synthesis framing.
  - **Validation.** check + typecheck + updated spec; browser-verify all three views.

- **S8.7 — LoL-vs-Steam evening split (planned, exit criterion).** 24-bar tile on `/` showing minutes-by-hour-of-day split by stream. LoL from `Match.playedAt` + `durationSec`; Steam from closed `SteamPlaySession` rows. Both bucketed in `Europe/Brussels`. Intervals crossing hour boundaries split proportionally per minute.
  - **New (api).** `home-day-split.service.ts` — pure-function `splitIntervalsByHour(intervals, timeZone)` taking `{ startedAt, endedAt }[]` and returning `Record<hour, minutes>`. LoL matches (`{ playedAt, playedAt + durationSec }`) + closed Steam sessions flow through the same splitter.
  - **New (api).** `home-day-split.service.spec.ts` — within-hour, exact-boundary, multi-hour span, midnight-crossing, Brussels DST spring + fall, empty.
  - **New (shared).** `packages/shared/src/home/day-split.ts` — `HomeDaySplit` DTO with `{ timeZone, hours: { hour, lolMinutes, steamMinutes }[] }`.
  - **New (web).** hook + `tile-day-split.tsx` (24-hour x-axis matching chronotype; stacked bars unless side-by-side reads better — final call during impl).
  - **Modify (web).** route slot.
  - **Decisions baked in.** Proportional split. Steam uses *closed* sessions only. No rolling cap — both surfaces want long-horizon shape.
  - **Validation.** check + typecheck + spec; DST cases live in the spec.

- **S8.8 — Session-length distribution (planned, exit criterion).** Histogram tile on `/` showing session-length distribution across both streams. Buckets: `<30m`, `30m–1h`, `1h–2h`, `2h–4h`, `4h+`.
  - **LoL session = block of matches with ≤30 min gap between consecutive matches** — length = sum of `durationSec`. Single-match sessions valid. 30-min gap covers queue dodge / champ select / quick break but separates "done now" from "next one."
  - **Steam session = closed `SteamPlaySession` rows** — length = `endedAt − startedAt`.
  - **New (api).** `home-session-lengths.service.ts` — pure-function `stitchLolSessions(matches, gapMinutes)` carve-out; service queries both streams + histograms.
  - **New (api).** `home-session-lengths.service.spec.ts` — single match, two within gap, two outside gap, three with mixed gaps, empty.
  - **New (shared).** `packages/shared/src/home/session-lengths.ts` — `HomeSessionLengths` with `{ buckets: { label, lolCount, steamCount }[], lolSessionCount, steamSessionCount }`.
  - **New (web).** hook + tile.
  - **Modify (web).** route slot.
  - **Decisions baked in.** 30-min stitch threshold. Fixed bucket boundaries. Counts not minutes — the surface answers "*how* do I play" (bursts vs sits), not "how much."
  - **Validation.** check + typecheck + spec; browser-verify.

**Bento density follow-up.** After S8.5 lands `/` carries 8 tiles; S8.6 doesn't add one (modifies chronotype); S8.7 + S8.8 each add one — 10 total. Decision needed before S8.7: cluster the cross-stream synthesis tiles into a sub-group, or absorb flat. I'll surface this before slotting S8.7.

**Phase S8 entry criteria.** S7.D landed (cross-game-rarest data has a headline surface to compare against); chronotype LoL tile is on `/home` (chunk 2 of home-deck, shipped 2026-05-14); cross-stream rule articulated in [self-portrait-surfaces.md § Routing principle](self-portrait-surfaces.md#routing-principle-sharpened-2026-05-16).

**Phase S8 exit criteria.** All five S8 brainstorm surfaces visible somewhere — cross-game heatmap (S8.1 + S8.2), per-game timeline, LoL-vs-Steam evening split, weekly gaming-total bento, session-length distribution. Yearly + career-narrative stays in **Phase S9**.

### Phase S9 — Yearly + career-narrative

Your year in achievements, 100%'d games hall, cross-stream yearly hero. Folds Steam into the existing yearly-recap engine.

S2 and S3 are independently shippable warm-ups; S4 is foundational; S5–S9 build on S4. S4.6 is independent of the achievement arc and can land in parallel with S5. S6 is independent of S5's remaining chunks (8 + 9) and chosen to land first because the unlocks-cadence question naturally bleeds into it.

---

## Still open

- Wishlist endpoint stability — `wishlistdata/` is widely used but undocumented. Have a lightweight backstop plan if it changes.
- Hidden games. The owner can hide individual games from the public profile; those simply won't appear. No mitigation, just a known gap.
- **Steam read-side test pass shipped 2026-05-16** (commits `cedf5f7`, `9eddd9d`, `afb9eef`). Three landable chunks: owned-games read paths (`getLibrarySummary` / `getPlatformMix` / `getOwnedGames`); read-only services without prior specs (`tag` / `achievements` / `player-state`); side-effect/cache services (`achievement-schema` / `global-rarity` / `player-unlocks` / `screenshot`). PrismaService mocked at the method surface, no DI test module — matches the seam pattern already used by `pics`, `play-sessions`, `enrichment`. Workspace test count moved from 187 → 226. `getOwnerWishlist` was already covered in `steam.service.spec.ts` from S2.
- **Logo-asset gap on recent titles → resolved by S5.5 PICS arc (investigated + solved 2026-05-16).** Symptom: Steam client renders a wordmark for newer titles like RE Requiem (appid 3764200) and Pragmata (3357650), but the unhashed legacy mirror `…/apps/{appid}/logo.png` returns 404 — our text fallback kicks in. **Resolution: enrich `SteamGameEnrichment` with `logoPath` from PICS.** Tracked as S5.5 below.
  - **Breakthrough (2026-05-16).** RE Requiem's per-asset logo hash lives in the local Steam client at `Steam/appcache/librarycache/3764200/c0cb6f0c5702fdb43a1ff89cee79ffbe4d990b47/logo.png`. The same asset is publicly fetchable at `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/3764200/c0cb6f0c5702fdb43a1ff89cee79ffbe4d990b47/logo.png` (200, 69688-byte PNG) — both `logo.png` and `logo_2x.png` resolve; the legacy filename `library_logo.png` does not. So the asset *is* on Steam's public CDN; the only missing piece is the per-app hash. The hash is per-asset-type (`library_capsule`, `library_hero`, `header`, `logo` all differ per app) — can't sibling-derive it from `GetItems`.
  - **Why the public Web API can't help.** Re-probed `IStoreBrowseService/GetItems` exhaustively with speculative `data_request` flags. Response asset block is a fixed 17-key shape (per `StoreItem.Assets` in `steammessages_storebrowse.steamclient.proto`); no `library_logo` field exists in *any* proto in the SteamDatabase/Protobufs repository (verified by grep). Other Web API endpoints (`ICommunityService/GetApps`, `IStoreService/GetAppInfo`, `store.steampowered.com/api/appdetails`, `IClientUI/*`, `IClient/GetClientLibraryAssets`) either lack the field or are auth-gated. SteamDB/SteamGridDB are JS SPAs with auth-gated APIs. Visual confirmation: RE Requiem's hero has intentional left-side negative space designed for an overlay; Capcom *did* upload a logo, it's just not at the unhashed legacy path the way MH Wilds is.
  - **Where the hash actually lives.** PICS — Steam's Product Info Cache Service, accessed via the Steam network protobuf protocol (TCP to a CM, not HTTPS). `common.library_assets.logo` carries the hash, plus a timestamp. This is how SteamDB and the desktop client populate the librarycache folder. Anonymous logon is sufficient — no user session token required.

### Phase S5.5 — PICS-driven logo enrichment (shipped 2026-05-16)

Closed the wordmark gap before S7.B (`rtime_last_played`) so the per-game verdict cards land with proper branding. Three chunks landed sequentially, RE Requiem + Pragmata verified rendering live.

- **S5.5.A shipped (commit `da06c5b`).** `steam-user@5.3.0` dep + `SteamPicsService` with anonymous-logon → `getProductInfo([appids])` → disconnect lifecycle, 20s logon + 30s product-info timeouts, ambient `steam-user.d.ts` since the package ships JS-only. Protected `createClient()` test seam — Nest can't resolve a constructor-injected factory at module init, so a method override beats DI gymnastics. Hosting implication captured in [hosting.md](hosting.md#steam-network-protocol-outbound-tcp) (first outbound non-HTTPS dep — firewall must not lock egress to 80/443).
- **S5.5.B shipped.** Migration `20260516152748_s5_5_b_logo_path` adds `logoPath String?` to `SteamGameEnrichment`. `projectEnrichment` takes the path as a separate optional param (pure merge, not derived from the GetItems raw); `enrichApps` fetches PICS once per call (single logon, all appids in one `getProductInfo`) and merges by appid. PICS failure is non-fatal — logged and the row still lands with `logoPath: null`. Boot backfill predicate widened to `OR: [{ enrichment: null }, { enrichment: { is: { logoPath: null } } }]` so existing rows self-heal on first deploy. Projected through `SteamOwnedGame.logoPath`.
- **S5.5.C shipped.** `steamLibraryLogoUrl(appid, logoPath?, width?)` now collapses to a one-line `wsrv(composeSrc(...), …)` — same shape as the other asset helpers. Library tile + game-detail page both pass `game.logoPath`; the existing `onError`→title-text fallback stays for the residual PICS-null + 404 cases.

**PICS shape surprise (worth knowing for future asset work).** First boot backfill landed 0/173 rows because the live response shape doesn't match what the SteamDB protobuf docs suggested. The actual layout, confirmed against an anonymous logon:

```
common.library_assets_full.library_logo = {
  image: {
    english: "<hash>/logo.png",
    japanese: "<hash>/logo_japanese.png",
    koreana: "<hash>/logo_koreana.png",
  },
  image2x: { english: "<hash>/logo_2x.png", ... },
  logo_position: { pinned_position, width_pct, height_pct }
}
common.library_assets.library_logo = "en,ja,ko"   // just a locale marker, no hash
```

So `image` is a **locale-keyed map**, not a bare hash string; the flat `library_assets` form carries no hash at all (only a comma-separated language list). The extractor now picks `image.english`, falls back to first available locale, and treats an older bare-string `image` shape defensively. After the fix: 159/173 owned titles get a hash; the 14 nulls are older titles PICS doesn't carry a logo entry for (frontend falls back to the unhashed legacy mirror, which works for them).

**Sequencing rationale held up.** A was a clean network-protocol de-risk (worked first try in production). B's schema + boot backfill landed without surprises. C surfaced the response-shape mismatch — a smoke test against the live API would have caught it earlier than a deploy + DB check did. Worth doing for the next PICS expansion.
- **Asset pipeline is provisional.** S3 chunk 3 (commit `e1ab677`, 2026-05-14) shipped a bundled-manifest pipeline for capsules mirroring the LoL approach. A subsequent decision the same day plans to retire both the Steam and LoL bundled pipelines in favor of a server-side image proxy with stale-while-revalidate — content-driven deploys (every wishlist add) are the smell that surfaced it. The pivot is sequenced after Steam S5; the chunk-3 bundle will be reverted as part of that arc. Tracked in [lol-image-pipeline.md Phase 4](lol-image-pipeline.md#phase-4--runtime-image-proxy-planned-multi-stream).

---

## Cross-references

- The "Cross-pollination with the Steam roadmap" subsection in [self-portrait-surfaces.md](self-portrait-surfaces.md#cross-pollination-with-the-steam-roadmap) is the parent reframe.
- [vnext-ideas.md](vnext-ideas.md) — Steam integration is implicit there as the next big arc after the documented roadmaps; this doc is the dedicated home.
- Rate-limiter and asset-pipeline approaches: reuse the patterns from existing case studies (`riot-rate-limits`, `build-time-champion-assets`).
