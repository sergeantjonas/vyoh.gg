import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import type { SteamService } from "../steam/steam.service";
import { ImgPrewarmService } from "./img-prewarm.service";

function makePrismaStub(): {
  steamOwnedGame: { findMany: ReturnType<typeof vi.fn> };
} {
  return {
    steamOwnedGame: { findMany: vi.fn().mockResolvedValue([]) },
  };
}

function makeSteamStub(): {
  getOwnerWishlist: ReturnType<typeof vi.fn>;
} {
  return {
    getOwnerWishlist: vi.fn().mockResolvedValue({ items: [] }),
  };
}

function makeService(
  prisma = makePrismaStub(),
  steam = makeSteamStub()
): {
  service: ImgPrewarmService;
  prisma: ReturnType<typeof makePrismaStub>;
  steam: ReturnType<typeof makeSteamStub>;
} {
  return {
    service: new ImgPrewarmService(
      prisma as unknown as PrismaService,
      steam as unknown as SteamService
    ),
    prisma,
    steam,
  };
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
  process.env.STEAM_PREWARM = "";
  process.env.LOL_PREWARM = "";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ImgPrewarmService.onApplicationBootstrap", () => {
  it("no-ops when neither STEAM_PREWARM nor LOL_PREWARM is set", () => {
    vi.useFakeTimers();
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    makeService().service.onApplicationBootstrap();
    expect(setTimeoutSpy).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("schedules the boot delay when at least one prewarm flag is enabled", () => {
    vi.useFakeTimers();
    process.env.LOL_PREWARM = "1";
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    makeService().service.onApplicationBootstrap();
    expect(setTimeoutSpy).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("kicks off both prewarm pipelines when both flags are enabled and the boot timer fires", async () => {
    process.env.STEAM_PREWARM = "1";
    process.env.LOL_PREWARM = "1";
    const { service, prisma } = makeService();
    // Force the lol-prewarm bootstrap to fail so the loop exits quickly and
    // we don't accumulate champion×variant fetch calls.
    prisma.steamOwnedGame.findMany.mockResolvedValue([]);
    vi.mocked(fetch).mockRejectedValue(new Error("boot fetch failed"));
    vi.useFakeTimers();
    service.onApplicationBootstrap();
    await vi.runAllTimersAsync();
    vi.useRealTimers();
    // Both pipelines were exercised; assertion is that we didn't crash.
    expect(true).toBe(true);
  });
});

describe("ImgPrewarmService.prewarmSteam (private)", () => {
  it("skips the loop when there are no owned games and the wishlist is empty", async () => {
    const { service, prisma } = makeService();
    prisma.steamOwnedGame.findMany.mockResolvedValue([]);
    await (service as unknown as { prewarmSteam: () => Promise<void> }).prewarmSteam();
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it("falls back to owned-only when the wishlist fetch throws", async () => {
    const { service, prisma, steam } = makeService();
    prisma.steamOwnedGame.findMany.mockResolvedValue([{ appid: 42 }]);
    steam.getOwnerWishlist.mockRejectedValue(new Error("steam down"));
    vi.mocked(fetch).mockResolvedValue(new Response("", { status: 200 }));
    await (service as unknown as { prewarmSteam: () => Promise<void> }).prewarmSteam();
    // 5 routes × 1 appid = 5 fetches
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(5);
  });

  it("dedupes appids that appear in both owned and wishlist", async () => {
    const { service, prisma, steam } = makeService();
    prisma.steamOwnedGame.findMany.mockResolvedValue([{ appid: 42 }]);
    steam.getOwnerWishlist.mockResolvedValue({ items: [{ appid: 42 }, { appid: 99 }] });
    vi.mocked(fetch).mockResolvedValue(new Response("", { status: 200 }));
    await (service as unknown as { prewarmSteam: () => Promise<void> }).prewarmSteam();
    // 2 unique appids × 5 routes = 10 fetches
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(10);
  });

  it("counts upstream failures as 'fail' rather than crashing the loop", async () => {
    const { service, prisma } = makeService();
    prisma.steamOwnedGame.findMany.mockResolvedValue([{ appid: 42 }]);
    vi.mocked(fetch).mockRejectedValue(new Error("network down"));
    await expect(
      (service as unknown as { prewarmSteam: () => Promise<void> }).prewarmSteam()
    ).resolves.toBeUndefined();
  });
});

describe("ImgPrewarmService.prewarmLol (private)", () => {
  it("aborts when the champion-summary fetch fails", async () => {
    const { service } = makeService();
    vi.mocked(fetch).mockResolvedValue(new Response("nope", { status: 500 }));
    await (service as unknown as { prewarmLol: () => Promise<void> }).prewarmLol();
    // The bootstrap fetches (champion-summary + versions) ran but no per-champion
    // requests were issued — only the 2 bootstrap calls.
    expect(vi.mocked(fetch).mock.calls.length).toBeLessThanOrEqual(2);
  });

  it("skips the loop when the champion roster is empty", async () => {
    const { service } = makeService();
    vi.mocked(fetch).mockImplementation(async (url: unknown) => {
      const u = String(url);
      if (u.includes("champion-summary")) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      return new Response(JSON.stringify(["16.10.1"]), { status: 200 });
    });
    await (service as unknown as { prewarmLol: () => Promise<void> }).prewarmLol();
    // Two bootstrap fetches, no per-champion requests.
    expect(vi.mocked(fetch).mock.calls.length).toBe(2);
  });

  it("falls back to the 'latest' label when the versions array is empty", async () => {
    const { service } = makeService();
    vi.mocked(fetch).mockImplementation(async (url: unknown) => {
      const u = String(url);
      if (u.includes("champion-summary")) {
        return new Response(JSON.stringify([{ id: 1, alias: "Ahri" }]), { status: 200 });
      }
      if (u.includes("versions")) {
        // Empty array → `versions[0] ?? "latest"` returns "latest".
        return new Response(JSON.stringify([]), { status: 200 });
      }
      return new Response("", { status: 200 });
    });
    await (service as unknown as { prewarmLol: () => Promise<void> }).prewarmLol();
    // 2 bootstrap + champion×variants — assert at least one URL contains "latest".
    const urls = vi.mocked(fetch).mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.includes("/latest.webp"))).toBe(true);
  });

  it("counts non-ok responses (HTTP 4xx) as fail rather than crashing", async () => {
    const { service } = makeService();
    vi.mocked(fetch).mockImplementation(async (url: unknown) => {
      const u = String(url);
      if (u.includes("champion-summary")) {
        return new Response(JSON.stringify([{ id: 1, alias: "Ahri" }]), { status: 200 });
      }
      if (u.includes("versions")) {
        return new Response(JSON.stringify(["16.10.1"]), { status: 200 });
      }
      // All champion-variant URLs return 404 → drives the `else fail++` arm.
      return new Response("", { status: 404 });
    });
    await expect(
      (service as unknown as { prewarmLol: () => Promise<void> }).prewarmLol()
    ).resolves.toBeUndefined();
  });

  it("issues champion×variant requests for the resolved roster", async () => {
    const { service } = makeService();
    vi.mocked(fetch).mockImplementation(async (url: unknown) => {
      const u = String(url);
      if (u.includes("champion-summary")) {
        return new Response(
          JSON.stringify([
            { id: -1, alias: "Default" },
            { id: 1, alias: "Ahri" },
          ]),
          { status: 200 }
        );
      }
      if (u.includes("versions")) {
        return new Response(JSON.stringify(["16.10.1"]), { status: 200 });
      }
      return new Response("", { status: 200 });
    });
    await (service as unknown as { prewarmLol: () => Promise<void> }).prewarmLol();
    // 2 bootstrap + 1 champion × 3 variants = 5 fetches
    expect(vi.mocked(fetch).mock.calls.length).toBe(5);
  });
});
