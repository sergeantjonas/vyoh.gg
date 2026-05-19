import { useAccountFromSlug } from "@/lol/_shared/account/use-account-from-slug";
import { useChampionPairs } from "@/lol/profile/use-champion-pairs";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { render, screen } from "@testing-library/react";
import type { ChampionPair, LolAccount } from "@vyoh/shared";
import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProfileSynergy } from "./profile-synergy";

vi.mock("@/lol/_shared/account/use-account-from-slug", () => ({
  useAccountFromSlug: vi.fn(),
}));

vi.mock("@/lol/profile/use-champion-pairs", () => ({
  useChampionPairs: vi.fn(),
}));

vi.mock("@/lol/_shared/patch/use-ddragon-version", () => ({
  useDDragonVersion: () => "15.1.1",
}));

vi.mock("@/lol/_shared/assets/champion-icon", () => ({
  championSquareIconUrl: (champ: string) => `/icon/${champ}.png`,
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: { children: ReactNode } & Record<string, unknown>) => (
    <a {...(props as Record<string, unknown>)}>{children}</a>
  ),
}));

vi.mock("@visx/responsive", () => ({
  ParentSize: ({ children }: { children: (size: { width: number }) => ReactNode }) =>
    children({ width: 400 }),
}));

const account: LolAccount = {
  region: "euw1",
  gameName: "Jonas",
  tagLine: "EUW",
  slug: "jonas-euw",
};

function pair(overrides: Partial<ChampionPair> = {}): ChampionPair {
  return {
    yourChamp: "Ahri",
    teammateChamp: "Lux",
    games: 5,
    wins: 3,
    ...overrides,
  } as ChampionPair;
}

function setPairs(opts: { data: ChampionPair[] | undefined; isPending?: boolean }) {
  vi.mocked(useAccountFromSlug).mockReturnValue(account);
  vi.mocked(useChampionPairs).mockReturnValue({
    data: opts.data,
    isPending: opts.isPending ?? false,
  } as unknown as ReturnType<typeof useChampionPairs>);
}

function renderShell() {
  return render(
    <MotionConfig reducedMotion="always">
      <TooltipPrimitive.Provider>
        <ProfileSynergy accountSlug="jonas-euw" />
      </TooltipPrimitive.Provider>
    </MotionConfig>
  );
}

afterEach(() => {
  vi.mocked(useAccountFromSlug).mockReset();
  vi.mocked(useChampionPairs).mockReset();
});

describe("ProfileSynergy", () => {
  it("renders nothing while the pairs query is pending", () => {
    setPairs({ data: undefined, isPending: true });
    const { container } = renderShell();
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when data is undefined", () => {
    setPairs({ data: undefined });
    const { container } = renderShell();
    expect(container.firstChild).toBeNull();
  });

  it("renders the 'not enough team data' empty state when pairs is empty", () => {
    setPairs({ data: [] });
    renderShell();
    expect(screen.getByText("Synergy")).toBeTruthy();
    expect(screen.getByText(/Not enough team data/)).toBeTruthy();
  });

  it("renders the empty state when the total games across qualifying pairs is below the threshold", () => {
    // Each pair must hit >=2 games to count; total qualifying must reach 10
    setPairs({
      data: [
        pair({ yourChamp: "Ahri", teammateChamp: "Lux", games: 3, wins: 2 }),
        pair({ yourChamp: "Yasuo", teammateChamp: "Soraka", games: 1, wins: 1 }),
      ],
    });
    renderShell();
    expect(screen.getByText(/Not enough team data/)).toBeTruthy();
  });

  it("renders the chord chart and legend when there are enough qualifying games", () => {
    setPairs({
      data: [
        pair({ yourChamp: "Ahri", teammateChamp: "Lux", games: 6, wins: 4 }),
        pair({ yourChamp: "Ahri", teammateChamp: "Soraka", games: 5, wins: 2 }),
      ],
    });
    renderShell();
    expect(screen.getByText("Synergy")).toBeTruthy();
    expect(screen.getByText(/your champs/)).toBeTruthy();
    expect(screen.getByRole("img", { name: "Champion synergy chord" })).toBeTruthy();
  });
});
