import { render, screen } from "@testing-library/react";
import type { SteamLibrarySummary, SteamOwnedGames } from "@vyoh/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SteamStatBand } from "./steam-stat-band";

const libMock = vi.fn();
const ownedMock = vi.fn();

vi.mock("@/steam/use-library-summary", () => ({
  useSteamLibrarySummary: () => ({ data: libMock() }),
}));
vi.mock("@/steam/use-owned-games", () => ({
  useSteamOwnedGames: () => ({ data: ownedMock() }),
}));

function lib(overrides: Partial<SteamLibrarySummary> = {}): SteamLibrarySummary {
  return {
    ownedCount: 175,
    everLaunchedCount: 72,
    untouchedCount: 103,
    lastSyncedAt: "2026-05-30T00:00:00.000Z",
    ...overrides,
  };
}

function owned(): SteamOwnedGames {
  return {
    steamId: "76561198020053778",
    games: [
      { appid: 1, name: "ELDEN RING NIGHTREIGN", playtimeForeverMinutes: 26040 }, // 434h
      { appid: 2, name: "ELDEN RING", playtimeForeverMinutes: 22680 }, // 378h
    ],
    fetchedAt: "2026-05-30T00:00:00.000Z",
  } as unknown as SteamOwnedGames;
}

beforeEach(() => {
  libMock.mockReturnValue(lib());
  ownedMock.mockReturnValue(owned());
});

describe("SteamStatBand", () => {
  it("renders owned-games count", () => {
    render(<SteamStatBand />);
    expect(screen.getByText("175")).toBeTruthy();
    expect(screen.getByText("Games owned")).toBeTruthy();
  });

  it("sums total playtime across the library", () => {
    render(<SteamStatBand />);
    // (26040 + 22680) / 60 = 812h.
    expect(screen.getByText("812h")).toBeTruthy();
    expect(screen.getByText("Total playtime")).toBeTruthy();
  });

  it("shows the most-played game (games[0]) and its hours", () => {
    render(<SteamStatBand />);
    expect(screen.getByText("434h")).toBeTruthy();
    expect(screen.getByText("Most: ELDEN RING NIGHTREIGN")).toBeTruthy();
  });

  it("computes the library-played percentage", () => {
    render(<SteamStatBand />);
    // 72 / 175 = 41%.
    expect(screen.getByText("41%")).toBeTruthy();
    expect(screen.getByText("Library played")).toBeTruthy();
  });

  it("renders em-dash placeholders before data resolves", () => {
    libMock.mockReturnValue(undefined);
    ownedMock.mockReturnValue(undefined);
    render(<SteamStatBand />);
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });
});
