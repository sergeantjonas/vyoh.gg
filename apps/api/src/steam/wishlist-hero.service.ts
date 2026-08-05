import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import type { SteamWishlistHeroMeta } from "@vyoh/shared";
import { UpstreamError, fetchUpstreamChain } from "../img/upstream";
import { type EnrichmentUpsert, projectEnrichment } from "./enrichment.service";
import { SteamClientService } from "./steam-client.service";
import { SteamService } from "./steam.service";
import { composeHeroUrls, extractDominantHex } from "./subject-anchor.service";

// On-read enrichment for the Upcoming view's imminent hero (chunk 4). The
// nearest day-precise wishlist title is unreleased and almost always *unowned*,
// so it has no SteamGameEnrichment row — none of the hero's metadata (accent,
// platforms, ESRB, blurb) is in the wishlist payload or the DB. This service
// projects it per request from a fresh GetItems(full) call (reusing the
// owned-game `projectEnrichment` projection) plus a Vibrant pass over the
// resolved hero art for the accent, and caches the result in-memory.
//
// One game is queried at a time (the single imminent candidate), and the data
// only shifts when a publisher refreshes art or a date firms up, so a day-long
// TTL — matching the wishlist name cache — is ample.
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// Belt and braces behind the wishlist-membership gate below: the TTL alone
// never evicts, because it is only consulted on a read for that same key, so an
// entry nobody asks for again would be retained for the process lifetime. Real
// use needs exactly one entry — the single imminent hero.
const CACHE_MAX_ENTRIES = 64;

@Injectable()
export class SteamWishlistHeroService {
  private readonly logger = new Logger(SteamWishlistHeroService.name);
  private readonly cache = new Map<
    number,
    { value: SteamWishlistHeroMeta; expiresAt: number }
  >();

  constructor(
    private readonly client: SteamClientService,
    private readonly steam: SteamService
  ) {}

  async getHeroMeta(appid: number): Promise<SteamWishlistHeroMeta> {
    // Ahead of the cache read, not after it, so an off-wishlist appid never
    // reaches the store call, the art fetch, the Vibrant pass, or the map. The
    // web only ever asks about an appid it read out of the wishlist response,
    // so this can't refuse a request the surface actually makes.
    if (!(await this.steam.isWishlisted(appid))) {
      throw new NotFoundException(`Appid ${appid} is not on the wishlist.`);
    }

    const now = Date.now();
    const cached = this.cache.get(appid);
    if (cached && cached.expiresAt > now) return cached.value;

    const [raw] = await this.client.getStoreItemsFull([appid]);
    const projected = raw ? projectEnrichment(raw) : null;
    if (!projected) {
      // success !== 1 (delisted / region-locked / hidden) — there is no store
      // page to build a hero from. A 404 lets the web hook treat this as
      // "skip the hero", symmetric with the day-precise-within-60-days rule.
      throw new NotFoundException(`No store data for appid ${appid}.`);
    }

    const value: SteamWishlistHeroMeta = {
      appid,
      dominantHex: await this.resolveDominantHex(appid, projected),
      shortDescription: projected.shortDescription,
      steamDeckCompat: projected.steamDeckCompat,
      platformWindows: projected.platformWindows,
      platformMac: projected.platformMac,
      platformLinux: projected.platformLinux,
      gameRating: projected.gameRating,
      assetTimestamp:
        projected.assetTimestamp != null ? Number(projected.assetTimestamp) : null,
    };
    this.cache.set(appid, { value, expiresAt: now + CACHE_TTL_MS });
    this.evictExpiredAndOverflow(now);
    return value;
  }

  // Drop anything past its TTL, then oldest-first until the count is back under
  // the cap. Map preserves insertion order, so its own key order is the eviction
  // order — no separate bookkeeping needed at this size.
  private evictExpiredAndOverflow(now: number): void {
    for (const [key, entry] of this.cache) {
      if (entry.expiresAt <= now) this.cache.delete(key);
    }
    while (this.cache.size > CACHE_MAX_ENTRIES) {
      const oldest = this.cache.keys().next();
      if (oldest.done) break;
      this.cache.delete(oldest.value);
    }
  }

  // Fetch the (1x) hero bytes through the same CDN fallback chain the anchor
  // service uses, then run Vibrant for the accent. The 1x asset is enough for a
  // dominant-colour read — the 2x bytes the frontend renders aren't worth the
  // heavier fetch here. Any failure (no hero across the chain, malformed bytes)
  // collapses to a null accent; the hero falls back to its neutral token.
  private async resolveDominantHex(
    appid: number,
    projected: EnrichmentUpsert
  ): Promise<string | null> {
    try {
      const urls = composeHeroUrls(
        appid,
        projected.libraryHeroPath,
        projected.assetTimestamp
      );
      const bytes = await fetchUpstreamChain(urls);
      return await extractDominantHex(bytes);
    } catch (err) {
      if (!(err instanceof UpstreamError)) {
        this.logger.warn(`hero accent fetch failed for ${appid}: ${String(err)}`);
      }
      return null;
    }
  }
}
