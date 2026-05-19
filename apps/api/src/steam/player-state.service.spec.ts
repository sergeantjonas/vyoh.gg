import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import type { SteamPlaySessionsService } from "./play-sessions.service";
import { SteamPlayerStateService } from "./player-state.service";
import type { SteamClientService } from "./steam-client.service";

interface PrismaStubs {
  steamPlayerState: { findUnique: ReturnType<typeof vi.fn> };
  steamPlaytimeSnapshot: { findFirst: ReturnType<typeof vi.fn> };
}

function makeService(prisma: PrismaStubs): SteamPlayerStateService {
  return new SteamPlayerStateService(
    prisma as unknown as PrismaService,
    {} as SteamClientService,
    {} as SteamPlaySessionsService
  );
}

function makePrisma(): PrismaStubs {
  return {
    steamPlayerState: { findUnique: vi.fn() },
    steamPlaytimeSnapshot: { findFirst: vi.fn() },
  };
}

const BASE_ROW = {
  steamId: "76561198020053778",
  personaName: "Vyoh",
  avatarUrl: "https://example.com/avatar_full.jpg",
  personaState: "online",
  profileVisibility: 3,
  currentAppid: null as number | null,
  currentGameName: null as string | null,
  lastPolledAt: new Date("2026-05-16T12:00:00.000Z"),
};

describe("SteamPlayerStateService.getPlayerState", () => {
  it("returns null when no row exists for the owner", async () => {
    const prisma = makePrisma();
    prisma.steamPlayerState.findUnique.mockResolvedValue(null);

    await expect(makeService(prisma).getPlayerState()).resolves.toBeNull();
    expect(prisma.steamPlaytimeSnapshot.findFirst).not.toHaveBeenCalled();
  });

  it("projects an offline row without an active game and skips the snapshot lookup", async () => {
    const prisma = makePrisma();
    prisma.steamPlayerState.findUnique.mockResolvedValue({
      ...BASE_ROW,
      personaState: "offline",
    });

    const state = await makeService(prisma).getPlayerState();
    expect(state).toEqual({
      steamId: BASE_ROW.steamId,
      personaName: "Vyoh",
      avatarUrl: BASE_ROW.avatarUrl,
      personaState: "offline",
      profileVisibility: 3,
      currentGame: null,
      currentGamePlaytimeForeverMinutes: null,
      lastPolledAt: BASE_ROW.lastPolledAt.toISOString(),
    });
    expect(prisma.steamPlaytimeSnapshot.findFirst).not.toHaveBeenCalled();
  });

  it("joins the latest playtime snapshot when the owner is in-game", async () => {
    const prisma = makePrisma();
    prisma.steamPlayerState.findUnique.mockResolvedValue({
      ...BASE_ROW,
      currentAppid: 730,
      currentGameName: "Counter-Strike 2",
    });
    prisma.steamPlaytimeSnapshot.findFirst.mockResolvedValue({
      playtimeForeverMinutes: 4_320,
    });

    const state = await makeService(prisma).getPlayerState();
    expect(state).toMatchObject({
      currentGame: { appid: 730, name: "Counter-Strike 2" },
      currentGamePlaytimeForeverMinutes: 4_320,
    });
    expect(prisma.steamPlaytimeSnapshot.findFirst).toHaveBeenCalledWith({
      where: { appid: 730 },
      orderBy: { snapshotDate: "desc" },
      select: { playtimeForeverMinutes: true },
    });
  });

  it("falls back to `App {id}` when in-game but Steam reported no game name", async () => {
    const prisma = makePrisma();
    prisma.steamPlayerState.findUnique.mockResolvedValue({
      ...BASE_ROW,
      currentAppid: 730,
      currentGameName: null,
    });
    prisma.steamPlaytimeSnapshot.findFirst.mockResolvedValue(null);

    const state = await makeService(prisma).getPlayerState();
    expect(state?.currentGame).toEqual({ appid: 730, name: "App 730" });
    // Snapshot lookup returned nothing (family-share / demo / fresh-DB) →
    // playtime stays null.
    expect(state?.currentGamePlaytimeForeverMinutes).toBeNull();
  });
});

describe("SteamPlayerStateService.syncPlayerState", () => {
  function makeSyncService(opts: {
    player?: {
      steamid: string;
      personaname: string;
      avatarfull: string;
      personastate: 0 | 1 | 2 | 3 | 4 | 5 | 6;
      communityvisibilitystate: 1 | 2 | 3;
      gameid?: string;
      gameextrainfo?: string;
    } | null;
    previousRow?: { currentAppid: number | null; lastPolledAt: Date } | null;
  }) {
    const getPlayerSummary = vi.fn().mockResolvedValue(opts.player);
    const upsert = vi.fn().mockResolvedValue({});
    const findUnique = vi.fn().mockResolvedValue(opts.previousRow ?? null);
    const recordTransition = vi.fn().mockResolvedValue(undefined);
    const prisma = {
      steamPlayerState: { findUnique, upsert },
      steamPlaytimeSnapshot: { findFirst: vi.fn() },
    } as unknown as PrismaService;
    const client = { getPlayerSummary } as unknown as SteamClientService;
    const playSessions = {
      recordTransition,
    } as unknown as SteamPlaySessionsService;
    const service = new SteamPlayerStateService(prisma, client, playSessions);
    return { service, getPlayerSummary, upsert, findUnique, recordTransition };
  }

  it("warns and returns early when Steam returns no player", async () => {
    const { service, upsert, recordTransition } = makeSyncService({ player: null });
    await service.syncPlayerState();
    expect(upsert).not.toHaveBeenCalled();
    expect(recordTransition).not.toHaveBeenCalled();
  });

  it("calls recordTransition before upserting, with null previous on fresh DB", async () => {
    const order: string[] = [];
    const { service, upsert, recordTransition } = makeSyncService({
      player: {
        steamid: "76561198020053778",
        personaname: "Vyoh",
        avatarfull: "https://x/a_full.jpg",
        personastate: 1,
        communityvisibilitystate: 3,
        gameid: "1030300",
        gameextrainfo: "Hollow Knight: Silksong",
      },
      previousRow: null,
    });
    recordTransition.mockImplementation(async () => {
      order.push("transition");
    });
    upsert.mockImplementation(async () => {
      order.push("upsert");
    });
    await service.syncPlayerState();
    expect(order).toEqual(["transition", "upsert"]);
    expect(recordTransition).toHaveBeenCalledWith({
      previous: null,
      next: { appid: 1030300, gameName: "Hollow Knight: Silksong" },
    });
  });

  it("normalizes a null gameid to null appid and forwards prior state", async () => {
    const prevDate = new Date("2026-05-16T11:58:00.000Z");
    const { service, upsert, recordTransition } = makeSyncService({
      player: {
        steamid: "76561198020053778",
        personaname: "Vyoh",
        avatarfull: "https://x/a_full.jpg",
        personastate: 3,
        communityvisibilitystate: 3,
        // gameid omitted — owner left the game.
      },
      previousRow: { currentAppid: 730, lastPolledAt: prevDate },
    });
    await service.syncPlayerState();
    expect(recordTransition).toHaveBeenCalledWith({
      previous: { appid: 730, lastPolledAt: prevDate },
      next: { appid: null, gameName: null },
    });
    const upsertArg = upsert.mock.calls[0]?.[0] as {
      update: { personaState: string; currentAppid: number | null };
    };
    expect(upsertArg.update.personaState).toBe("away");
    expect(upsertArg.update.currentAppid).toBeNull();
  });
});
