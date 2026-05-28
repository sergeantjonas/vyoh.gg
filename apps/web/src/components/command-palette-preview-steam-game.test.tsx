import { CommandPalettePreviewSteamGame } from "@/components/command-palette-preview-steam-game";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type {
  SteamGameCompletion,
  SteamLibraryCompletion,
  SteamOwnedGame,
  SteamOwnedGames,
} from "@vyoh/shared";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/steam/_shared/steam-image", () => ({
  steamLibraryCapsuleUrl: (appid: number) => `https://test/capsule/${appid}.webp`,
}));

function buildGame(overrides: Partial<SteamOwnedGame> = {}): SteamOwnedGame {
  return {
    appid: 570,
    name: "Dota 2",
    playtimeForeverMinutes: 60 * 120,
    playtime2WeeksMinutes: null,
    assetUrlFormat: null,
    assetTimestamp: 1000,
    libraryCapsulePath: null,
    libraryCapsule2xPath: null,
    libraryHeroPath: null,
    libraryHero2xPath: null,
    headerPath: null,
    heroCapsulePath: null,
    logoPath: null,
    appType: 0,
    tagIds: [],
    rtimeLastPlayedAt: null,
    shortDescription: null,
    steamDeckCompat: null,
    platformWindows: null,
    platformMac: null,
    platformLinux: null,
    platformVr: null,
    reviewSummary: null,
    gameRating: null,
    publisherNames: ["Valve"],
    developerNames: ["Valve"],
    franchiseNames: [],
    subjectXPercent: null,
    subjectYPercent: null,
    flipHero: false,
    dominantHex: null,
    recentPlaytimeMinutes: [],
    ...overrides,
  };
}

function buildCompletion(stats: SteamGameCompletion[]): SteamLibraryCompletion {
  return { stats };
}

function renderWithCache(
  ui: ReactNode,
  options: { owned?: SteamOwnedGames; completion?: SteamLibraryCompletion } = {}
) {
  const client = new QueryClient();
  if (options.owned) {
    client.setQueryData<SteamOwnedGames>(["steam", "owned-games"], options.owned);
  }
  if (options.completion) {
    client.setQueryData<SteamLibraryCompletion>(
      ["steam", "achievements", "library-completion"],
      options.completion
    );
  }
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("CommandPalettePreviewSteamGame", () => {
  it("renders nothing when the appid is not a finite number", () => {
    const { container } = renderWithCache(
      <CommandPalettePreviewSteamGame appid="not-a-number" />
    );
    expect(container.textContent).toBe("");
  });

  it("renders nothing when owned-games cache is empty", () => {
    const { container } = renderWithCache(<CommandPalettePreviewSteamGame appid="570" />);
    expect(container.textContent).toBe("");
  });

  it("renders the game name, developer, and lifetime playtime", () => {
    renderWithCache(<CommandPalettePreviewSteamGame appid="570" />, {
      owned: { games: [buildGame()], lastSyncedAt: null },
    });
    const preview = screen.getByTestId("command-palette-preview");
    expect(preview.textContent).toContain("Dota 2");
    expect(preview.textContent).toContain("Valve");
    expect(preview.textContent).toContain("120h lifetime");
  });

  it("shows achievement percent when completion data is cached", () => {
    renderWithCache(<CommandPalettePreviewSteamGame appid="570" />, {
      owned: { games: [buildGame()], lastSyncedAt: null },
      completion: buildCompletion([
        { appid: 570, total: 200, unlocked: 50, lastUnlockedAt: null },
      ]),
    });
    expect(screen.getByTestId("achievement-percent").textContent).toBe("25% unlocked");
  });

  it("omits achievement percent when completion data is missing", () => {
    renderWithCache(<CommandPalettePreviewSteamGame appid="570" />, {
      owned: { games: [buildGame()], lastSyncedAt: null },
    });
    expect(screen.queryByTestId("achievement-percent")).toBeNull();
  });

  it("tags preview with type for dispatch identification", () => {
    renderWithCache(<CommandPalettePreviewSteamGame appid="570" />, {
      owned: { games: [buildGame()], lastSyncedAt: null },
    });
    expect(
      screen.getByTestId("command-palette-preview").getAttribute("data-preview-type")
    ).toBe("steam-game");
  });
});
