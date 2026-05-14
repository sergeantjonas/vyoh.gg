import { Injectable, Logger } from "@nestjs/common";
import { requireEnv } from "../env";
import { SteamRateLimiterService } from "./rate-limiter.service";
import type {
  SteamGetOwnedGamesResponse,
  SteamGetPlayerSummariesResponse,
  SteamGetStoreItemsResponse,
  SteamGetWishlistResponse,
  SteamOwnedGameRaw,
  SteamPlayerRaw,
  SteamStoreItemRaw,
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

  async getStoreItems(appids: number[]): Promise<SteamStoreItemRaw[]> {
    if (appids.length === 0) return [];
    return this.limiter.schedule("store-items", async () => {
      const input = {
        ids: appids.map((appid) => ({ appid })),
        context: { language: "english", country_code: "US" },
        data_request: { include_basic_info: false },
      };
      const path = `/IStoreBrowseService/GetItems/v1/?key=${encodeURIComponent(this.apiKey)}&input_json=${encodeURIComponent(JSON.stringify(input))}`;
      const data = await this.fetchJson<SteamGetStoreItemsResponse>(path);
      return data.response.store_items ?? [];
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
