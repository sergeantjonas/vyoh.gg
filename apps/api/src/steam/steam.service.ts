import { Injectable, Logger } from "@nestjs/common";
import type { SteamSummary, SteamWishlist, SteamWishlistItem } from "@vyoh/shared";
import { SteamClientService } from "./steam-client.service";
import { STEAM_OWNER_ID } from "./steam.config";
import type {
  SteamGetProfileItemsEquippedResponse,
  SteamPlayerRaw,
  SteamStoreItemRaw,
  SteamWishlistItemRaw,
} from "./types";

// Steam community CDN base for equipped profile items. `image_large` and the
// `movie_*` fields on GetProfileItemsEquipped are already prefixed with
// `items/<appid>/...`, so this base stops at `/images/` — appending another
// `items/` produces a doubled-segment URL that 404s. Both the Cloudflare and
// Akamai subdomains resolve to the same backend.
const STEAM_COMMUNITY_ITEMS_CDN =
  "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/";

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
  // Unix seconds (UTC) when Steam has a committed release date; null otherwise.
  releaseDate: number | null;
  comingSoon: boolean;
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
  private readonly logger = new Logger(SteamService.name);

  // In-memory TTL caches. S2 is a one-chunk warmup — no DB schema, no scheduler.
  // S3 (owned-games polling) is the right place to evolve into persisted state.
  private wishlistCache: CachedWishlist | null = null;
  private readonly nameCache = new Map<number, CachedName>();

  // Overridable for tests so we can assert cache behaviour without fake timers.
  wishlistTtlMs: number = WISHLIST_TTL_MS;
  nameTtlMs: number = NAME_TTL_MS;

  constructor(private readonly client: SteamClientService) {}

  async getOwnerSummary(): Promise<SteamSummary> {
    // Fetch player + equipped items in parallel. The items call is optional —
    // a failure or empty payload leaves the cosmetic fields undefined rather
    // than blocking the summary, which is the only must-have here.
    const [player, items] = await Promise.all([
      this.client.getPlayerSummary(STEAM_OWNER_ID),
      this.client.getProfileItemsEquipped(STEAM_OWNER_ID).catch((err) => {
        this.logger.warn(
          `steam profile items fetch failed; continuing without cosmetics: ${
            err instanceof Error ? err.message : String(err)
          }`
        );
        return null;
      }),
    ]);
    if (!player) {
      // GetPlayerSummaries returns an empty players array only when the SteamID
      // does not resolve at all — wrong ID, deleted account. Distinct from
      // privacy-locked, which still returns a player with communityvisibilitystate < 3.
      throw new Error(`Steam profile not found for owner id ${STEAM_OWNER_ID}`);
    }
    return mapPlayerToSummary(player, items);
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
        releaseDate: resolved?.releaseDate ?? null,
        comingSoon: resolved?.comingSoon ?? false,
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
            releaseDate: null,
            comingSoon: false,
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
  // `steam_release_date` is absent for unreleased titles without a published
  // date, and zero on some legacy rows; both map to null. `is_coming_soon`
  // defaults to false when omitted — Steam only sets it on titles still
  // labelled "Coming soon" in the store.
  const rawDate = row.release?.steam_release_date;
  const releaseDate = typeof rawDate === "number" && rawDate > 0 ? rawDate : null;
  return {
    name: resolved,
    storeUrlPath: row.store_url_path ?? null,
    releaseDate,
    comingSoon: row.release?.is_coming_soon === true,
    fetchedAt: now,
  };
}

function buildStoreUrl(appid: number, storeUrlPath: string | null): string {
  if (storeUrlPath) return `https://store.steampowered.com/${storeUrlPath}/`;
  return `https://store.steampowered.com/app/${appid}/`;
}

function mapPlayerToSummary(
  player: SteamPlayerRaw,
  items: SteamGetProfileItemsEquippedResponse["response"] | null
): SteamSummary {
  const profilePublic = player.communityvisibilitystate === 3;
  // Game-details visibility can't be verified from GetPlayerSummaries — that
  // probe requires GetOwnedGames, which lands in S3. Surface "unknown" rather
  // than guessing so the frontend can render honest copy.
  const currentGame =
    player.gameid !== undefined
      ? { appid: Number(player.gameid), name: player.gameextrainfo ?? "" }
      : null;

  // Steam serves animated avatars as a .gif at `image_small` (the name refers
  // to display size, not file size — image_small is the canonical animated form,
  // image_large is the static jpg fallback for clients that can't render the gif).
  const animatedAvatarPath =
    items?.animated_avatar?.image_small ?? items?.animated_avatar?.image_large;
  // Backgrounds may have both a static jpg (`image_large`) and an animated video
  // (`movie_webm`/`movie_mp4`). We expose both and let the frontend decide —
  // animated backgrounds are bandwidth-heavy on every page load. Prefer webm for
  // the video (smaller encodes; mp4 covers Safari fallback per the same logic).
  const backgroundPath = items?.profile_background?.image_large;
  const backgroundVideoPath =
    items?.profile_background?.movie_webm ?? items?.profile_background?.movie_mp4;

  return {
    steamId: player.steamid,
    personaName: player.personaname,
    profileUrl: player.profileurl,
    avatarUrl: player.avatarfull,
    animatedAvatarUrl: animatedAvatarPath
      ? `${STEAM_COMMUNITY_ITEMS_CDN}${animatedAvatarPath}`
      : undefined,
    profileBackgroundUrl: backgroundPath
      ? `${STEAM_COMMUNITY_ITEMS_CDN}${backgroundPath}`
      : undefined,
    profileBackgroundVideoUrl: backgroundVideoPath
      ? `${STEAM_COMMUNITY_ITEMS_CDN}${backgroundVideoPath}`
      : undefined,
    personaState: PERSONA_STATE[player.personastate],
    currentGame,
    privacyPrereqs: {
      profilePublic,
      gameDetailsPublic: "unknown",
    },
  };
}
