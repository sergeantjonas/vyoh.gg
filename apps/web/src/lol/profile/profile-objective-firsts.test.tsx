import { useAccountFromSlug } from "@/lol/_shared/account/use-account-from-slug";
import { useObjectiveFirsts } from "@/lol/profile/use-objective-firsts";
import { render, screen } from "@testing-library/react";
import type { LolAccount, ObjectiveFirsts } from "@vyoh/shared";
import { configureAxe } from "jest-axe";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProfileObjectiveFirsts } from "./profile-objective-firsts";

vi.mock("@/lol/_shared/account/use-account-from-slug", () => ({
  useAccountFromSlug: vi.fn(),
}));

vi.mock("@/lol/profile/use-objective-firsts", () => ({
  useObjectiveFirsts: vi.fn(),
}));

const account: LolAccount = {
  region: "euw1",
  gameName: "Jonas",
  tagLine: "EUW",
  slug: "jonas-euw",
};

function setData(opts: { data?: ObjectiveFirsts | undefined; isPending?: boolean }) {
  vi.mocked(useAccountFromSlug).mockReturnValue(account);
  vi.mocked(useObjectiveFirsts).mockReturnValue({
    data: opts.data,
    isPending: opts.isPending ?? false,
  } as unknown as ReturnType<typeof useObjectiveFirsts>);
}

function renderShell() {
  return render(<ProfileObjectiveFirsts accountSlug="jonas-euw" />);
}

afterEach(() => {
  vi.mocked(useAccountFromSlug).mockReset();
  vi.mocked(useObjectiveFirsts).mockReset();
});

describe("ProfileObjectiveFirsts", () => {
  it("renders null while pending", () => {
    setData({ isPending: true, data: undefined });
    const { container } = renderShell();
    expect(container.firstChild).toBeNull();
  });

  it("renders null below the MIN_GAMES sample floor", () => {
    setData({
      data: {
        games: 5,
        firstBlood: { count: 2, wins: 1 },
        firstTower: { count: 3, wins: 2 },
      },
    });
    const { container } = renderShell();
    expect(container.firstChild).toBeNull();
  });

  it("renders first-blood and first-tower rates with win-when context", () => {
    setData({
      data: {
        games: 20,
        firstBlood: { count: 8, wins: 5 }, // 40% rate, 63% win-when
        firstTower: { count: 12, wins: 9 }, // 60% rate, 75% win-when
      },
    });
    renderShell();
    expect(screen.getByText("First Blood")).toBeTruthy();
    expect(screen.getByText("First Tower")).toBeTruthy();
    expect(screen.getByText("40")).toBeTruthy();
    expect(screen.getByText("60")).toBeTruthy();
    expect(screen.getByText("63% win when you do")).toBeTruthy();
    expect(screen.getByText("75% win when you do")).toBeTruthy();
  });

  it("shows an em dash when an objective never happened", () => {
    setData({
      data: {
        games: 15,
        firstBlood: { count: 0, wins: 0 },
        firstTower: { count: 6, wins: 4 },
      },
    });
    renderShell();
    expect(screen.getByText("—")).toBeTruthy();
  });

  it("has no axe violations", async () => {
    setData({
      data: {
        games: 20,
        firstBlood: { count: 8, wins: 5 },
        firstTower: { count: 12, wins: 9 },
      },
    });
    const axe = configureAxe({
      rules: {
        "color-contrast": { enabled: false },
        "aria-hidden-focus": { enabled: false },
      },
    });
    const { container } = renderShell();
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});
