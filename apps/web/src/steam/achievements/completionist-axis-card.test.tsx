import { useLibraryCompletion } from "@/steam/use-library-completion";
import { useSteamOwnedGames } from "@/steam/use-owned-games";
import { useSteamTags } from "@/steam/use-tags";
import { render, screen } from "@testing-library/react";
import type { SteamGameCompletion, SteamOwnedGame } from "@vyoh/shared";
import { MotionConfig } from "motion/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CompletionistAxisCard } from "./completionist-axis-card";

vi.mock("@/steam/use-library-completion", () => ({
  useLibraryCompletion: vi.fn(),
}));

vi.mock("@/steam/use-owned-games", () => ({
  useSteamOwnedGames: vi.fn(),
}));

vi.mock("@/steam/use-tags", () => ({
  useSteamTags: vi.fn(),
}));

function stat(appid: number, unlocked: number, total: number): SteamGameCompletion {
  return { appid, unlocked, total, lastUnlockedAt: null } as SteamGameCompletion;
}

function game(appid: number, tagIds: number[] = []): SteamOwnedGame {
  return {
    appid,
    name: `Game ${appid}`,
    playtimeForeverMinutes: 0,
    playtime2WeeksMinutes: 0,
    rtimeLastPlayedAt: null,
    iconHash: null,
    appType: 0,
    assetTimestamp: null,
    tagIds,
  } as unknown as SteamOwnedGame;
}

type Tag = { id: number; name: string };

function mock(value: {
  completion?: {
    data?: { stats: SteamGameCompletion[] };
    isPending?: boolean;
    isError?: boolean;
  };
  owned?: { data?: { games: SteamOwnedGame[] } };
  tags?: { data?: { tags: Tag[] } };
}) {
  vi.mocked(useLibraryCompletion).mockReturnValue({
    data: value.completion?.data,
    isPending: value.completion?.isPending ?? false,
    isError: value.completion?.isError ?? false,
  } as unknown as ReturnType<typeof useLibraryCompletion>);
  vi.mocked(useSteamOwnedGames).mockReturnValue({
    data: value.owned?.data,
  } as unknown as ReturnType<typeof useSteamOwnedGames>);
  vi.mocked(useSteamTags).mockReturnValue({
    data: value.tags?.data,
  } as unknown as ReturnType<typeof useSteamTags>);
}

function renderCard() {
  return render(
    <MotionConfig reducedMotion="always">
      <CompletionistAxisCard />
    </MotionConfig>
  );
}

afterEach(() => {
  vi.mocked(useLibraryCompletion).mockReset();
  vi.mocked(useSteamOwnedGames).mockReset();
  vi.mocked(useSteamTags).mockReset();
});

describe("CompletionistAxisCard", () => {
  it("renders the pending placeholder while completion is loading", () => {
    mock({ completion: { isPending: true } });
    renderCard();
    expect(screen.getByText("Reading the library…")).toBeTruthy();
  });

  it("renders the error placeholder on completion error", () => {
    mock({ completion: { isError: true } });
    renderCard();
    expect(screen.getByText("Couldn't read the library this time.")).toBeTruthy();
  });

  it("renders the under-sample placeholder when the cohort has fewer than 5 games", () => {
    mock({
      completion: {
        data: {
          stats: [stat(1, 5, 10), stat(2, 3, 5), stat(3, 1, 1), stat(4, 5, 10)],
        },
      },
    });
    renderCard();
    expect(screen.getByText("Not enough progress yet to call it.")).toBeTruthy();
  });

  it("emits the 'Hard completionist' band when library median is at least 90", () => {
    // 5 games all at 95%/100% → median high.
    mock({
      completion: {
        data: {
          stats: [
            stat(1, 95, 100),
            stat(2, 95, 100),
            stat(3, 95, 100),
            stat(4, 95, 100),
            stat(5, 95, 100),
          ],
        },
      },
    });
    renderCard();
    expect(screen.getByText("Hard completionist")).toBeTruthy();
  });

  it("emits 'Pulls a few, drops it' for very low medians", () => {
    mock({
      completion: {
        data: {
          stats: [
            stat(1, 1, 100),
            stat(2, 2, 100),
            stat(3, 3, 100),
            stat(4, 4, 100),
            stat(5, 5, 100),
          ],
        },
      },
    });
    renderCard();
    expect(screen.getByText("Pulls a few, drops it")).toBeTruthy();
  });

  it("calls out a tag slice when its median beats the library median by 15+ points", () => {
    // Library median ~10%; Roguelike tag at 100% across 3+ games.
    mock({
      completion: {
        data: {
          stats: [
            stat(1, 5, 100),
            stat(2, 10, 100),
            stat(3, 15, 100),
            stat(4, 100, 100),
            stat(5, 100, 100),
            stat(6, 100, 100),
          ],
        },
      },
      owned: {
        data: {
          games: [
            game(1, [2]),
            game(2, [2]),
            game(3, [2]),
            game(4, [1]),
            game(5, [1]),
            game(6, [1]),
          ],
        },
      },
      tags: {
        data: {
          tags: [
            { id: 1, name: "Roguelike" },
            { id: 2, name: "Other" },
          ],
        },
      },
    });
    renderCard();
    expect(screen.getByText(/except Roguelike/)).toBeTruthy();
  });
});
