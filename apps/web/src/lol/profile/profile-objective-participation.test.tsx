import { useAccountFromSlug } from "@/lol/_shared/account/use-account-from-slug";
import { useObjectiveParticipation } from "@/lol/profile/use-objective-participation";
import { render, screen } from "@testing-library/react";
import type { LolAccount, ObjectiveParticipation } from "@vyoh/shared";
import { configureAxe } from "jest-axe";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProfileObjectiveParticipation } from "./profile-objective-participation";

vi.mock("@/lol/_shared/account/use-account-from-slug", () => ({
  useAccountFromSlug: vi.fn(),
}));

vi.mock("@/lol/profile/use-objective-participation", () => ({
  useObjectiveParticipation: vi.fn(),
}));

const account: LolAccount = {
  region: "euw1",
  gameName: "Jonas",
  tagLine: "EUW",
  slug: "jonas-euw",
};

function setData(opts: {
  data?: ObjectiveParticipation | undefined;
  isPending?: boolean;
}) {
  vi.mocked(useAccountFromSlug).mockReturnValue(account);
  vi.mocked(useObjectiveParticipation).mockReturnValue({
    data: opts.data,
    isPending: opts.isPending ?? false,
  } as unknown as ReturnType<typeof useObjectiveParticipation>);
}

function renderShell() {
  return render(<ProfileObjectiveParticipation accountSlug="jonas-euw" />);
}

afterEach(() => {
  vi.mocked(useAccountFromSlug).mockReset();
  vi.mocked(useObjectiveParticipation).mockReset();
});

describe("ProfileObjectiveParticipation", () => {
  it("renders null while pending", () => {
    setData({ isPending: true, data: undefined });
    const { container } = renderShell();
    expect(container.firstChild).toBeNull();
  });

  it("renders null below the MIN_GAMES sample floor", () => {
    setData({
      data: {
        games: 5,
        dragons: { takedowns: 6, teamKills: 10, games: 5 },
        barons: { takedowns: 1, teamKills: 2, games: 2 },
        heralds: { takedowns: 2, teamKills: 4, games: 4 },
      },
    });
    const { container } = renderShell();
    expect(container.firstChild).toBeNull();
  });

  it("renders participation rates with a takedowns-of-kills context", () => {
    setData({
      data: {
        games: 20,
        dragons: { takedowns: 30, teamKills: 50, games: 20 }, // 60%
        barons: { takedowns: 8, teamKills: 10, games: 9 }, // 80%
        heralds: { takedowns: 5, teamKills: 12, games: 11 }, // 42%
      },
    });
    renderShell();
    expect(screen.getByText("Dragons")).toBeTruthy();
    expect(screen.getByText("Barons")).toBeTruthy();
    expect(screen.getByText("Heralds")).toBeTruthy();
    expect(screen.getByText("60")).toBeTruthy();
    expect(screen.getByText("80")).toBeTruthy();
    expect(screen.getByText("42")).toBeTruthy();
    expect(screen.getByText("30 of 50")).toBeTruthy();
    expect(screen.getByText("8 of 10")).toBeTruthy();
    expect(screen.getByText("5 of 12")).toBeTruthy();
  });

  it("shows an em dash when an objective was never contested", () => {
    setData({
      data: {
        games: 15,
        dragons: { takedowns: 20, teamKills: 30, games: 15 },
        barons: { takedowns: 0, teamKills: 0, games: 0 }, // never taken in sample
        heralds: { takedowns: 6, teamKills: 10, games: 9 },
      },
    });
    renderShell();
    expect(screen.getByText("—")).toBeTruthy();
  });

  it("has no axe violations", async () => {
    setData({
      data: {
        games: 20,
        dragons: { takedowns: 30, teamKills: 50, games: 20 },
        barons: { takedowns: 8, teamKills: 10, games: 9 },
        heralds: { takedowns: 5, teamKills: 12, games: 11 },
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
