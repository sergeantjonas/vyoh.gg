import { useAccountFromSlug } from "@/lol/_shared/account/use-account-from-slug";
import { useDuos } from "@/lol/profile/use-duos";
import { render, screen } from "@testing-library/react";
import type { Duo, LolAccount } from "@vyoh/shared";
import { MotionConfig } from "motion/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProfileDuos } from "./profile-duos";

vi.mock("@/lol/_shared/account/use-account-from-slug", () => ({
  useAccountFromSlug: vi.fn(),
}));

vi.mock("@/lol/profile/use-duos", () => ({
  useDuos: vi.fn(),
}));

vi.mock("@/lol/_shared/assets/champion-square-icon", () => ({
  ChampionSquareIcon: ({ championName }: { championName: string }) => (
    <img alt={championName} data-champion={championName} />
  ),
}));

const account: LolAccount = {
  region: "euw1",
  gameName: "Jonas",
  tagLine: "EUW",
  slug: "jonas-euw",
};

function mockDuos(value: { data: Duo[] | undefined; isPending: boolean }): void {
  vi.mocked(useAccountFromSlug).mockReturnValue(account);
  vi.mocked(useDuos).mockReturnValue(value as unknown as ReturnType<typeof useDuos>);
}

function duo(overrides: Partial<Duo> = {}): Duo {
  return {
    puuid: "p1",
    gameName: "Other",
    tagLine: "EUW",
    games: 10,
    wins: 6,
    topChampion: "Yasuo",
    ...overrides,
  };
}

function renderDuos() {
  return render(
    <MotionConfig reducedMotion="always">
      <ProfileDuos accountSlug="jonas-euw" />
    </MotionConfig>
  );
}

afterEach(() => {
  vi.mocked(useAccountFromSlug).mockReset();
  vi.mocked(useDuos).mockReset();
});

describe("ProfileDuos", () => {
  it("renders nothing while the duos query is pending", () => {
    mockDuos({ data: undefined, isPending: true });
    const { container } = renderDuos();
    expect(container.firstChild).toBeNull();
  });

  it("renders the empty state with the 'mostly solo' hint when no duos exist", () => {
    mockDuos({ data: [], isPending: false });
    renderDuos();
    expect(screen.getByText("No recurring duo detected")).toBeTruthy();
    expect(screen.getByText("You mostly queue solo in this window.")).toBeTruthy();
  });

  it("renders up to 3 duo rows with win/loss split and WR", () => {
    mockDuos({
      data: [
        duo({ puuid: "p1", gameName: "A", games: 10, wins: 6 }),
        duo({ puuid: "p2", gameName: "B", games: 8, wins: 4 }),
        duo({ puuid: "p3", gameName: "C", games: 5, wins: 3 }),
        duo({ puuid: "p4", gameName: "D", games: 4, wins: 2 }),
      ],
      isPending: false,
    });
    const { container } = renderDuos();
    expect(screen.getByText("A")).toBeTruthy();
    expect(screen.getByText("B")).toBeTruthy();
    expect(screen.getByText("C")).toBeTruthy();
    // 4th is past DISPLAY_COUNT = 3.
    expect(screen.queryByText("D")).toBeNull();
    expect(container.textContent).toContain("60% WR");
  });
});
