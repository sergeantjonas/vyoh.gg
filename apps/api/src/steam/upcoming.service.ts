import { Injectable } from "@nestjs/common";
import type { SteamUpcoming, SteamUpcomingItem } from "@vyoh/shared";
import { PrismaService } from "../prisma/prisma.service";
import { STEAM_OWNER_ID } from "./steam.config";
import { SteamService, buildStoreUrl } from "./steam.service";

// Merges the two places an unreleased title can live. The wishlist is the
// obvious one; the library is the one this service exists for — Steam removes a
// wishlist entry on purchase, so a pre-ordered game drops out of the wishlist
// while still being months from release. Owned-side unreleased titles are read
// off `SteamGameEnrichment.comingSoon`, which the enrichment poller refreshes
// daily for exactly this set.
@Injectable()
export class SteamUpcomingService {
  constructor(
    private readonly steam: SteamService,
    private readonly prisma: PrismaService
  ) {}

  async getUpcoming(): Promise<SteamUpcoming> {
    const [wishlist, owned] = await Promise.all([
      this.steam.getOwnerWishlist(),
      this.ownedUnreleased(),
    ]);

    const byAppid = new Map<number, SteamUpcomingItem>();
    for (const item of wishlist.items) {
      // The wishlist holds released titles too (anything wishlisted and since
      // launched); this route is unreleased-only.
      if (!item.comingSoon) continue;
      byAppid.set(item.appid, {
        appid: item.appid,
        name: item.name,
        storeUrl: item.storeUrl,
        releaseDate: item.releaseDate,
        comingSoon: true,
        dateAdded: item.dateAdded,
        source: "wishlist",
      });
    }
    // Owned wins on collision. The two sets are normally disjoint, but a title
    // can sit in both across the window where Steam has taken the purchase and
    // not yet dropped the wishlist row — and once it is bought, "owned" is the
    // stronger fact for the tile to state.
    for (const item of owned) {
      byAppid.set(item.appid, item);
    }

    return {
      steamId: STEAM_OWNER_ID,
      items: sortUpcoming([...byAppid.values()]),
      fetchedAt: wishlist.fetchedAt,
    };
  }

  // Owned, not removed from the library, still flagged coming-soon. Driven from
  // the enrichment side because that is where the flag lives and the set is
  // tiny (a handful of rows against ~230 owned games), then narrowed to titles
  // the owner currently holds — enrichment also covers wishlist-only appids,
  // and those are the live wishlist call's job, not this query's.
  private async ownedUnreleased(): Promise<SteamUpcomingItem[]> {
    const unreleased = await this.prisma.steamGameEnrichment.findMany({
      where: { comingSoon: true },
      select: { appid: true, releaseDate: true },
    });
    if (unreleased.length === 0) return [];

    const owned = await this.prisma.steamOwnedGame.findMany({
      where: { appid: { in: unreleased.map((row) => row.appid) }, removedAt: null },
      select: { appid: true, name: true, firstSeenAt: true },
    });
    const releaseByAppid = new Map(unreleased.map((row) => [row.appid, row.releaseDate]));

    return owned.map((game) => ({
      appid: game.appid,
      name: game.name,
      storeUrl: buildStoreUrl(game.appid, null),
      releaseDate: toUnixSeconds(releaseByAppid.get(game.appid) ?? null),
      comingSoon: true,
      // First library sighting stands in for the wishlist add date. For an
      // unreleased title the daily owned-games sync sees it within a day of
      // purchase, so this is the pre-order date to within that day.
      dateAdded: Math.floor(game.firstSeenAt.getTime() / 1000),
      source: "owned",
    }));
  }
}

// The column is `@db.Date`, so Prisma hands back UTC midnight of the stored day
// — which is what the precision classifier reads the month and day off. The
// wishlist side keeps whatever time-of-day Steam published; both collapse to the
// same civil date downstream, so the tier and the calendar cell agree.
function toUnixSeconds(date: Date | null): number | null {
  return date === null ? null : Math.floor(date.getTime() / 1000);
}

// Deterministic order so the payload is stable across requests: dated titles
// soonest-first, then the undated pile most-recently-added first. The client
// re-sorts per bucket; this exists so nothing depends on Prisma's row order.
function sortUpcoming(items: SteamUpcomingItem[]): SteamUpcomingItem[] {
  return items.sort((a, b) => {
    if (a.releaseDate === null || b.releaseDate === null) {
      if (a.releaseDate !== b.releaseDate) return a.releaseDate === null ? 1 : -1;
      return b.dateAdded - a.dateAdded || a.appid - b.appid;
    }
    return a.releaseDate - b.releaseDate || a.appid - b.appid;
  });
}
