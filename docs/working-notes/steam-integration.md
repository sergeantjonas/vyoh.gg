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

**Chunk 2 shipped 2026-05-15** across sub-chunks C-2.1 through C-2.5 (commits `03e32cb` + `574d25a` + `2666fb1` + `88352b6` + `8d28985` + `576d292` + `6035fbb` + `d3e8b4e` + `830fde4` + `8074fc3`). New `SteamGameEnrichment` table keyed off `SteamOwnedGame.appid` (one-to-one) storing per-asset hashed paths (`libraryCapsulePath`, `libraryCapsule2xPath`, `libraryHeroPath`, `libraryHero2xPath`, `headerPath`, `heroCapsulePath`), `assetUrlFormat` template, `assetTimestamp` cache-buster (BigInt epoch extracted from the `?t=` suffix), `appType` (Steam StoreItemType int — 0 = Game, 6 = Application/Tool), `releaseDate`, `isFree`, top-20 `tagIds` (community tags ordered by weight desc — genre stand-in, since `GetItems` doesn't expose `genres` directly), and `featureCategoryIds`. `SteamEnrichmentService.enrichApps` batches `IStoreBrowseService/GetItems` at 50 ids/call, skips items where `success !== 1` (delisted / region-blocked / hidden), and upserts via a single transaction per app. `SteamEnrichmentPoller`: monthly cron at `30 4 1 * *` Europe/Brussels (30 min after the daily owned-games poll so the windows never overlap), boot backfill of unenriched rows via `OnModuleInit` (self-healing — re-deploys are no-ops once every owned appid has a row), plus on-add coverage triggered from the `syncOwnedGames` diff in `owned-games.service.ts` (newly-owned apps enrich within the same sync tick, no monthly-cron lag). Image helpers (`steamCapsuleUrl`, `steamLibraryHeroUrl`, `steamLibraryCapsuleUrl`) accept the hashed path + `assetTimestamp` and compose the content-addressed CDN URL via `composeSrc` (host `shared.akamai.steamstatic.com/store_item_assets/steam/apps/<appid>/<hashedPath>?t=<timestamp>`), falling through to the legacy unhashed filename when enrichment hasn't resolved. wsrv source is URL-encoded to keep the `?t=` intact end-to-end — previously-unencoded cache entries take a one-time miss. Library controls gained a type filter (All types / Games / Tools, defaults to Games per `8074fc3`; unenriched rows treated as Games to avoid them disappearing between owned-sync and enrichment) and a tag filter popover with searchable list, OR-match within the selected set, frequency floor of 3 across owned games, selected-tags pinned to top. Global tag catalog backed by new `SteamTag` table + monthly `GetTagList` poller (`6035fbb`); `GET /steam/tags` returns id/name pairs with `lastSyncedAt`. Tile hover polish (`e50ce5d` + `d88093b` + `be00325`): anchored sheen via registered `@property --sheen-extent` for smooth gradient-stop interpolation (the bright corner stays pinned; only the transparent end-stop animates inward — no edge translated across the card), 3D tilt on hover using `perspective(700px) rotateX(7deg) rotateY(-9deg) scale(1.02)` with `transform-origin: top` so the bottom-right lifts toward the viewer, downward-offset shadow grows on hover. Logo-asset gap resolved per outcome (c) from the risk note — `IStoreBrowseService/GetItems` doesn't expose a `logo` key, so `steamLibraryLogoUrl` stays on the unhashed `logo.png` path. Genre-granularity decision: surfaced `tagIds` as the user-visible filter axis (community tags as the genre proxy), skipped `genres`/`categories` (genres aren't returned by GetItems; categories are mostly feature-flags). `featureCategoryIds` persisted but not yet surfaced — reserved for a later feature-flag filter (single-player, achievements, cloud save) if it earns its keep.

**Risks / open questions:**

- `IStoreBrowseService/GetItems` stability — Valve-published Web API, more stable than `appdetails`. Backstop is still appdetails for genres if Valve narrows GetItems scope, but the assets specifically only come from GetItems.
- Logo-asset gap — see above. Investigate at chunk-start whether there's an authenticated/community-CDN path for the wordmark, or whether Steam composes it differently. Worst case: drop the logo overlay in favor of the title-text-on-gradient pattern we already use as the fallback.
- Cache busting — the `asset_url_format` returned by GetItems includes a `?t={timestamp}` query that changes when the publisher updates art. Storing the timestamp alongside the hash lets us refresh selectively when the timestamp moves.
- Genre granularity. Steam exposes three levels via the same response: `genres` (coarse, e.g., "Action"), `categories` (feature-level, e.g., "Single-player"), and `tags` (community). Decide at scope-time which to surface — likely genres + a curated tag subset; categories are mostly feature-flags, not browse axes.
- Asset pipeline pressure — capsules cap at ~600×900 across ~200 titles. Reasonable trigger to validate the runtime image proxy decision against capsule scale. Cross-link to [lol-image-pipeline.md Phase 4](lol-image-pipeline.md#phase-4--runtime-image-proxy-planned-multi-stream).

**Coupling with the runtime image proxy** ([lol-image-pipeline.md Phase 4](lol-image-pipeline.md#phase-4--runtime-image-proxy-planned-multi-stream)). Chunk 2's hashed-asset enrichment is the data Phase 4's proxy needs to resolve canonical Steam image URLs. Once Chunk 2 lands and the hash columns are populated, Phase 4's Steam-side resolver reads from this enrichment table instead of looking up `appdetails` on every cache miss. That answers Phase 4's open question on `appdetails` rate-limit mitigation: the resolver doesn't need to memoize appid → versioned-URL itself, because Chunk 2 already persists the canonical hashed paths from `IStoreBrowseService/GetItems`. Sequencing options when both are due to ship: (a) ship Chunk 2 first with URL helpers still rewriting unhashed paths client-side — image quality lifts immediately, proxy lands later as an optimization; (b) ship them together as a paired arc where Chunk 2 lands the data and Phase 4's Steam consumer reads it directly, skipping the intermediate client-side URL-helper update. Decide at scope-time based on the state of [hosting.md](hosting.md) — option (b) is only attractive once the Hetzner VPS + Nginx topology is live.

### Phase S5 — Achievement surfaces MVP

`/steam/game/:appid` achievement panel, recent-unlocks strip on Profile, completion verdict `ConclusionCard` per game. First user-facing achievement work — lands the spine.

### Phase S6 — Achievement signature surfaces

Rarity-weighted score, time-to-100%, hidden-unlock reveal, stuck-at-X / abandoned-at-X mirrors. Per-game `ConclusionCard` expansion.

### Phase S7 — Temporal + cross-stream

Cross-game unlock heatmap, per-game timeline, LoL-vs-Steam evening split (uses S4 achievement-anchor reconstruction), weekly gaming-total bento card, session-length distribution. The cross-stream payoff lands here.

### Phase S8 — Yearly + career-narrative

Your year in achievements, 100%'d games hall, cross-stream yearly hero. Folds Steam into the existing yearly-recap engine.

S2 and S3 are independently shippable warm-ups; S4 is foundational; S5–S8 build on S4. S4.6 is independent of the achievement arc and can land in parallel with S5.

---

## Still open

- Wishlist endpoint stability — `wishlistdata/` is widely used but undocumented. Have a lightweight backstop plan if it changes.
- Hidden games. The owner can hide individual games from the public profile; those simply won't appear. No mitigation, just a known gap.
- **Steam read-side test pass.** None of the Steam read endpoints (`getLibrarySummary`, `getPlatformMix`, `getOwnedGames`, `getOwnerWishlist`) have unit tests today; the services around them (`steam-client`, `rate-limiter`, `owned-games.syncOwnedGames` via `diffOwnedGames`) do. Each individual read is thin enough that the per-chunk decision has been to defer, but the absence is now consistent across all read paths. One pass to backfill them together is the right shape — not a per-chunk drag.
- **Asset pipeline is provisional.** S3 chunk 3 (commit `e1ab677`, 2026-05-14) shipped a bundled-manifest pipeline for capsules mirroring the LoL approach. A subsequent decision the same day plans to retire both the Steam and LoL bundled pipelines in favor of a server-side image proxy with stale-while-revalidate — content-driven deploys (every wishlist add) are the smell that surfaced it. The pivot is sequenced after Steam S5; the chunk-3 bundle will be reverted as part of that arc. Tracked in [lol-image-pipeline.md Phase 4](lol-image-pipeline.md#phase-4--runtime-image-proxy-planned-multi-stream).

---

## Cross-references

- The "Cross-pollination with the Steam roadmap" subsection in [self-portrait-surfaces.md](self-portrait-surfaces.md#cross-pollination-with-the-steam-roadmap) is the parent reframe.
- [vnext-ideas.md](vnext-ideas.md) — Steam integration is implicit there as the next big arc after the documented roadmaps; this doc is the dedicated home.
- Rate-limiter and asset-pipeline approaches: reuse the patterns from existing case studies (`riot-rate-limits`, `build-time-champion-assets`).
