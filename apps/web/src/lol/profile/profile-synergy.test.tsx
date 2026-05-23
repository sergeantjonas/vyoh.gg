import { useAccountFromSlug } from "@/lol/_shared/account/use-account-from-slug";
import { useChampionPairs } from "@/lol/profile/use-champion-pairs";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ChampionPair, LolAccount } from "@vyoh/shared";
import { configureAxe } from "jest-axe";
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

vi.mock("@/lol/champions/use-champions", () => ({
  useChampionName: () => (alias: string) => alias,
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: { children: ReactNode } & Record<string, unknown>) => (
    <a {...(props as Record<string, unknown>)}>{children}</a>
  ),
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
      <ProfileSynergy accountSlug="jonas-euw" />
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

  it("renders the empty state when no champion has enough qualifying games", () => {
    setPairs({
      data: [
        pair({ yourChamp: "Ahri", teammateChamp: "Lux", games: 3, wins: 2 }),
        pair({ yourChamp: "Yasuo", teammateChamp: "Soraka", games: 1, wins: 1 }),
      ],
    });
    renderShell();
    expect(screen.getByText(/Not enough team data/)).toBeTruthy();
  });

  it("renders the champion header collapsed by default, with no teammate content visible", () => {
    setPairs({
      data: [
        pair({ yourChamp: "Ahri", teammateChamp: "Lux", games: 6, wins: 4 }),
        pair({ yourChamp: "Ahri", teammateChamp: "Soraka", games: 5, wins: 2 }),
      ],
    });
    renderShell();

    // Header content is always visible inside the trigger.
    expect(screen.getByText("Ahri")).toBeTruthy();
    expect(screen.getByText("11g · 55%")).toBeTruthy();

    // Teammate rows and the deep-link button are inside the collapsed content
    // and should not be visible until the trigger is activated.
    expect(screen.queryByText("Lux")).toBeNull();
    expect(screen.queryByText("Soraka")).toBeNull();
    expect(screen.queryByText(/View Ahri detail/)).toBeNull();

    const trigger = screen.getByRole("button", { name: /Ahri synergy details/ });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("expands the card on click, revealing teammates and the deep-link button", () => {
    setPairs({
      data: [
        pair({ yourChamp: "Ahri", teammateChamp: "Lux", games: 6, wins: 4 }),
        pair({ yourChamp: "Ahri", teammateChamp: "Soraka", games: 5, wins: 2 }),
      ],
    });
    renderShell();

    const trigger = screen.getByRole("button", { name: /Ahri synergy details/ });
    fireEvent.click(trigger);

    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Lux")).toBeTruthy();
    expect(screen.getByText("Soraka")).toBeTruthy();
    expect(screen.getByText("67%")).toBeTruthy();
    expect(screen.getByText("40%")).toBeTruthy();

    // Link mock renders a bare anchor — query by visible text since the
    // mock doesn't synthesize an href that would give it the link role.
    expect(screen.getByText(/View Ahri detail/)).toBeTruthy();
  });

  it("ranks your-champion cards by total qualifying games", () => {
    setPairs({
      data: [
        pair({ yourChamp: "Ahri", teammateChamp: "Lux", games: 3, wins: 2 }),
        pair({ yourChamp: "Ahri", teammateChamp: "Soraka", games: 4, wins: 3 }),
        pair({ yourChamp: "Yasuo", teammateChamp: "Thresh", games: 8, wins: 5 }),
        pair({ yourChamp: "Yasuo", teammateChamp: "Braum", games: 5, wins: 2 }),
      ],
    });
    renderShell();

    const triggers = screen.getAllByRole("button", { name: /synergy details/ });
    expect(triggers).toHaveLength(2);
    const [first, second] = triggers;
    if (!first || !second) throw new Error("expected two triggers");
    expect(within(first).getByText("Yasuo")).toBeTruthy();
    expect(within(second).getByText("Ahri")).toBeTruthy();
  });

  it("has no detectable axe violations in the default collapsed state", async () => {
    setPairs({
      data: [
        pair({ yourChamp: "Ahri", teammateChamp: "Lux", games: 6, wins: 4 }),
        pair({ yourChamp: "Ahri", teammateChamp: "Soraka", games: 5, wins: 2 }),
      ],
    });
    const { container } = renderShell();
    const axe = configureAxe({
      rules: {
        "color-contrast": { enabled: false },
        "aria-hidden-focus": { enabled: false },
      },
    });
    const results = await axe(container);
    expect(results.violations).toHaveLength(0);
  });
});
