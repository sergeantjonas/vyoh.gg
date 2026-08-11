import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import type { SteamGameRating, SteamWishlistHeroMeta } from "@vyoh/shared";
import { UpstreamError, fetchUpstreamChain } from "../img/upstream";
import { PrismaService } from "../prisma/prisma.service";
import { type EnrichmentUpsert, projectEnrichment } from "./enrichment.service";
import { SteamClientService } from "./steam-client.service";
import { composeHeroUrls, extractDominantHex } from "./subject-anchor.service";
import { SteamUpcomingService } from "./upcoming.service";

// Metadata for the Upcoming view's imminent hero. Where it comes from depends on
// how the owner came to be tracking the game:
//
// - **Owned** (a pre-order): the enrichment poller already covers the title, so
//   every field this endpoint returns — accent included — is a row read away.
// - **Wishlisted**: unowned by definition, so there is no enrichment row and
//   none of the hero's metadata (accent, platforms, ESRB, blurb) is in the
//   wishlist payload either. It is projected per request from a fresh
//   GetItems(full) call (reusing the owned-game `projectEnrichment` projection)
//   plus a Vibrant pass over the resolved hero art, and cached in-memory.
//
// One game is queried at a time (the single imminent candidate), and the data
// only shifts when a publisher refreshes art or a date firms up, so a day-long
// TTL — matching the wishlist name cache — is ample. The row-backed path needs
// no cache of its own: it carries none of that cost, and a copy here would only
// go stale against a poller that refreshes coming-soon rows daily.
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// Belt and braces behind the membership gate below: the TTL alone never evicts,
// because it is only consulted on a read for that same key, so an entry nobody
// asks for again would be retained for the process lifetime. Real use needs
// exactly one entry — the single imminent hero.
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
    private readonly upcoming: SteamUpcomingService,
    private readonly prisma: PrismaService
  ) {}

  async getHeroMeta(appid: number): Promise<SteamWishlistHeroMeta> {
    // Ahead of the cache read, not after it, so an appid off the upcoming set
    // never reaches the store call, the art fetch, the Vibrant pass, or the map.
    // The web only ever asks about an appid it read out of the upcoming
    // response, so this can't refuse a request the surface actually makes.
    const source = await this.upcoming.membershipOf(appid);
    if (source === null) {
      throw new NotFoundException(`Appid ${appid} is not an upcoming release.`);
    }

    // The membership check read this row to answer "owned"; reading it again for
    // the payload is two indexed lookups against a store round-trip, an image
    // fetch and a Vibrant pass over art the anchor pass has already analysed.
    if (source === "owned") {
      const stored = await this.storedMeta(appid);
      if (stored) return stored;
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

  // The stored projection, for a title the owner already holds. Nullable only
  // because membership and this read are two separate queries — a row that
  // vanished between them falls through to the per-request path, which is the
  // one a wishlisted title takes anyway.
  private async storedMeta(appid: number): Promise<SteamWishlistHeroMeta | null> {
    const row = await this.prisma.steamGameEnrichment.findUnique({
      where: { appid },
      select: {
        dominantHex: true,
        shortDescription: true,
        steamDeckCompat: true,
        platformWindows: true,
        platformMac: true,
        platformLinux: true,
        gameRating: true,
        assetTimestamp: true,
      },
    });
    if (!row) return null;

    return {
      appid,
      // Written by the anchor pass over the same hero art the Vibrant pass here
      // would re-read. Null when that pass hasn't reached the row yet; the hero
      // falls back to its neutral token, as it does when the art is unreachable.
      dominantHex: row.dominantHex,
      shortDescription: row.shortDescription,
      steamDeckCompat: row.steamDeckCompat,
      platformWindows: row.platformWindows,
      platformMac: row.platformMac,
      platformLinux: row.platformLinux,
      // Cast at the boundary — the column is Json and the projection writes the
      // strict shape, same convention as the owned-games read.
      gameRating:
        row.gameRating != null ? (row.gameRating as unknown as SteamGameRating) : null,
      assetTimestamp: row.assetTimestamp != null ? Number(row.assetTimestamp) : null,
    };
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
