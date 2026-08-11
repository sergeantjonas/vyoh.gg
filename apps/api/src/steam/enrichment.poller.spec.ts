import { afterEach, describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import { SteamEnrichmentPoller } from "./enrichment.poller";
import type { SteamEnrichmentService } from "./enrichment.service";
import type { SteamService } from "./steam.service";
import type { SteamSubjectAnchorService } from "./subject-anchor.service";

function makePrisma() {
  return {
    steamOwnedGame: { findMany: vi.fn().mockResolvedValue([]) },
    steamGameEnrichment: { findMany: vi.fn().mockResolvedValue([]) },
  };
}

function makeService() {
  return { enrichApps: vi.fn().mockResolvedValue(undefined) };
}

function row(
  appid: number,
  opts: { logoPath?: string | null; ageDays: number; comingSoon?: boolean | null }
): {
  appid: number;
  logoPath: string | null;
  enrichedAt: Date;
  comingSoon: boolean | null;
} {
  return {
    appid,
    logoPath: opts.logoPath === undefined ? "abc" : opts.logoPath,
    enrichedAt: new Date(Date.now() - opts.ageDays * 86_400_000),
    comingSoon: opts.comingSoon ?? null,
  };
}

function makeSteam() {
  return { getOwnerWishlist: vi.fn().mockResolvedValue({ items: [] }) };
}

function makeAnchors() {
  return { computeMissingAnchors: vi.fn().mockResolvedValue(0) };
}

function makePoller(
  prisma = makePrisma(),
  service = makeService(),
  steam = makeSteam(),
  anchors = makeAnchors()
) {
  return {
    poller: new SteamEnrichmentPoller(
      prisma as unknown as PrismaService,
      service as unknown as SteamEnrichmentService,
      steam as unknown as SteamService,
      anchors as unknown as SteamSubjectAnchorService
    ),
    prisma,
    service,
    steam,
    anchors,
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

  it("returns early when every candidate is complete and inside the window", async () => {
    const prisma = makePrisma();
    prisma.steamOwnedGame.findMany.mockResolvedValue([{ appid: 42 }]);
    prisma.steamGameEnrichment.findMany.mockResolvedValue([row(42, { ageDays: 3 })]);
    const { poller, service } = makePoller(prisma);
    await poller.onModuleInit();
    expect(service.enrichApps).not.toHaveBeenCalled();
  });

  it("backfills incomplete (logoPath=null) rows on boot", async () => {
    const prisma = makePrisma();
    prisma.steamOwnedGame.findMany.mockResolvedValue([{ appid: 42 }, { appid: 99 }]);
    prisma.steamGameEnrichment.findMany.mockResolvedValue([
      row(42, { logoPath: null, ageDays: 1 }),
    ]);
    const { poller, service } = makePoller(prisma);
    await poller.onModuleInit();
    // 99 has no row at all, so it sorts ahead of the freshly-stamped 42.
    expect(service.enrichApps).toHaveBeenCalledWith([99, 42]);
  });

  // Boot used to reach incomplete rows only, so a complete row that had aged
  // past the refresh interval was invisible to it.
  it("enriches a complete row that has aged past the window", async () => {
    const prisma = makePrisma();
    prisma.steamOwnedGame.findMany.mockResolvedValue([{ appid: 42 }]);
    prisma.steamGameEnrichment.findMany.mockResolvedValue([row(42, { ageDays: 45 })]);
    const { poller, service } = makePoller(prisma);
    await poller.onModuleInit();
    expect(service.enrichApps).toHaveBeenCalledWith([42]);
  });

  // Unreleased titles drive the upcoming calendar, and their dates slip right up
  // to launch, so they refresh daily instead of riding the monthly age.
  it("enriches a coming-soon row that is stale by a day but fresh by the monthly window", async () => {
    const prisma = makePrisma();
    prisma.steamOwnedGame.findMany.mockResolvedValue([{ appid: 42 }]);
    prisma.steamGameEnrichment.findMany.mockResolvedValue([
      row(42, { ageDays: 2, comingSoon: true }),
    ]);
    const { poller, service } = makePoller(prisma);
    await poller.onModuleInit();
    expect(service.enrichApps).toHaveBeenCalledWith([42]);
  });

  it("leaves a released row alone at the same age", async () => {
    const prisma = makePrisma();
    prisma.steamOwnedGame.findMany.mockResolvedValue([{ appid: 42 }]);
    prisma.steamGameEnrichment.findMany.mockResolvedValue([
      row(42, { ageDays: 2, comingSoon: false }),
    ]);
    const { poller, service } = makePoller(prisma);
    await poller.onModuleInit();
    expect(service.enrichApps).not.toHaveBeenCalled();
  });

  it("orders never-enriched first, then oldest, and caps the pass", async () => {
    const prisma = makePrisma();
    const owned = Array.from({ length: 40 }, (_, i) => ({ appid: i + 1 }));
    prisma.steamOwnedGame.findMany.mockResolvedValue(owned);
    // Every row stale, ages ascending with appid — so appid 40 is the oldest
    // of the enriched ones, and appid 1 has no row at all.
    prisma.steamGameEnrichment.findMany.mockResolvedValue(
      owned.slice(1).map((g) => row(g.appid, { ageDays: 30 + g.appid }))
    );
    const { poller, service } = makePoller(prisma);
    await poller.onModuleInit();
    const sent = service.enrichApps.mock.calls[0]?.[0] as number[];
    expect(sent).toHaveLength(25);
    expect(sent[0]).toBe(1);
    expect(sent[1]).toBe(40);
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
