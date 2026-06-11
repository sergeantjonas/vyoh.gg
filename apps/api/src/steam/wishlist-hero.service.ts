import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import type { SteamWishlistHeroMeta } from "@vyoh/shared";
import { UpstreamError, fetchUpstreamChain } from "../img/upstream";
import { type EnrichmentUpsert, projectEnrichment } from "./enrichment.service";
import { SteamClientService } from "./steam-client.service";
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

@Injectable()
export class SteamWishlistHeroService {
  private readonly logger = new Logger(SteamWishlistHeroService.name);
  private readonly cache = new Map<
    number,
    { value: SteamWishlistHeroMeta; expiresAt: number }
  >();

  constructor(private readonly client: SteamClientService) {}

  async getHeroMeta(appid: number): Promise<SteamWishlistHeroMeta> {
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
    return value;
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
