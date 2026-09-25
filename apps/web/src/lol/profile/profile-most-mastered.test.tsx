import { render, screen } from "@testing-library/react";
import type { ChampionMasteryList } from "@vyoh/shared";
import { configureAxe } from "jest-axe";
import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProfileMostMastered } from "./profile-most-mastered";
import { useChampionMasteryList } from "./use-champion-mastery-list";

vi.mock("./use-champion-mastery-list", () => ({ useChampionMasteryList: vi.fn() }));

vi.mock("@/lol/champions/use-champions", () => ({
  useChampionName: () => (alias: string) => (alias === "MonkeyKing" ? "Wukong" : alias),
}));

vi.mock("@/lol/_shared/assets/champion-square-icon", () => ({
  ChampionSquareIcon: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    params,
  }: { children: ReactNode; params: { accountSlug: string; championKey: string } }) => (
    <a href={`/lol/${params.accountSlug}/champions/${params.championKey}`}>{children}</a>
  ),
}));

const axe = configureAxe({
  rules: {
    "color-contrast": { enabled: false },
    "aria-hidden-focus": { enabled: false },
  },
});

const entry = (alias: string, level: number, points: number) => ({
  alias,
  level,
  points,
  lastPlayedAt: "2026-09-10T20:00:00.000Z",
});

const LIST: ChampionMasteryList = {
  champions: [
    entry("Ahri", 105, 1_124_191),
    entry("MonkeyKing", 19, 228_511),
    entry("Lulu", 14, 168_625),
    entry("Janna", 9, 85_423),
  ],
};

function mockList(data: ChampionMasteryList | undefined) {
  vi.mocked(useChampionMasteryList).mockReturnValue({ data } as ReturnType<
    typeof useChampionMasteryList
  >);
}

function renderCard() {
  return render(
    <MotionConfig reducedMotion="always">
      <ProfileMostMastered accountSlug="ahri" />
    </MotionConfig>
  );
}

afterEach(() => {
  vi.mocked(useChampionMasteryList).mockReset();
});

describe("ProfileMostMastered", () => {
  it("draws nothing while loading, and nothing for an account with no mastery", () => {
    mockList(undefined);
    expect(renderCard().container.firstChild).toBeNull();
    mockList({ champions: [] });
    expect(renderCard().container.firstChild).toBeNull();
  });

  it("shows the top three by points, each linking to its champion page", () => {
    mockList(LIST);
    renderCard();
    const links = screen.getAllByRole("link");
    expect(links.map((a) => a.getAttribute("href"))).toEqual([
      "/lol/ahri/champions/ahri",
      "/lol/ahri/champions/monkeyking",
      "/lol/ahri/champions/lulu",
    ]);
    expect(links[0]?.textContent).toContain("Mastery 105");
    expect(links[0]?.textContent).toContain("1,124,191");
  });

  it("names champions by display name", () => {
    mockList(LIST);
    renderCard();
    expect(screen.getAllByRole("link")[1]?.textContent).toContain("Wukong");
  });

  it("has no axe violations", async () => {
    mockList(LIST);
    const { container } = renderCard();
    expect((await axe(container)).violations).toHaveLength(0);
  });
});
