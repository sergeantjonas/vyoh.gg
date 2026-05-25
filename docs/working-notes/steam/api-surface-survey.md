# Steam Web API surface survey — beyond `GetItems`

**Status:** Active — research session 2026-05-24, follow-up to the [library-card-enrichment.md](./library-card-enrichment.md) `GetItems` harvest. That note covered everything `IStoreBrowseService/GetItems` returns; this one inventories **the rest of the Steam Web API surface** for hidden gems we haven't wired yet.

Already wired ([steam-client.service.ts](../../../apps/api/src/steam/steam-client.service.ts)):

- `ISteamUser/GetPlayerSummaries`
- `IPlayerService/GetProfileItemsEquipped`
- `IPlayerService/GetOwnedGames`
- `IPlayerService/GetRecentlyPlayedGames`
- `IPlayerService/GetGameAchievements`
- `ISteamUserStats/GetPlayerAchievements`
- `ISteamUserStats/GetGlobalAchievementPercentagesForApp`
- `IStoreBrowseService/GetItems`
- `IWishlistService/GetWishlist`

(`store.steampowered.com/api/appdetails` was the screenshot source under the legacy lazy-fetch design — sunset 2026-05-25 by [library-card-enrichment.md Chunk 9c](./library-card-enrichment.md) when `IStoreBrowseService/GetItems`'s `screenshots` block was confirmed to cover the same data. No code now hits appdetails.)

Everything below is **not yet wired**. Triaged into chunks the same way as [library-card-enrichment.md](./library-card-enrichment.md) — each lands in the matching destination note rather than this one.

---

## Chunks at a glance

| # | Endpoint family | What it adds | Lands in | Status |
|---|---|---|---|---|
| A1 | `IPlayerService/GetSteamLevel` + `GetBadges` + `GetFavoriteBadge` | Steam level chip, badge XP / count, pinned badge | [quick-wins.md](../cross-cutting/quick-wins.md) | Planned |
| A2 | `ISteamUserStats/GetUserStatsForGame` | Per-game custom stats (kills, distance, time-of-day) — far richer than achievement booleans | this note (Chunk A2 below) | Planned |
| A3 | `IPlayerService/GetTopAchievementsForGames` | Pre-computed rarest 3 achievements per appid — avoids the join we'd otherwise need against global percent + player percent | this note (Chunk A3 below) | Planned |
| A4 | `IGameNotesService/GetGameNotes` (+ `GetAllGameNotes`) | Owner's personal in-Steam notes per game — perfect editorial content for portfolio game-detail pages if any exist | this note (Chunk A4 below) | Planned — probe first |
| A5 | `IUserCustomization/GetCustomizationsForUser` | Profile showcases (featured games, achievement showcase, screenshot showcase, workshop showcase, group showcase) — owner-curated lists Steam already exposes publicly | this note (Chunk A5 below) | Planned |
| A6 | `IPlayerService/GetAnimatedAvatar` + `GetMiniProfileBackground` + `GetProfileBackground` | Animated avatar + profile background frames for the planned live-presence chip in nav | [elevation-arcs.md](../cross-cutting/elevation-arcs.md) → live-presence-chip | Backlogged |
| A7 | `ISteamNews/GetNewsForApp` | Latest news / patch notes per owned game — context on `/steam/game/$appid` ("Patch notes from 3 days ago") | this note (Chunk A7 below) | Backlogged |
| A8 | `IStoreTopSellersService/GetWeeklyTopSellers` | "X of your library appears on this week's top sellers" cross-stream synthesis | [steam-integration.md candidate board](./steam-integration.md) | Backlogged |
| A9 | `IInventoryService/GetInventory` (per-appid: CS2 730, TF2 440, Dota 2 570) | Public inventory — only interesting if owner has notable items | parked — see § "Inventory parked" | Parked |
| A10 | `IPlayerService/IsPlayingSharedGame` | Detects when current-session game is family-shared | parked — orthogonal | Parked |
| A11 | `IStoreQueryService/Query` | Generic store-browse with filter DSL | parked — no portfolio angle | Parked |
| A12 | `IPlayerService/GetCommunityBadgeProgress` | Steam Community / Pillar of Community badge quest progress | parked — too granular | Parked |

---

## Chunk A1 — Steam level + badges chips

**Endpoints (all owner-`steamid`-scoped, public, no extra auth):**

- `IPlayerService/GetSteamLevel/v1/?steamid={id}` → `{response: {player_level: int}}`. Single int.
- `IPlayerService/GetBadges/v1/?steamid={id}` → `{response: {badges: [...], player_xp, player_level, player_xp_needed_to_level_up, player_xp_needed_current_level}}`. Per-badge: `{badgeid, level, completion_time, xp, scarcity, appid?, communityitemid?, border_color?}`.
- `IPlayerService/GetFavoriteBadge/v1/?steamid={id}` → owner's pinned badge id.

**Render targets:**

- Chip on `/status` and `/steam` header: `Lv 47 · 12,340 XP · 312 / 800 to next` (the XP progress is already public).
- Pinned badge with its art on the `/status` "who I am" block. Pairs with the existing `GetProfileItemsEquipped` cosmetic loadout that's already wired.
- Badge *count* (foil, event, game-specific) as a one-line stat — signals account age at a glance more than level alone does (a Lv 47 with 200 badges reads very differently to a Lv 47 with 8).

**Why valuable for portfolio framing:** account-age + investment signal in one chip. Recruiters scanning `/status` get "real Steam account that's been used for a decade" instantly. Cheap implementation; data is small and rarely changes (cache aggressively — daily refresh is fine).

**Data shape:** new `SteamPlayerLevel` row keyed on `steamId`: `{level Int, xp Int, xpCurrentLevel Int, xpToNextLevel Int, badgeCount Int, favoriteBadgeId Int?, refreshedAt DateTime}`. Badges themselves don't need persistence unless we render the full grid — start without and revisit if a "badge grid" surface lands.

**Atomic:** one commit. Filed in [quick-wins.md § Small feature](../cross-cutting/quick-wins.md#small-feature).

---

## Chunk A2 — Per-game custom user stats

**Endpoint:** `ISteamUserStats/GetUserStatsForGame/v0002/?key=...&steamid={id}&appid={id}` → `{playerstats: {steamID, gameName, stats: [{name, value}], achievements: [{name, achieved}]}}`.

**What `stats[]` actually contains:** publisher-defined counters and floats, *not* a standardised schema. Examples:
- TF2: per-class kills, weapon-specific kills, time played per class, points scored.
- CS2: total kills, headshot accuracy, distance moved, money earned, MVPs.
- L4D2: zombies killed, headshots, melee kills, special-infected kills.
- Many single-player games: hours played in specific mode, items collected, deaths, distance travelled.

The schema for each stat is the per-game `GetSchemaForGame.stats[]` block ([types.ts:205](../../../apps/api/src/steam/types.ts#L205) already references this) — `displayName` + `name` + `defaultValue`. We're already adjacent to this data.

**Render targets:**

- `/steam/game/$appid` gets a "Career stats" panel for games that expose them. Compact key-value list with `displayName` from schema, value formatted by heuristic (numbers > 1000 get k/M abbrev, sub-1.0 floats get `%` formatting, etc.).
- The most striking single stat per game (highest absolute count, or one matching a heuristic like `kills` / `headshots` / `wins`) becomes a chip on the library card. "CS2 · 21,403 kills" reads much harder than "127 h played".

**Why this is a hidden gem:** turns the game-detail page from a generic "name + playtime + achievements" stub into a real career-stats surface for the games where it matters. Achievement panels are binary (got it / didn't); stats panels are quantitative.

**Cost:** one extra request per appid per refresh, gated on "does the schema have stats". Skip games with empty `stats: []` to avoid wasting calls.

**Data shape:** `SteamGameUserStats` row keyed `(steamId, appid)` with `stats Json` (array of `{name, value, displayName}`). Refresh weekly — these change slowly per-game.

**Atomic:** one commit, but bigger than A1 — schema migration + endpoint wiring + new `/steam/game/$appid` panel + tests. Filed here.

---

## Chunk A3 — Top achievements per game (rarest)

**Endpoint:** `IPlayerService/GetTopAchievementsForGames/v1/?steamid={id}&language=english&appids[0]=...&max_achievements=3` → for each appid, returns the top N rarest achievements the **player has earned** with their global percent and unlock timestamp.

**Why it's a gem:** today, surfacing "rarest achievement I have on this game" requires three joins (`GetPlayerAchievements` ∩ `GetGlobalAchievementPercentagesForApp`, then sort by percent asc, then attach schema name + icon). This endpoint does it server-side and is paginated by `appids[]` so we can fetch dozens per call.

**Render target:** `/steam/game/$appid` achievement panel gets a "Rarest you have" pill (e.g. `Beat the game on Hardcore · 1.2% of players`). On the library card, an optional flair when `min(global_percent) < 5%`: a small trophy chip with the percent.

**Data shape:** `SteamGameTopAchievements` row `(steamId, appid)` with `topAchievements Json` (array of `{name, displayName, description, iconUrl, globalPercent, unlockedAt}`).

**Cost:** one request returns multiple appids — much cheaper than the per-appid join we'd otherwise wire.

**Decision pending:** does this fold into the existing achievement panel build, or land as its own chunk? Probably folds — flag a TODO in the achievement-panel work to switch to this endpoint when it lands.

**Atomic:** one commit. Filed here; cross-link when the achievement panel chunk picks it up.

---

## Chunk A4 — Owner's in-Steam game notes (probe first)

**Endpoint (relatively new — late-2024 Steam feature):** `IGameNotesService/GetGameNotes/v1/?key=...&steamid={id}&appid={id}` and `IGameNotesService/GetAllGameNotes/v1/?key=...&steamid={id}`.

**What it returns:** the user's personal notes attached to a game inside the Steam client (the "Notes" tab on each library entry). Body is markdown-ish with Steam's BBCode dialect. If the owner has been taking notes on builds, strategies, save-file annotations, or playthrough thoughts, this is *gold* for portfolio framing — it's editorial content the owner has already written.

**Why probe first:** the value is entirely conditional on whether the owner has any notes. If `GetAllGameNotes` returns an empty list, this chunk is moot — file a follow-up to revisit when notes accumulate. If it returns content, this becomes a major chunk: render notes inline on `/steam/game/$appid`, link "games I've taken notes on" as a palette query.

**Trust boundary:** owner-authored content, sanitise the same way as [Chunk 8 — full description BBCode](./library-card-enrichment.md#chunk-8--full-description-on-game-detail-page) (the BBCode → HTML pipeline that chunk introduces is the natural reuse target).

**Privacy consideration:** game notes are private by default — Steam's IGameNotesService requires the owner's API key (which we already have). Make sure rendered notes are gated on a "show personal notes" toggle if owner-auth bypass isn't already the default for this view — owner may want some notes excluded from the public portfolio render. A `hidden: boolean` per-note metadata column for owner-controlled visibility, default visible.

**Data shape:** `SteamGameNote` row `(steamId, appid)` with `noteBbcode String`, `updatedAt DateTime`, `hidden Boolean @default(false)`.

**Atomic:** probe → decision → chunk. Probe is the first action; if empty, file as parked here.

---

## Chunk A5 — Profile showcases

**Endpoint:** `IUserCustomization/GetCustomizationsForUser/v1/?steamid={id}` → array of showcase objects. Each showcase is one of: `featured_game`, `achievement_showcase`, `screenshot_showcase`, `workshop_showcase`, `group_showcase`, `recent_activity_showcase`, `items_showcase`, plus newer ones (artwork, video, custom-info, completionist).

**What's in each:** publisher-style structured data (appids + slot order for featured games, achievement ids for achievement showcase, screenshot urls for screenshot showcase, etc.). The owner has already curated these in their Steam profile — Steam exposes them publicly via this endpoint.

**Render target:** mirror the showcases on `/status` (the synthesis page) and a "Featured by me" rail on `/steam`. Owner-curated means zero editorial work — Steam's profile is already the curated cut.

**Why valuable:** showcases are *the* "this is what I want people to see" surface on Steam profiles. Mirroring them on the portfolio site keeps the curation single-source (owner updates Steam profile → portfolio reflects) and avoids parallel "what to feature" decisions.

**Cost:** one request per refresh; small payload; daily refresh is plenty.

**Data shape:** `SteamProfileShowcases` keyed on `steamId` with `showcases Json` (the raw array). Render-side type-narrows per-showcase kind.

**Atomic:** one commit. Filed here.

---

## Chunk A6 — Animated avatar + profile background (live-presence chip)

**Endpoints:**

- `IPlayerService/GetAnimatedAvatar/v1/?steamid={id}` → avatar movie URL (.webm).
- `IPlayerService/GetProfileBackground/v1/?steamid={id}` → profile-background image / movie URL.
- `IPlayerService/GetMiniProfileBackground/v1/?steamid={id}` → mini-profile background.

**Lands in:** the planned [elevation-arcs.md](../cross-cutting/elevation-arcs.md) → `live-presence-chip` arc (Tier 3). The animated avatar is the natural visual for the "Currently playing X" nav chip, and the profile background is the natural backdrop layer for a `/status` hero variant.

**Why deferred:** depends on live-presence-chip landing first. Filed here for breadcrumb; when that arc picks up, this is the data source.

---

## Chunk A7 — Game news feed

**Endpoint:** `ISteamNews/GetNewsForApp/v2/?appid={id}&count=5&maxlength=300` → recent news items per game (patch notes, dev blogs, event announcements).

**Render target:** `/steam/game/$appid` gets a "Recent news" rail — last 3 items, title + date + abbreviated body, link out to the full announcement. Cheap discoverability for games the owner hasn't played in a while ("Stardew Valley posted a patch yesterday").

**Cost:** one request per appid per refresh. Cache aggressively — daily is plenty for a game-detail surface.

**Decision pending:** is this portfolio-grade or storefront-grade? Leaning storefront — it's useful but doesn't tell the owner's story. Backlogged in the table above; revisit if `/steam/game/$appid` feels sparse after the higher-priority chunks land.

**Atomic:** one commit. Filed here when picked up.

---

## Chunks A8-A12 (backlogged / parked)

### A8 — Weekly top sellers cross-reference

`IStoreTopSellersService/GetWeeklyTopSellers/v1/` returns the public top-sellers list. Cross-referencing against the owner's library lets us surface "3 of this week's top sellers are in your library — you played [game] yesterday" as a small synthesis chip on `/`. Storefront-grade but novel; filed in the [steam-integration.md candidate board](./steam-integration.md).

### A9 — Inventory parked

`IInventoryService/GetInventory` per-appid. Only meaningful for CS2 (730), TF2 (440), Dota 2 (570). If owner has notable inventory it could be a "stuff I own" surface — but probe first; parked until owner indicates this is interesting.

### A10 — Family-share detection parked

`IPlayerService/IsPlayingSharedGame` only returns useful data while a session is *active*. Orthogonal to the portfolio framing; parked.

### A11 — Generic store query parked

`IStoreQueryService/Query` is a powerful storefront-browse DSL but has no obvious portfolio angle. Parked.

### A12 — Badge progress parked

`IPlayerService/GetCommunityBadgeProgress` returns per-quest progress for the Steam Community badges. Too granular for a chip; the level + badge-count chip from Chunk A1 captures the headline signal.

---

## Cross-cutting notes

- **Rate limit budget.** All these endpoints share the same Steam Web API key + the Bottleneck limiter already wired for the existing endpoints. Most are single-shot (level, badges, showcases, customisations) rather than per-game fan-outs — net new request volume is small except for A2 / A3 (per-game scans, but cheap with batching where supported).
- **Refresh cadence.** Level / badges / showcases / customisations rarely change — daily refresh is plenty. Per-game stats (A2) and rarest achievements (A3) move on playtime — weekly or "refresh on session-end" works. News (A7) is the only one that really benefits from sub-daily refresh.
- **Persistence shape.** Default to one new row per `steamId` for owner-level data (A1, A5, A6, A12 if revived) and one row per `(steamId, appid)` for per-game data (A2, A3, A4, A7). Mirrors the existing `SteamGameEnrichment` shape.
- **Probe before chunk.** A4 (game notes) and A9 (inventory) are both "value depends entirely on whether the owner has content there" — probe with a one-off call before committing to a chunk plan.

---

## How to use this note

- Same lifecycle as [library-card-enrichment.md](./library-card-enrichment.md): each row's chunk lands in its destination note, flips to ✅ shipped `<date>` here when done.
- Chunks A1 / A2 / A3 / A5 are the highest-leverage and should land before A6-A8 (which are either deferred or dependent on other arcs).
- A4 requires a probe call before chunk planning — first action when picked up is "does `GetAllGameNotes` return anything for the owner".
- The parked chunks (A9-A12) shouldn't be re-litigated without a new signal (e.g. owner indicates inventory is interesting, or a use-case for shared-game detection emerges).
