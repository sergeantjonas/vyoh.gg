import { useAccountFromSlug } from "@/lol/_shared/account/use-account-from-slug";
import { useCarryProfile } from "@/lol/profile/use-carry-profile";
import { render, screen } from "@testing-library/react";
import type { CarryProfile, LolAccount } from "@vyoh/shared";
import { configureAxe } from "jest-axe";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProfileCarryProfile } from "./profile-carry-profile";

vi.mock("@/lol/_shared/account/use-account-from-slug", () => ({
  useAccountFromSlug: vi.fn(),
}));

vi.mock("@/lol/profile/use-carry-profile", () => ({
  useCarryProfile: vi.fn(),
}));

const account: LolAccount = {
  region: "euw1",
  gameName: "Jonas",
  tagLine: "EUW",
  slug: "jonas-euw",
};

function setData(opts: { data?: CarryProfile | undefined; isPending?: boolean }) {
  vi.mocked(useAccountFromSlug).mockReturnValue(account);
  vi.mocked(useCarryProfile).mockReturnValue({
    data: opts.data,
    isPending: opts.isPending ?? false,
  } as unknown as ReturnType<typeof useCarryProfile>);
}

function renderShell() {
  return render(<ProfileCarryProfile accountSlug="jonas-euw" />);
}

afterEach(() => {
  vi.mocked(useAccountFromSlug).mockReset();
  vi.mocked(useCarryProfile).mockReset();
});

describe("ProfileCarryProfile", () => {
  it("renders null while pending", () => {
    setData({ isPending: true, data: undefined });
    const { container } = renderShell();
    expect(container.firstChild).toBeNull();
  });

  it("renders null below the MIN_GAMES floor", () => {
    setData({
      data: {
        games: 6,
        topThree: { games: 4, wins: 3 },
        bottomTwo: { games: 2, wins: 1 },
      },
    });
    const { container } = renderShell();
    expect(container.firstChild).toBeNull();
  });

  it("renders the comparison verdict and per-tier win rates", () => {
    setData({
      data: {
        games: 20,
        topThree: { games: 12, wins: 9 }, // 75%
        bottomTwo: { games: 8, wins: 3 }, // 38%
      },
    });
    renderShell();
    expect(
      screen.getByText(
        /You win 75% of games when you're top-3 in your team's damage, and 38% when you're not\./
      )
    ).toBeTruthy();
    expect(screen.getByText("Top-3 Damage")).toBeTruthy();
    expect(screen.getByText("Bottom-2 Damage")).toBeTruthy();
    expect(screen.getByText("75")).toBeTruthy();
    expect(screen.getByText("38")).toBeTruthy();
  });

  it("reframes when the owner is always top-3 in team damage", () => {
    setData({
      data: {
        games: 14,
        topThree: { games: 14, wins: 10 },
        bottomTwo: { games: 0, wins: 0 },
      },
    });
    renderShell();
    expect(
      screen.getByText(
        /You're top-3 in your team's damage in every one of these 14 games/
      )
    ).toBeTruthy();
    // Empty tier shows an em dash rather than a fake 0% win rate.
    expect(screen.getByText("—")).toBeTruthy();
  });

  it("has no axe violations", async () => {
    setData({
      data: {
        games: 20,
        topThree: { games: 12, wins: 9 },
        bottomTwo: { games: 8, wins: 3 },
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
