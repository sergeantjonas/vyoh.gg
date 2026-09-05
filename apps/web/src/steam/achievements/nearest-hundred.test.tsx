import { useCompletionCandidates } from "@/steam/use-completion-candidates";
import { useSteamOwnedGames } from "@/steam/use-owned-games";
import { render, screen } from "@testing-library/react";
import type { SteamCompletionCandidate, SteamOwnedGame } from "@vyoh/shared";
import { configureAxe } from "jest-axe";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NEAREST_HUNDRED_LIMIT, NearestHundred } from "./nearest-hundred";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: { children: ReactNode }) => (
    <a {...(props as Record<string, string>)}>{children}</a>
  ),
}));

vi.mock("@/steam/use-completion-candidates", () => ({
  useCompletionCandidates: vi.fn(),
}));

vi.mock("@/steam/use-owned-games", () => ({
  useSteamOwnedGames: vi.fn(),
}));

const axe = configureAxe({ rules: { "color-contrast": { enabled: false } } });

function game(appid: number, name: string): SteamOwnedGame {
  return { appid, name, assetTimestamp: null } as unknown as SteamOwnedGame;
}

function candidate(
  appid: number,
  remaining: number,
  total: number,
  rarity: { avg: number | null; min: number | null } = { avg: 50, min: 50 }
): SteamCompletionCandidate {
  return {
    appid,
    total,
    unlocked: total - remaining,
    remaining,
    remainingAvgPercent: rarity.avg,
    remainingMinPercent: rarity.min,
    score: remaining * 0.5,
  };
}

function mock(
  candidates: {
    data?: { candidates: SteamCompletionCandidate[] };
    isPending?: boolean;
    isError?: boolean;
  },
  owned: { data?: { games: SteamOwnedGame[] }; isPending?: boolean; isError?: boolean }
) {
  vi.mocked(useCompletionCandidates).mockReturnValue({
    data: candidates.data,
    isPending: candidates.isPending ?? false,
    isError: candidates.isError ?? false,
  } as unknown as ReturnType<typeof useCompletionCandidates>);
  vi.mocked(useSteamOwnedGames).mockReturnValue({
    data: owned.data,
    isPending: owned.isPending ?? false,
    isError: owned.isError ?? false,
  } as unknown as ReturnType<typeof useSteamOwnedGames>);
}

afterEach(() => {
  vi.mocked(useCompletionCandidates).mockReset();
  vi.mocked(useSteamOwnedGames).mockReset();
});

describe("NearestHundred", () => {
  it("renders nothing while either query is pending", () => {
    mock({ isPending: true }, { data: { games: [] } });
    expect(render(<NearestHundred />).container.firstChild).toBeNull();
  });

  it("renders nothing on error", () => {
    mock({ isError: true }, { data: { games: [] } });
    expect(render(<NearestHundred />).container.firstChild).toBeNull();
  });

  it("renders nothing when no candidate resolves to an owned game", () => {
    mock(
      { data: { candidates: [candidate(1, 2, 10)] } },
      { data: { games: [game(2, "B")] } }
    );
    expect(render(<NearestHundred />).container.firstChild).toBeNull();
  });

  it("keeps the server order, ranks the rows and states what is left", () => {
    mock(
      {
        data: {
          candidates: [
            candidate(1, 1, 12, { avg: 62, min: 62 }),
            candidate(2, 3, 40, { avg: 30.4, min: 8 }),
            candidate(3, 2, 5, { avg: null, min: null }),
          ],
        },
      },
      { data: { games: [game(1, "Portal"), game(2, "Hades"), game(3, "Unpolled")] } }
    );
    const { container } = render(<NearestHundred />);
    const rows = container.querySelectorAll("li");
    expect(rows[0]?.textContent).toContain("Portal");
    expect(rows[1]?.textContent).toContain("Hades");
    expect(rows[2]?.textContent).toContain("Unpolled");
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Nearest 100%3");
    expect(rows[0]?.textContent).toContain("of 12 left");
    expect(rows[0]?.textContent).toContain("62% of players have them");
    expect(rows[1]?.textContent).toContain("30% avg · rarest 8.0%");
    expect(rows[2]?.textContent).toContain("rarity not polled yet");
  });

  it("caps the list and skips candidates the owned-games list cannot name", () => {
    const candidates = Array.from({ length: NEAREST_HUNDRED_LIMIT + 3 }, (_, i) =>
      candidate(i + 1, 1, 10)
    );
    const games = candidates
      .filter((c) => c.appid !== 2)
      .map((c) => game(c.appid, `G${c.appid}`));
    mock({ data: { candidates } }, { data: { games } });
    const { container } = render(<NearestHundred />);
    const names = [...container.querySelectorAll("li")].map(
      (li) => li.querySelector("p")?.textContent
    );
    expect(names).toHaveLength(NEAREST_HUNDRED_LIMIT);
    // The badge counts the whole candidate set, not the rows on screen.
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(
      `Nearest 100%${NEAREST_HUNDRED_LIMIT + 3}`
    );
    expect(names).not.toContain("G2");
    expect(names[0]).toBe("G1");
    expect(names[1]).toBe("G3");
  });

  it("has no axe violations", async () => {
    mock(
      { data: { candidates: [candidate(1, 1, 12)] } },
      { data: { games: [game(1, "Portal")] } }
    );
    const { container } = render(<NearestHundred />);
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});
