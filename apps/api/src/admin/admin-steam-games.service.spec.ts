import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import type { SteamGameCurationService } from "../steam/game-curation.service";
import { AdminSteamGamesService } from "./admin-steam-games.service";

const AT = new Date("2026-08-20T10:00:00Z");

function row(over: Record<string, unknown> = {}) {
  return {
    appid: 1091500,
    name: null,
    hiddenAt: null,
    unfeaturedAt: null,
    reviewedAt: AT,
    note: null,
    createdAt: AT,
    ...over,
  };
}

function setup(
  opts: {
    rows?: ReturnType<typeof row>[];
    owned?: { appid: number; name: string }[];
  } = {}
) {
  const findMany = vi.fn().mockResolvedValue(opts.rows ?? []);
  const upsert = vi.fn().mockImplementation(async ({ create }) => row(create));
  const deleteMany = vi.fn().mockResolvedValue({ count: 1 });
  const ownedFindMany = vi.fn().mockResolvedValue(opts.owned ?? []);
  const ownedFindUnique = vi
    .fn()
    .mockImplementation(
      async ({ where }) => (opts.owned ?? []).find((g) => g.appid === where.appid) ?? null
    );

  const prisma = {
    steamGameCuration: { findMany, upsert, deleteMany },
    steamOwnedGame: { findMany: ownedFindMany, findUnique: ownedFindUnique },
  } as unknown as PrismaService;

  const invalidate = vi.fn();
  const curation = {
    invalidate,
    pendingReviewCount: vi.fn().mockResolvedValue(3),
  } as unknown as SteamGameCurationService;

  return {
    service: new AdminSteamGamesService(prisma, curation),
    findMany,
    upsert,
    deleteMany,
    invalidate,
  };
}

describe("AdminSteamGamesService", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  describe("list", () => {
    it("projects timestamps as ISO strings and counts pending reviews", async () => {
      const { service } = setup({
        rows: [
          row({ appid: 1, hiddenAt: AT, reviewedAt: null }),
          row({ appid: 2, unfeaturedAt: AT, note: "stale" }),
        ],
      });

      const { entries, pendingReview } = await service.list();
      expect(pendingReview).toBe(1);
      expect(entries[0]).toEqual({
        appid: 1,
        name: null,
        hiddenAt: AT.toISOString(),
        unfeaturedAt: null,
        reviewedAt: null,
        note: null,
        createdAt: AT.toISOString(),
      });
      expect(entries[1]?.unfeaturedAt).toBe(AT.toISOString());
      expect(entries[1]?.note).toBe("stale");
    });

    it("puts unreviewed rows first", async () => {
      const { service, findMany } = setup();
      await service.list();
      expect(findMany.mock.calls[0]?.[0]?.orderBy).toEqual([
        { reviewedAt: "asc" },
        { createdAt: "desc" },
      ]);
    });

    it("falls back to the library name when the row carries none", async () => {
      const { service } = setup({
        rows: [row({ appid: 570 })],
        owned: [{ appid: 570, name: "Dota 2" }],
      });
      expect((await service.list()).entries[0]?.name).toBe("Dota 2");
    });

    it("prefers the row's own name, which is the only one an unowned game has", async () => {
      const { service } = setup({
        rows: [row({ appid: 570, name: "Wishlisted Thing" })],
        owned: [{ appid: 570, name: "Dota 2" }],
      });
      expect((await service.list()).entries[0]?.name).toBe("Wishlisted Thing");
    });

    it("skips the name join entirely when the overlay is empty", async () => {
      const { service } = setup();
      const result = await service.list();
      expect(result).toEqual({ entries: [], pendingReview: 0 });
    });
  });

  describe("update", () => {
    it("stamps a timestamp for true and clears it for false", async () => {
      const { service, upsert } = setup();
      await service.update(1, { hidden: true, unfeatured: false });

      const { update } = upsert.mock.calls[0]?.[0] ?? {};
      expect(update.hiddenAt).toBeInstanceOf(Date);
      expect(update.unfeaturedAt).toBeNull();
    });

    it("leaves an omitted axis untouched rather than clearing it", async () => {
      const { service, upsert } = setup();
      await service.update(1, { note: "just a note" });

      const { update } = upsert.mock.calls[0]?.[0] ?? {};
      expect(update).toEqual({ note: "just a note" });
      expect("hiddenAt" in update).toBe(false);
      expect("unfeaturedAt" in update).toBe(false);
    });

    // A row the owner created by hand is itself the ruling, so it must not land
    // in the review queue it was created from.
    it("creates owner-made rows already reviewed", async () => {
      const { service, upsert } = setup();
      await service.update(1, { hidden: true });
      expect(upsert.mock.calls[0]?.[0]?.create?.reviewedAt).toBeInstanceOf(Date);
    });

    it("still honours an explicit reviewed:false on create", async () => {
      const { service, upsert } = setup();
      await service.update(1, { hidden: true, reviewed: false });
      expect(upsert.mock.calls[0]?.[0]?.create?.reviewedAt).toBeNull();
    });

    it("takes the name from the library when the request omits one", async () => {
      const { service, upsert } = setup({ owned: [{ appid: 570, name: "Dota 2" }] });
      await service.update(570, { hidden: true });
      expect(upsert.mock.calls[0]?.[0]?.create?.name).toBe("Dota 2");
    });

    it("accepts a name for an appid that isn't owned yet", async () => {
      const { service, upsert } = setup();
      await service.update(9999, { hidden: true, name: "Not Bought Yet" });
      expect(upsert.mock.calls[0]?.[0]?.create?.name).toBe("Not Bought Yet");
    });

    it("invalidates the read cache, so the change lands on the next request", async () => {
      const { service, invalidate } = setup();
      await service.update(1, { hidden: true });
      expect(invalidate).toHaveBeenCalledTimes(1);
    });
  });

  describe("remove", () => {
    it("drops the row and invalidates", async () => {
      const { service, deleteMany, invalidate } = setup();
      await service.remove(1091500);
      expect(deleteMany).toHaveBeenCalledWith({ where: { appid: 1091500 } });
      expect(invalidate).toHaveBeenCalledTimes(1);
    });
  });

  describe("reviewCount", () => {
    it("reads the cached count rather than querying", async () => {
      const { service, findMany } = setup();
      expect(await service.reviewCount()).toEqual({ pendingReview: 3 });
      expect(findMany).not.toHaveBeenCalled();
    });
  });
});
