import { Injectable } from "@nestjs/common";
import type { SteamSummary, SteamWishlist, SteamWishlistItem } from "@vyoh/shared";
import { SteamClientService } from "./steam-client.service";
import { STEAM_OWNER_ID } from "./steam.config";
import type { SteamPlayerRaw, SteamStoreItemRaw, SteamWishlistItemRaw } from "./types";

const WISHLIST_TTL_MS = 60 * 60 * 1_000;
const NAME_TTL_MS = 24 * 60 * 60 * 1_000;
const STORE_ITEMS_BATCH = 100;

interface CachedWishlist {
  items: SteamWishlistItemRaw[];
  fetchedAt: number;
}

interface CachedName {
  name: string | null;
  storeUrlPath: string | null;
  fetchedAt: number;
}

const PERSONA_STATE: Record<
  SteamPlayerRaw["personastate"],
  SteamSummary["personaState"]
> = {
  0: "offline",
  1: "online",
  2: "busy",
  3: "away",
  4: "snooze",
  5: "looking-to-trade",
  6: "looking-to-play",
};

@Injectable()
export class SteamService {
  // In-memory TTL caches. S2 is a one-chunk warmup — no DB schema, no scheduler.
  // S3 (owned-games polling) is the right place to evolve into persisted state.
  private wishlistCache: CachedWishlist | null = null;
  private readonly nameCache = new Map<number, CachedName>();

  // Overridable for tests so we can assert cache behaviour without fake timers.
  wishlistTtlMs: number = WISHLIST_TTL_MS;
  nameTtlMs: number = NAME_TTL_MS;

  constructor(private readonly client: SteamClientService) {}

  async getOwnerSummary(): Promise<SteamSummary> {
    const player = await this.client.getPlayerSummary(STEAM_OWNER_ID);
    if (!player) {
      // GetPlayerSummaries returns an empty players array only when the SteamID
      // does not resolve at all — wrong ID, deleted account. Distinct from
      // privacy-locked, which still returns a player with communityvisibilitystate < 3.
      throw new Error(`Steam profile not found for owner id ${STEAM_OWNER_ID}`);
    }
    return mapPlayerToSummary(player);
  }

  async getOwnerWishlist(): Promise<SteamWishlist> {
    const now = Date.now();
    const raw = await this.loadWishlist(now);
    const names = await this.resolveNames(
      raw.map((item) => item.appid),
      now
    );

    const items: SteamWishlistItem[] = raw.map((row) => {
      const resolved = names.get(row.appid);
      return {
        appid: row.appid,
        name: resolved?.name ?? null,
        dateAdded: row.date_added,
        priority: row.priority,
        storeUrl: buildStoreUrl(row.appid, resolved?.storeUrlPath ?? null),
      };
    });

    return {
      steamId: STEAM_OWNER_ID,
      items,
      fetchedAt: this.wishlistCache?.fetchedAt ?? now,
    };
  }

  private async loadWishlist(now: number): Promise<SteamWishlistItemRaw[]> {
    if (this.wishlistCache && now - this.wishlistCache.fetchedAt < this.wishlistTtlMs) {
      return this.wishlistCache.items;
    }
    const items = await this.client.getWishlist(STEAM_OWNER_ID);
    this.wishlistCache = { items, fetchedAt: now };
    return items;
  }

  private async resolveNames(
    appids: number[],
    now: number
  ): Promise<Map<number, CachedName>> {
    const stale: number[] = [];
    for (const appid of appids) {
      const hit = this.nameCache.get(appid);
      if (!hit || now - hit.fetchedAt >= this.nameTtlMs) {
        stale.push(appid);
      }
    }

    for (let i = 0; i < stale.length; i += STORE_ITEMS_BATCH) {
      const batch = stale.slice(i, i + STORE_ITEMS_BATCH);
      const fetched = await this.client.getStoreItems(batch);
      const seen = new Set<number>();
      for (const row of fetched) {
        seen.add(row.appid);
        this.nameCache.set(row.appid, storeItemToCacheEntry(row, now));
      }
      // GetItems silently omits unresolvable appids; cache the miss so we don't
      // retry every request until the TTL elapses.
      for (const appid of batch) {
        if (!seen.has(appid)) {
          this.nameCache.set(appid, {
            name: null,
            storeUrlPath: null,
            fetchedAt: now,
          });
        }
      }
    }

    const out = new Map<number, CachedName>();
    for (const appid of appids) {
      const hit = this.nameCache.get(appid);
      if (hit) out.set(appid, hit);
    }
    return out;
  }
}

function storeItemToCacheEntry(row: SteamStoreItemRaw, now: number): CachedName {
  const resolved = row.success === 1 && row.name ? row.name : null;
  return {
    name: resolved,
    storeUrlPath: row.store_url_path ?? null,
    fetchedAt: now,
  };
}

function buildStoreUrl(appid: number, storeUrlPath: string | null): string {
  if (storeUrlPath) return `https://store.steampowered.com/${storeUrlPath}/`;
  return `https://store.steampowered.com/app/${appid}/`;
}

function mapPlayerToSummary(player: SteamPlayerRaw): SteamSummary {
  const profilePublic = player.communityvisibilitystate === 3;
  // Game-details visibility can't be verified from GetPlayerSummaries — that
  // probe requires GetOwnedGames, which lands in S3. Surface "unknown" rather
  // than guessing so the frontend can render honest copy.
  const currentGame =
    player.gameid !== undefined
      ? { appid: Number(player.gameid), name: player.gameextrainfo ?? "" }
      : null;

  return {
    steamId: player.steamid,
    personaName: player.personaname,
    profileUrl: player.profileurl,
    avatarUrl: player.avatarfull,
    personaState: PERSONA_STATE[player.personastate],
    currentGame,
    privacyPrereqs: {
      profilePublic,
      gameDetailsPublic: "unknown",
    },
  };
}
