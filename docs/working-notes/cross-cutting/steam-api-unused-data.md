# Steam Web API — unused / discarded data

**Status:** Reference — audit of Steam Web API fields we can reach with the current `STEAM_API_KEY` but **do not surface today**. Captured 2026-05-30 during the Steam-profile-parity scoping (nav-condensation arc 1.3a Steam portion). Probed live against the owner account (`76561198020053778`) with our key; every value below is a real response, not a guess.

**Why this exists:** a codebase-only data map (subagent reading our types/hooks) wrongly reported `timecreated`, Steam level, and total playtime as "not available". Probing the real API disproved all three. This note records what's actually reachable so future Steam work doesn't re-derive it — and doesn't trust the old "not available" verdicts.

**How to re-probe:** key is `STEAM_API_KEY` in `apps/api/.env`; owner id `76561198020053778`. Hit `https://api.steampowered.com/<iface>/<method>/v1/?key=…&steamid=…`. A throwaway script pattern lived at `/tmp/steam_probe.py` during the audit.

---

## In scope now (nav-condensation arc 1.3a — Steam hero)

These are being wired as **Chunk 0 (data gate)** of the Steam identity hero:

| Field | Live value | Source | Cost |
|---|---|---|---|
| `timecreated` (member since) | `1263864425` → **2010-01-19** | already on `GetPlayerSummaries` (we fetch this every poll) | **free** — just stop discarding it in `mapPlayerToSummary` ([steam.service.ts](../../../apps/api/src/steam/steam.service.ts), [types.ts `SteamPlayerRaw`](../../../apps/api/src/steam/types.ts)) |
| Steam level | **14** | `IPlayerService/GetSteamLevel/v1` | +1 endpoint (32-byte response), new `getSteamLevel` client method |
| Level percentile | **higher than 94.66% of accounts** ("top ~5%") | `IPlayerService/GetSteamLevelDistribution/v1?player_level=14` | +1 endpoint, no per-user privacy (takes a level int, not a steamid) |

Hero headline target: **"Member since 2010 · Level 14 · top 5%"** — the honest rank-parallel to LoL's tier line.

---

## Discovered, NOT yet scoped (pick up later)

### A — Owned-games aggregate we already fetch but never surface

We pull `GetOwnedGames` daily (04:00 Brussels poller) and use it for the library + most-played, but the **collection-level totals are discarded**:

- `game_count` = **175 owned**
- summed `playtime_forever` = **~2,860 h total**
- **only 72 games ever played (41%)** — i.e. a 59% backlog

**Why it matters:** this is the Steam equivalent of LoL's W/L performance data — a real "who you are as a Steam player" story (collector / backlog / completionist). **Zero new requests** — it's already in the response we pull daily; just needs aggregation + a shared field. Natural fit for the Steam hero **stat band (Chunk 2)** and/or a profile chip.

### B — Recent 2-week activity (we fetch, then throw away the playtime)

`GetRecentlyPlayedGames` is already called by the unlock backstop poller ([recently-played-unlocks.poller.ts](../../../apps/api/src/steam/recently-played-unlocks.poller.ts)), but we only use it to catch missed unlocks — the **`playtime_2weeks` per game is discarded**. Live sample: `total_count=2` (Resident Evil 4 = 2.1h/2wk, Wallpaper Engine). This is a live "what I've actually been playing lately" signal — distinct from "now playing" (live) and "most played" (lifetime). Candidate for a profile "recent activity" surface.

### C — Badges / XP

`IPlayerService/GetBadges/v1` returns in one call: `player_level` (14), `player_xp` (1904), `player_xp_needed_to_level_up` (96), and the **badge list** (9 badges, each with appid/level/xp/completion_time). If a "collector" surface ever wants XP-progress-to-next-level or a badge showcase, this single endpoint covers it (and would replace the separate `GetSteamLevel` call, since it returns level too). Not needed for the hero (level alone + percentile suffices).

### D — Profile cosmetics we partially use

`GetProfileItemsEquipped` is wired (animated avatar + profile background). Three sibling endpoints exist and return data but are **unused**: `GetAvatarFrame` (equipped avatar frame), `GetMiniProfileBackground`, `GetAnimatedAvatar` (standalone). The avatar frame in particular could ring the hero avatar like LoL's rank border. Low priority — marginal vs the avatar+background we already render.

---

## Confirmed dead ends (do NOT re-scope)

- **`timecreated` is NOT "unavailable"** — the earlier codebase-only map was wrong. It's on every `GetPlayerSummaries` response; we discard it. (Recorded here so the false negative doesn't resurface.)
- **`GetFriendList` → HTTP 401** even with our key — the owner's friend list is privacy-locked. No friend-count "social proof" surface is possible without the owner changing Steam privacy. Skip.
- **`GetUserGroupList` → empty** (`success` with zero groups). Nothing to surface.
- **`GetPlayerBans`** → VAC-clean / no bans. Only interesting if dirty; not worth a surface.
- **Total lifetime playtime as a single API field** — does NOT exist; must be summed from `GetOwnedGames` per-game `playtime_forever` (see item A). The sum is reachable; there's just no one-field shortcut.

---

## Cross-references

- [nav-condensation-arc.md](nav-condensation-arc.md) — chunk 1.3a Steam portion (the hero this audit feeds).
- [steam-lol-parity.md](steam-lol-parity.md) — the broader Steam↔LoL parity audit trail.
