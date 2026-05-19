import { afterEach, describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import { SteamEnrichmentPoller } from "./enrichment.poller";
import type { SteamEnrichmentService } from "./enrichment.service";
import type { SteamService } from "./steam.service";

function makePrisma() {
  return {
    steamOwnedGame: { findMany: vi.fn().mockResolvedValue([]) },
    steamGameEnrichment: { findMany: vi.fn().mockResolvedValue([]) },
  };
}

function makeService() {
  return { enrichApps: vi.fn().mockResolvedValue(undefined) };
}

function makeSteam() {
  return { getOwnerWishlist: vi.fn().mockResolvedValue({ items: [] }) };
}

function makePoller(prisma = makePrisma(), service = makeService(), steam = makeSteam()) {
  return {
    poller: new SteamEnrichmentPoller(
      prisma as unknown as PrismaService,
      service as unknown as SteamEnrichmentService,
      steam as unknown as SteamService
    ),
    prisma,
    service,
    steam,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("SteamEnrichmentPoller.onModuleInit", () => {
  it("returns early when there are no candidate appids", async () => {
    const { poller, service } = makePoller();
    await poller.onModuleInit();
    expect(service.enrichApps).not.toHaveBeenCalled();
  });

  it("returns early when every candidate already has logoPath set", async () => {
    const prisma = makePrisma();
    prisma.steamOwnedGame.findMany.mockResolvedValue([{ appid: 42 }]);
    prisma.steamGameEnrichment.findMany.mockResolvedValue([
      { appid: 42, logoPath: "abc" },
    ]);
    const { poller, service } = makePoller(prisma);
    await poller.onModuleInit();
    expect(service.enrichApps).not.toHaveBeenCalled();
  });

  it("backfills incomplete (logoPath=null) rows on boot", async () => {
    const prisma = makePrisma();
    prisma.steamOwnedGame.findMany.mockResolvedValue([{ appid: 42 }, { appid: 99 }]);
    prisma.steamGameEnrichment.findMany.mockResolvedValue([
      { appid: 42, logoPath: null },
    ]);
    const { poller, service } = makePoller(prisma);
    await poller.onModuleInit();
    expect(service.enrichApps).toHaveBeenCalledWith([42, 99]);
  });

  it("logs and swallows errors from the enrichApps backfill so boot stays unblocked", async () => {
    const prisma = makePrisma();
    prisma.steamOwnedGame.findMany.mockResolvedValue([{ appid: 42 }]);
    const service = makeService();
    service.enrichApps.mockRejectedValue(new Error("steam down"));
    const { poller } = makePoller(prisma, service);
    await expect(poller.onModuleInit()).resolves.toBeUndefined();
  });

  it("includes wishlist appids even when no owned games are present", async () => {
    const prisma = makePrisma();
    const steam = makeSteam();
    steam.getOwnerWishlist.mockResolvedValue({ items: [{ appid: 99 }] });
    const { poller, service } = makePoller(prisma, undefined, steam);
    await poller.onModuleInit();
    expect(service.enrichApps).toHaveBeenCalledWith([99]);
  });

  it("proceeds with owned-only when the wishlist fetch throws", async () => {
    const prisma = makePrisma();
    prisma.steamOwnedGame.findMany.mockResolvedValue([{ appid: 42 }]);
    const steam = makeSteam();
    steam.getOwnerWishlist.mockRejectedValue(new Error("steam down"));
    const { poller, service } = makePoller(prisma, undefined, steam);
    await poller.onModuleInit();
    expect(service.enrichApps).toHaveBeenCalledWith([42]);
  });
});

describe("SteamEnrichmentPoller.tick", () => {
  it("calls enrichApps with the deduped candidate appids", async () => {
    const prisma = makePrisma();
    prisma.steamOwnedGame.findMany.mockResolvedValue([{ appid: 42 }]);
    const steam = makeSteam();
    steam.getOwnerWishlist.mockResolvedValue({
      items: [{ appid: 42 }, { appid: 99 }],
    });
    const { poller, service } = makePoller(prisma, undefined, steam);
    await poller.tick();
    expect(service.enrichApps).toHaveBeenCalledWith([42, 99]);
  });

  it("skips overlapping ticks when a previous one is still running", async () => {
    const prisma = makePrisma();
    prisma.steamOwnedGame.findMany.mockResolvedValue([{ appid: 42 }]);
    const service = makeService();
    const release: { fn: (() => void) | null } = { fn: null };
    service.enrichApps.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          release.fn = resolve;
        })
    );
    const { poller } = makePoller(prisma, service);
    const first = poller.tick();
    // Let candidateAppids() resolve so the first tick is parked inside the
    // unresolved enrichApps() promise — running flag is now true.
    await new Promise((r) => setImmediate(r));
    await poller.tick();
    expect(service.enrichApps).toHaveBeenCalledTimes(1);
    release.fn?.();
    await first;
  });

  it("swallows enrichApps errors and clears the running flag for the next tick", async () => {
    const prisma = makePrisma();
    prisma.steamOwnedGame.findMany.mockResolvedValue([{ appid: 42 }]);
    const service = makeService();
    service.enrichApps.mockRejectedValueOnce(new Error("steam down"));
    const { poller } = makePoller(prisma, service);
    await expect(poller.tick()).resolves.toBeUndefined();
    // Second tick should be allowed to fire (running flag cleared).
    service.enrichApps.mockResolvedValueOnce(undefined);
    await poller.tick();
    expect(service.enrichApps).toHaveBeenCalledTimes(2);
  });
});
