import { render, screen } from "@testing-library/react";
import type { AccountHistory } from "@vyoh/shared";
import { configureAxe } from "jest-axe";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProfileHistoryChips } from "./profile-history-chips";
import { useAccountHistory } from "./use-account-history";

vi.mock("./use-account-history", () => ({ useAccountHistory: vi.fn() }));

vi.mock("@/lol/champions/use-champions", () => ({
  useChampionName: () => (alias: string) => (alias === "MonkeyKing" ? "Wukong" : alias),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    params,
    className,
  }: {
    children: ReactNode;
    params: { accountSlug: string; matchId: string };
    className?: string;
  }) => (
    <a
      className={className}
      href={`/lol/${params.accountSlug}/matches/${params.matchId}`}
    >
      {children}
    </a>
  ),
}));

const axe = configureAxe({
  rules: {
    "color-contrast": { enabled: false },
    "aria-hidden-focus": { enabled: false },
  },
});

const HISTORY: AccountHistory = {
  totalGames: 6449,
  firstGame: {
    matchId: "EUW1_1",
    // 00:30 on 1 June in Brussels, still 31 May in UTC.
    playedAt: "2024-05-31T22:30:00.000Z",
    champion: "MonkeyKing",
    queueId: 450,
    win: false,
  },
};

function mockHistory(data: AccountHistory | undefined) {
  vi.mocked(useAccountHistory).mockReturnValue({ data } as ReturnType<
    typeof useAccountHistory
  >);
}

afterEach(() => {
  vi.mocked(useAccountHistory).mockReset();
});

describe("ProfileHistoryChips", () => {
  it("draws nothing while loading, and nothing for an account with no games", () => {
    mockHistory(undefined);
    expect(
      render(<ProfileHistoryChips accountSlug="ahri" />).container.firstChild
    ).toBeNull();
    mockHistory({ totalGames: 0, firstGame: null });
    expect(
      render(<ProfileHistoryChips accountSlug="ahri" />).container.firstChild
    ).toBeNull();
  });

  it("counts the tracked games since the first one", () => {
    mockHistory(HISTORY);
    render(<ProfileHistoryChips accountSlug="ahri" />);
    expect(screen.getByText("6,449 games tracked since 1 Jun 2024")).toBeTruthy();
  });

  it("says game, not games, for an account with one", () => {
    mockHistory({ ...HISTORY, totalGames: 1 });
    render(<ProfileHistoryChips accountSlug="ahri" />);
    expect(screen.getByText("1 game tracked since 1 Jun 2024")).toBeTruthy();
  });

  it("links the first game, named by champion display name and queue", () => {
    mockHistory(HISTORY);
    render(<ProfileHistoryChips accountSlug="ahri" />);
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe("/lol/ahri/matches/EUW1_1");
    expect(link.textContent).toBe("First game: Wukong · ARAM · loss");
  });

  it("has no axe violations", async () => {
    mockHistory(HISTORY);
    const { container } = render(<ProfileHistoryChips accountSlug="ahri" />);
    expect((await axe(container)).violations).toHaveLength(0);
  });
});
