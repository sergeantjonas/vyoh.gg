import { useAccountFromSlug } from "@/lol/_shared/account/use-account-from-slug";
import { useDuos } from "@/lol/profile/use-duos";
import { render, screen } from "@testing-library/react";
import type { Duo, LolAccount } from "@vyoh/shared";
import { MotionConfig } from "motion/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RecapDuoOfYear } from "./recap-duo-of-year";

vi.mock("@/lol/_shared/assets/champion-square-icon", () => ({
  ChampionSquareIcon: ({ championName, alt }: { championName: string; alt: string }) => (
    <img alt={alt} data-champion={championName} />
  ),
}));

vi.mock("@/lol/champions/use-champions", () => ({
  useChampionName: () => (alias: string) => alias,
}));

vi.mock("@/lol/_shared/account/use-account-from-slug", () => ({
  useAccountFromSlug: vi.fn(),
}));

vi.mock("@/lol/profile/use-duos", () => ({
  useDuos: vi.fn(),
}));

const account: LolAccount = {
  region: "euw1",
  gameName: "Jonas",
  tagLine: "EUW",
  slug: "jonas-euw",
};

function mockHooks(duos: Duo[] | undefined): void {
  vi.mocked(useAccountFromSlug).mockReturnValue(account);
  vi.mocked(useDuos).mockReturnValue({
    data: duos,
  } as unknown as ReturnType<typeof useDuos>);
}

function renderDuo() {
  return render(
    <MotionConfig reducedMotion="always">
      <RecapDuoOfYear accountSlug="jonas-euw" />
    </MotionConfig>
  );
}

afterEach(() => {
  vi.mocked(useAccountFromSlug).mockReset();
  vi.mocked(useDuos).mockReset();
});

describe("RecapDuoOfYear", () => {
  it("renders the empty placeholder when no duo data has come back yet", () => {
    mockHooks(undefined);
    renderDuo();
    expect(
      screen.getByText(/Once you've queued five or more games with the same teammate/)
    ).toBeTruthy();
  });

  it("renders the empty placeholder when the top duo has fewer than MIN_GAMES_FOR_DUO (5)", () => {
    mockHooks([
      {
        puuid: "p",
        gameName: "Friend",
        tagLine: "EUW",
        games: 4,
        wins: 3,
        topChampion: "Lulu",
      },
    ]);
    renderDuo();
    expect(
      screen.getByText(/Once you've queued five or more games with the same teammate/)
    ).toBeTruthy();
  });

  it("renders the top duo with WR and W/L pair when the threshold is met", () => {
    mockHooks([
      {
        puuid: "p",
        gameName: "Friend",
        tagLine: "EUW",
        games: 10,
        wins: 6,
        topChampion: "Lulu",
      },
    ]);
    renderDuo();
    expect(screen.getByText("Friend")).toBeTruthy();
    expect(screen.getByText("#EUW")).toBeTruthy();
    expect(screen.getByText(/10 games · 60% win rate · most on Lulu/)).toBeTruthy();
    expect(screen.getByText("6W")).toBeTruthy();
    expect(screen.getByText("4L")).toBeTruthy();
  });
});
