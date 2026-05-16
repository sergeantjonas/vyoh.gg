import { Injectable, Logger } from "@nestjs/common";
import { requireEnv } from "../env";
import { SteamRateLimiterService } from "./rate-limiter.service";
import type {
  SteamGameAchievementSchema,
  SteamGetGameAchievementsResponse,
  SteamGetGlobalAchievementPercentagesResponse,
  SteamGetOwnedGamesResponse,
  SteamGetPlayerAchievementsResponse,
  SteamGetPlayerSummariesResponse,
  SteamGetProfileItemsEquippedResponse,
  SteamGetRecentlyPlayedGamesResponse,
  SteamGetStoreItemsFullResponse,
  SteamGetStoreItemsResponse,
  SteamGetTagListResponse,
  SteamGetWishlistResponse,
  SteamGlobalAchievementPercentageRaw,
  SteamOwnedGameRaw,
  SteamPlayerAchievementRaw,
  SteamPlayerRaw,
  SteamStoreItemFullRaw,
  SteamStoreItemRaw,
  SteamTagListItemRaw,
  SteamWishlistItemRaw,
} from "./types";

const STEAM_API_BASE = "https://api.steampowered.com";
const FETCH_TIMEOUT_MS = 10_000;

export class SteamClientError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly path: string
  ) {
    super(message);
    this.name = "SteamClientError";
  }
}

@Injectable()
export class SteamClientService {
  private readonly logger = new Logger(SteamClientService.name);
  private readonly apiKey: string;

  constructor(private readonly limiter: SteamRateLimiterService) {
    this.apiKey = requireEnv("STEAM_API_KEY");
  }

  async getPlayerSummary(steamId: string): Promise<SteamPlayerRaw | null> {
    return this.limiter.schedule("player-summaries", async () => {
      const path = `/ISteamUser/GetPlayerSummaries/v0002/?key=${encodeURIComponent(this.apiKey)}&steamids=${encodeURIComponent(steamId)}`;
      const data = await this.fetchJson<SteamGetPlayerSummariesResponse>(path);
      // Empty `players` means the SteamID didn't resolve to a public profile in a way
      // the API will surface — distinct from a 4xx error. Treat as "no data" so the
      // caller can surface a privacy verdict instead of an exception.
      return data.response.players[0] ?? null;
    });
  }

  async getProfileItemsEquipped(
    steamId: string
  ): Promise<SteamGetProfileItemsEquippedResponse["response"]> {
    return this.limiter.schedule("profile-items-equipped", async () => {
      const path = `/IPlayerService/GetProfileItemsEquipped/v1/?key=${encodeURIComponent(this.apiKey)}&steamid=${encodeURIComponent(steamId)}&language=english`;
      const data = await this.fetchJson<SteamGetProfileItemsEquippedResponse>(path);
      // Accounts with the default profile return `{ response: {} }` — distinct
      // from a 4xx. Return the bare object; the caller decides per-slot fallback.
      return data.response;
    });
  }

  async getWishlist(steamId: string): Promise<SteamWishlistItemRaw[]> {
    return this.limiter.schedule("wishlist", async () => {
      const path = `/IWishlistService/GetWishlist/v1/?key=${encodeURIComponent(this.apiKey)}&steamid=${encodeURIComponent(steamId)}`;
      const data = await this.fetchJson<SteamGetWishlistResponse>(path);
      // An owner with wishlist hidden or empty returns `{ response: {} }` — missing
      // `items` rather than `items: []`. Normalize so callers don't need to branch.
      return data.response.items ?? [];
    });
  }

  async getOwnedGames(steamId: string): Promise<SteamOwnedGameRaw[]> {
    return this.limiter.schedule("owned-games", async () => {
      const path = `/IPlayerService/GetOwnedGames/v1/?key=${encodeURIComponent(this.apiKey)}&steamid=${encodeURIComponent(steamId)}&include_appinfo=1&include_played_free_games=1`;
      const data = await this.fetchJson<SteamGetOwnedGamesResponse>(path);
      // Steam returns `{ response: {} }` when the library is private — distinct
      // from a 4xx. Treat as "no games" so the caller can persist that as an
      // empty snapshot rather than throwing.
      return data.response.games ?? [];
    });
  }

  // Recent 2-week play set. Cheap (one call, ≤10 rows) — the hourly
  // backstop poller leans on this to catch offline-play sessions the
  // session-close hook missed.
  async getRecentlyPlayedGames(steamId: string): Promise<SteamOwnedGameRaw[]> {
    return this.limiter.schedule("recently-played", async () => {
      const path = `/IPlayerService/GetRecentlyPlayedGames/v1/?key=${encodeURIComponent(this.apiKey)}&steamid=${encodeURIComponent(steamId)}`;
      const data = await this.fetchJson<SteamGetRecentlyPlayedGamesResponse>(path);
      return data.response.games ?? [];
    });
  }

  async getStoreItems(appids: number[]): Promise<SteamStoreItemRaw[]> {
    if (appids.length === 0) return [];
    return this.limiter.schedule("store-items", async () => {
      const input = {
        ids: appids.map((appid) => ({ appid })),
        context: { language: "english", country_code: "US" },
        // include_release surfaces steam_release_date + is_coming_soon — used by
        // the wishlist surface to label unreleased titles. Same endpoint, no
        // extra rate-limiter budget.
        data_request: { include_basic_info: false, include_release: true },
      };
      const path = `/IStoreBrowseService/GetItems/v1/?key=${encodeURIComponent(this.apiKey)}&input_json=${encodeURIComponent(JSON.stringify(input))}`;
      const data = await this.fetchJson<SteamGetStoreItemsResponse>(path);
      return data.response.store_items ?? [];
    });
  }

  // Enrichment-grade fetch: same endpoint as getStoreItems, but with the
  // larger `data_request` flags set so the response carries assets (hash-
  // prefixed canonical Steam asset paths + `?t=` timestamp template),
  // release date, type, and feature/tag ids. Sharing the endpoint keeps the
  // rate-limiter family unified — both calls draw from the same daily
  // reservoir, no extra Bottleneck wiring needed.
  async getStoreItemsFull(appids: number[]): Promise<SteamStoreItemFullRaw[]> {
    if (appids.length === 0) return [];
    return this.limiter.schedule("store-items", async () => {
      const input = {
        ids: appids.map((appid) => ({ appid })),
        context: { language: "english", country_code: "US" },
        data_request: {
          include_assets: true,
          include_release: true,
          include_categories: true,
          include_basic_info: false,
          // tagids isn't returned unless include_tag_count > 0. We persist
          // the top 20 in SteamGameEnrichment.tagIds; asking for more here
          // would just be discarded by projectEnrichment's MAX_TAG_IDS cap.
          include_tag_count: 20,
        },
      };
      const path = `/IStoreBrowseService/GetItems/v1/?key=${encodeURIComponent(this.apiKey)}&input_json=${encodeURIComponent(JSON.stringify(input))}`;
      const data = await this.fetchJson<SteamGetStoreItemsFullResponse>(path);
      return data.response.store_items ?? [];
    });
  }

  // Global community-tag catalog (id → name). Backs the library filter
  // popover's label resolver. Pulled monthly by SteamTagPoller — Steam adds
  // tags rarely enough that a daily refresh would be wasted budget.
  async getTagList(): Promise<SteamTagListItemRaw[]> {
    return this.limiter.schedule("tag-list", async () => {
      const path = `/IStoreService/GetTagList/v1/?key=${encodeURIComponent(this.apiKey)}&language=english`;
      const data = await this.fetchJson<SteamGetTagListResponse>(path);
      return data.response.tags ?? [];
    });
  }

  // Per-game achievement schema. Sourced from IPlayerService/GetGameAchievements
  // (newer endpoint that, unlike ISteamUserStats/GetSchemaForGame, returns the
  // real `localized_desc` for hidden achievements — the older schema endpoint
  // blanked them anti-spoiler). Returns [] when the game has no achievements
  // (CS2, demos, dedicated-launcher entries).
  //
  // Icons are composed at the boundary: the new endpoint returns filenames
  // only, the old returned absolute URLs. Downstream sees the same
  // `iconUrl`/`iconGrayUrl` shape regardless.
  async getGameAchievementSchema(appid: number): Promise<SteamGameAchievementSchema[]> {
    return this.limiter.schedule("game-schema", async () => {
      const path = `/IPlayerService/GetGameAchievements/v1/?key=${encodeURIComponent(this.apiKey)}&appid=${appid}&language=english`;
      const data = await this.fetchJson<SteamGetGameAchievementsResponse>(path);
      const rows = data.response.achievements ?? [];
      return rows.map((r) => ({
        apiName: r.internal_name,
        displayName: r.localized_name,
        description: r.localized_desc,
        iconUrl: `https://steamcdn-a.akamaihd.net/steamcommunity/public/images/apps/${appid}/${r.icon}`,
        iconGrayUrl: `https://steamcdn-a.akamaihd.net/steamcommunity/public/images/apps/${appid}/${r.icon_gray}`,
        hidden: r.hidden,
      }));
    });
  }

  // Owner's unlock state for every achievement defined in a game's schema.
  // Returns `null` when Steam reports `success: false` — the game has no
  // playerstats configured for this owner (never launched the stats subsystem,
  // library hidden, or schema-less game). Distinct from the empty-array case
  // (game has stats, owner has unlocked zero).
  async getPlayerAchievements(
    steamId: string,
    appid: number
  ): Promise<SteamPlayerAchievementRaw[] | null> {
    return this.limiter.schedule("player-achievements", async () => {
      const path = `/ISteamUserStats/GetPlayerAchievements/v1/?key=${encodeURIComponent(this.apiKey)}&steamid=${encodeURIComponent(steamId)}&appid=${appid}&l=english`;
      const data = await this.fetchJson<SteamGetPlayerAchievementsResponse>(path);
      if (!data.playerstats.success) return null;
      return data.playerstats.achievements ?? [];
    });
  }

  // Global unlock percentage per achievement. Public endpoint (no API key),
  // but routed through the same limiter for budget bookkeeping. Returns []
  // for games with no achievements.
  async getGlobalAchievementPercentages(
    appid: number
  ): Promise<SteamGlobalAchievementPercentageRaw[]> {
    return this.limiter.schedule("global-rarity", async () => {
      const path = `/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v0002/?gameid=${appid}`;
      const data =
        await this.fetchJson<SteamGetGlobalAchievementPercentagesResponse>(path);
      // Coerce `percent` from JSON string to number at the boundary. The
      // v0002 endpoint returns it as `"70.4"` despite the semantic being a
      // float; Prisma rejects strings on the `percent` Float column.
      return (data.achievementpercentages.achievements ?? []).map((a) => ({
        name: a.name,
        percent: Number(a.percent),
      }));
    });
  }

  private async fetchJson<T>(path: string): Promise<T> {
    const url = `${STEAM_API_BASE}${path}`;
    const start = performance.now();

    // Same hard-timeout race as the Riot client: Node's undici fetch occasionally
    // ignores AbortSignal on a stalled connection, leaving the Bottleneck slot
    // wedged. Racing against a timer guarantees the caller (and the limiter)
    // unblock; the socket leaks until Node's TCP layer reaps it.
    const ctrl = new AbortController();
    const timeoutErr = new Error(`fetch timeout after ${FETCH_TIMEOUT_MS}ms`);
    timeoutErr.name = "TimeoutError";
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    const hardTimeout = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        ctrl.abort(timeoutErr);
        reject(timeoutErr);
      }, FETCH_TIMEOUT_MS);
    });
    const fetchPromise = fetch(url, { signal: ctrl.signal });

    let res: Response;
    try {
      res = await Promise.race([fetchPromise, hardTimeout]);
    } catch (err) {
      const duration = Math.round(performance.now() - start);
      this.logger.warn(`steam ${path} → fetch error after ${duration}ms`);
      if (err instanceof Error && err.name === "TimeoutError") {
        throw new SteamClientError(
          `Steam Web API fetch timeout after ${FETCH_TIMEOUT_MS}ms`,
          504,
          path
        );
      }
      throw err;
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
    }

    const duration = Math.round(performance.now() - start);
    this.logger.log(`steam ${path.split("?")[0]} → ${res.status} (${duration}ms)`);

    if (!res.ok) {
      throw new SteamClientError(
        `Steam Web API ${res.status} ${res.statusText}`,
        res.status,
        path
      );
    }
    return res.json() as Promise<T>;
  }
}
