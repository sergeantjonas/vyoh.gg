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
