import { useAccountFromSlug } from "@/lol/_shared/account/use-account-from-slug";
import { useAramProfile } from "@/lol/profile/use-aram-profile";
import { render, screen } from "@testing-library/react";
import type { AramProfile, LolAccount } from "@vyoh/shared";
import { configureAxe } from "jest-axe";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProfileAramDashboard } from "./profile-aram-dashboard";

vi.mock("@/lol/_shared/account/use-account-from-slug", () => ({
  useAccountFromSlug: vi.fn(),
}));

vi.mock("@/lol/profile/use-aram-profile", () => ({
  useAramProfile: vi.fn(),
}));

vi.mock("@/lol/champions/use-champions", () => ({
  useChampionName: () => (alias: string) => alias,
}));

// Stub the champion icon so the test doesn't pull in DDragon-version plumbing.
vi.mock("@/lol/_shared/assets/champion-square-icon", () => ({
  // Text-free stub so it doesn't double-match the champion-name spans below.
  ChampionSquareIcon: () => <span data-testid="champ-icon" />,
}));

const account: LolAccount = {
  region: "euw1",
  gameName: "Jonas",
  tagLine: "EUW",
  slug: "jonas-euw",
};

function setData(opts: { data?: AramProfile | undefined; isPending?: boolean }) {
  vi.mocked(useAccountFromSlug).mockReturnValue(account);
  vi.mocked(useAramProfile).mockReturnValue({
    data: opts.data,
    isPending: opts.isPending ?? false,
  } as unknown as ReturnType<typeof useAramProfile>);
}

function renderShell() {
  return render(<ProfileAramDashboard accountSlug="jonas-euw" />);
}

const populated: AramProfile = {
  games: 30,
  wins: 18, // 60% WR
  kills: 240,
  deaths: 120,
  assists: 360, // KDA (240+360)/120 = 5.00
  healAndShield: 360_000, // avg 12.0k
  damageTaken: 900_000, // avg 30.0k
  selfMitigated: 450_000, // avg 15.0k
  damageToChampions: 600_000,
  topChampions: [
    { championName: "Jhin", games: 18, wins: 12 },
    { championName: "Lux", games: 8, wins: 4 },
  ],
};

afterEach(() => {
  vi.mocked(useAccountFromSlug).mockReset();
  vi.mocked(useAramProfile).mockReset();
});

describe("ProfileAramDashboard", () => {
  it("renders null while pending", () => {
    setData({ isPending: true, data: undefined });
    const { container } = renderShell();
    expect(container.firstChild).toBeNull();
  });

  it("renders null below the MIN_GAMES sample floor", () => {
    setData({ data: { ...populated, games: 5 } });
    const { container } = renderShell();
    expect(container.firstChild).toBeNull();
  });

  it("renders ARAM win rate, KDA and per-game sustain", () => {
    setData({ data: populated });
    renderShell();
    expect(screen.getByText("ARAM")).toBeTruthy();
    expect(screen.getByText("30")).toBeTruthy(); // games
    expect(screen.getByText("60")).toBeTruthy(); // win rate
    expect(screen.getByText("5.00")).toBeTruthy(); // KDA
    expect(screen.getByText("12.0k")).toBeTruthy(); // heal+shield avg
    expect(screen.getByText("30.0k")).toBeTruthy(); // dmg taken avg
    expect(screen.getByText("15.0k")).toBeTruthy(); // self-mitigated avg
  });

  it("lists the most-played ARAM champions", () => {
    setData({ data: populated });
    renderShell();
    expect(screen.getByText("Jhin")).toBeTruthy();
    expect(screen.getByText("Lux")).toBeTruthy();
  });

  it("has no axe violations", async () => {
    setData({ data: populated });
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
