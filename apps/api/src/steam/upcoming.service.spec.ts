import type { SteamWishlist, SteamWishlistItem } from "@vyoh/shared";
import { NO_CURATION } from "@vyoh/shared";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import { STEAM_OWNER_ID } from "./steam.config";
import type { SteamService } from "./steam.service";
import { SteamUpcomingService } from "./upcoming.service";

function wishlistItem(overrides: Partial<SteamWishlistItem> = {}): SteamWishlistItem {
  return {
    appid: 1,
    name: "Wishlisted",
    dateAdded: 1_700_000_000,
    priority: 0,
    storeUrl: "https://store.steampowered.com/app/1/Wishlisted/",
    releaseDate: 1_790_000_000,
    comingSoon: true,
    ...overrides,
  };
}

function wishlist(items: SteamWishlistItem[]): SteamWishlist {
  return { steamId: STEAM_OWNER_ID, items, fetchedAt: 1_715_688_000_000 };
}

function makeDeps(
  items: SteamWishlistItem[] = [],
  enrichment: { appid: number; releaseDate: Date | null }[] = [],
  owned: { appid: number; name: string; firstSeenAt: Date }[] = []
) {
  const prisma = {
    steamGameEnrichment: { findMany: vi.fn().mockResolvedValue(enrichment) },
    steamOwnedGame: { findMany: vi.fn().mockResolvedValue(owned) },
  };
  const steam = { getOwnerWishlist: vi.fn().mockResolvedValue(wishlist(items)) };
  return {
    service: new SteamUpcomingService(
      steam as unknown as SteamService,
      prisma as unknown as PrismaService
    ),
    prisma,
    steam,
  };
}

describe("SteamUpcomingService.getUpcoming", () => {
  it("carries wishlisted coming-soon titles through with their provenance", async () => {
    const { service } = makeDeps([wishlistItem({ appid: 42 })]);
    const result = await service.getUpcoming(NO_CURATION);
    expect(result.steamId).toBe(STEAM_OWNER_ID);
    expect(result.items).toEqual([
      {
        appid: 42,
        name: "Wishlisted",
        storeUrl: "https://store.steampowered.com/app/1/Wishlisted/",
        releaseDate: 1_790_000_000,
        comingSoon: true,
        dateAdded: 1_700_000_000,
        source: "wishlist",
      },
    ]);
  });

  // The wishlist keeps titles that have since launched; this route is about what
  // is still ahead, so a released row has no place in it.
  it("drops wishlisted titles that have already released", async () => {
    const { service } = makeDeps([
      wishlistItem({ appid: 42, comingSoon: false }),
      wishlistItem({ appid: 43 }),
    ]);
    const result = await service.getUpcoming(NO_CURATION);
    expect(result.items.map((i) => i.appid)).toEqual([43]);
  });

  // The whole point of the merge: a pre-ordered game is gone from the wishlist,
  // so the library row is the only place the release still exists.
  it("includes an owned title that is still flagged coming-soon", async () => {
    const { service } = makeDeps(
      [],
      [{ appid: 2584270, releaseDate: new Date("2026-08-20T00:00:00Z") }],
      [
        {
          appid: 2584270,
          name: "Mortal Shell II",
          firstSeenAt: new Date("2026-07-31T12:00:00Z"),
        },
      ]
    );
    const result = await service.getUpcoming(NO_CURATION);
    expect(result.items).toEqual([
      {
        appid: 2584270,
        name: "Mortal Shell II",
        // No persisted store_url_path on the enrichment row, so the bare app URL.
        storeUrl: "https://store.steampowered.com/app/2584270/",
        releaseDate: Math.floor(Date.UTC(2026, 7, 20) / 1000),
        comingSoon: true,
        // First library sighting stands in for a wishlist add date.
        dateAdded: Math.floor(Date.UTC(2026, 6, 31, 12) / 1000),
        source: "owned",
      },
    ]);
  });

  // Enrichment covers wishlist-only appids too, so the coming-soon set is wider
  // than the library. Those rows belong to the live wishlist call, not this one.
  it("ignores coming-soon enrichment rows the owner does not own", async () => {
    const { service, prisma } = makeDeps(
      [],
      [
        { appid: 111, releaseDate: new Date("2026-09-01T00:00:00Z") },
        { appid: 222, releaseDate: new Date("2026-09-02T00:00:00Z") },
      ],
      [{ appid: 222, name: "Owned", firstSeenAt: new Date("2026-07-01T00:00:00Z") }]
    );
    const result = await service.getUpcoming(NO_CURATION);
    expect(result.items.map((i) => i.appid)).toEqual([222]);
    expect(prisma.steamOwnedGame.findMany).toHaveBeenCalledWith({
      where: { appid: { in: [111, 222] }, removedAt: null },
      select: { appid: true, name: true, firstSeenAt: true },
    });
  });

  it("skips the library query when nothing is flagged coming-soon", async () => {
    const { service, prisma } = makeDeps([]);
    await service.getUpcoming(NO_CURATION);
    expect(prisma.steamOwnedGame.findMany).not.toHaveBeenCalled();
  });

  // Steam normally deletes the wishlist row on purchase, but the two can overlap
  // for a window — and once bought, owned is the stronger fact.
  it("prefers the owned side when an appid is in both", async () => {
    const { service } = makeDeps(
      [wishlistItem({ appid: 42, name: "Still wishlisted" })],
      [{ appid: 42, releaseDate: new Date("2026-08-20T00:00:00Z") }],
      [{ appid: 42, name: "Bought", firstSeenAt: new Date("2026-07-31T00:00:00Z") }]
    );
    const result = await service.getUpcoming(NO_CURATION);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.source).toBe("owned");
    expect(result.items[0]?.name).toBe("Bought");
  });

  it("orders dated titles soonest-first and leaves the undated pile last", async () => {
    const { service } = makeDeps([
      wishlistItem({ appid: 1, releaseDate: null, dateAdded: 1_600_000_000 }),
      wishlistItem({ appid: 2, releaseDate: 1_800_000_000 }),
      wishlistItem({ appid: 3, releaseDate: null, dateAdded: 1_690_000_000 }),
      wishlistItem({ appid: 4, releaseDate: 1_790_000_000 }),
    ]);
    const result = await service.getUpcoming(NO_CURATION);
    // Undated pile is most-recently-added first, matching the TBA bucket's order.
    expect(result.items.map((i) => i.appid)).toEqual([4, 2, 3, 1]);
  });

  it("reports the wishlist pull as the payload's fetch stamp", async () => {
    const { service } = makeDeps([wishlistItem()]);
    await expect(service.getUpcoming(NO_CURATION)).resolves.toMatchObject({
      fetchedAt: 1_715_688_000_000,
    });
  });

  // A TBA pre-order — owned, unreleased, no announced date. Deriving the
  // coming-soon verdict from `releaseDate` would have dropped this shape
  // entirely, which is why the flag is persisted.
  it("keeps an owned title with no announced release date", async () => {
    const { service } = makeDeps(
      [],
      [{ appid: 42, releaseDate: null }],
      [{ appid: 42, name: "Someday", firstSeenAt: new Date("2026-07-01T00:00:00Z") }]
    );
    const result = await service.getUpcoming(NO_CURATION);
    expect(result.items[0]).toMatchObject({ releaseDate: null, comingSoon: true });
  });
});

// Per-appid lookups rather than the merge's list reads, so these get their own
// doubles: `comingSoon` decides the enrichment arm, `owned` the library one.
function makeMembershipDeps(
  { comingSoon = false, owned = false, wishlisted = false } = {},
  isWishlisted = vi.fn().mockResolvedValue(wishlisted)
) {
  const prisma = {
    steamGameEnrichment: {
      findFirst: vi.fn().mockResolvedValue(comingSoon ? { appid: 42 } : null),
    },
    steamOwnedGame: {
      findFirst: vi.fn().mockResolvedValue(owned ? { appid: 42 } : null),
    },
  };
  const steam = { isWishlisted };
  return {
    service: new SteamUpcomingService(
      steam as unknown as SteamService,
      prisma as unknown as PrismaService
    ),
    prisma,
    isWishlisted,
  };
}

describe("SteamUpcomingService.membershipOf", () => {
  it("answers 'wishlist' for a title on the wishlist", async () => {
    const { service } = makeMembershipDeps({ wishlisted: true });
    await expect(service.membershipOf(42, NO_CURATION)).resolves.toBe("wishlist");
  });

  // The reason this check exists: the hero asks about a pre-order at the moment
  // it becomes the nearest release, and by then the wishlist has dropped it.
  it("answers 'owned' for a pre-order the wishlist no longer holds", async () => {
    const { service } = makeMembershipDeps({ comingSoon: true, owned: true });
    await expect(service.membershipOf(42, NO_CURATION)).resolves.toBe("owned");
  });

  it("refuses an appid in neither set", async () => {
    const { service } = makeMembershipDeps();
    await expect(service.membershipOf(999_999, NO_CURATION)).resolves.toBeNull();
  });

  // Same precedence as the merge, so a title in both is described the same way
  // by the guard and by the payload.
  it("prefers 'owned' when an appid is in both", async () => {
    const { service } = makeMembershipDeps({
      comingSoon: true,
      owned: true,
      wishlisted: true,
    });
    await expect(service.membershipOf(42, NO_CURATION)).resolves.toBe("owned");
  });

  // The library arm reads our own DB, so a pre-order still resolves through a
  // Steam outage — which is the arm that has to answer without help.
  it("does not consult the wishlist once the library has answered", async () => {
    const { service, isWishlisted } = makeMembershipDeps({
      comingSoon: true,
      owned: true,
    });
    await service.membershipOf(42, NO_CURATION);
    expect(isWishlisted).not.toHaveBeenCalled();
  });

  // Enrichment carries wishlist-only appids too, so the coming-soon flag alone
  // would admit games the owner has never held — the same narrowing the merge does.
  it("does not take a coming-soon row the owner does not own as ownership", async () => {
    const { service, prisma } = makeMembershipDeps({ comingSoon: true });
    await expect(service.membershipOf(42, NO_CURATION)).resolves.toBeNull();
    expect(prisma.steamOwnedGame.findFirst).toHaveBeenCalledWith({
      where: { appid: 42, removedAt: null },
      select: { appid: true },
    });
  });

  it("skips the library lookup for an appid with no coming-soon row", async () => {
    const { service, prisma } = makeMembershipDeps({ wishlisted: true });
    await service.membershipOf(42, NO_CURATION);
    expect(prisma.steamOwnedGame.findFirst).not.toHaveBeenCalled();
  });
});
