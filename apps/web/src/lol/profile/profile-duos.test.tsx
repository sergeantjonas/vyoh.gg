import { useAccountFromSlug } from "@/lol/_shared/account/use-account-from-slug";
import { useDuoLp } from "@/lol/profile/use-duo-lp";
import { useDuos } from "@/lol/profile/use-duos";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ChampionPair, Duo, DuoLpOverlay, LolAccount } from "@vyoh/shared";
import { configureAxe } from "jest-axe";
import { MotionConfig } from "motion/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProfileDuos } from "./profile-duos";

vi.mock("@/lol/_shared/account/use-account-from-slug", () => ({
  useAccountFromSlug: vi.fn(),
}));

vi.mock("@/lol/profile/use-duo-lp", () => ({
  useDuoLp: vi.fn(),
}));
vi.mock("@/lol/profile/use-duos", () => ({
  useDuos: vi.fn(),
}));

vi.mock("@/lol/champions/use-champions", () => ({
  useChampionName: () => (alias: string) => alias,
}));

vi.mock("@/lol/_shared/assets/champion-square-icon", () => ({
  ChampionSquareIcon: ({ championName }: { championName: string }) => (
    <img alt={championName} data-champion={championName} />
  ),
}));

// color-contrast needs real computed styles (happy-dom lacks them).
const axe = configureAxe({ rules: { "color-contrast": { enabled: false } } });

function pair(overrides: Partial<ChampionPair> = {}): ChampionPair {
  return { yourChamp: "Ahri", teammateChamp: "Lux", games: 4, wins: 3, ...overrides };
}

const account: LolAccount = {
  region: "euw1",
  gameName: "Jonas",
  tagLine: "EUW",
  slug: "jonas-euw",
};

function mockDuos(value: { data: Duo[] | undefined; isPending: boolean }): void {
  vi.mocked(useAccountFromSlug).mockReturnValue(account);
  vi.mocked(useDuos).mockReturnValue(value as unknown as ReturnType<typeof useDuos>);
  // Disabled for visitors, so `data` is undefined unless a test seeds the owner's overlay.
  vi.mocked(useDuoLp).mockReturnValue({ data: undefined } as unknown as ReturnType<
    typeof useDuoLp
  >);
}

function mockDuoLp(overlays: DuoLpOverlay[]): void {
  vi.mocked(useDuoLp).mockReturnValue({ data: overlays } as unknown as ReturnType<
    typeof useDuoLp
  >);
}

function duo(overrides: Partial<Duo> = {}): Duo {
  return {
    puuid: "p1",
    gameName: "Other",
    tagLine: "EUW",
    games: 10,
    wins: 6,
    topChampion: "Yasuo",
    championPairs: [],
    matchIds: [],
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
  vi.mocked(useDuoLp).mockReset();
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

  it("omits the LP line when the owner-only overlay is absent", () => {
    mockDuos({ data: [duo()], isPending: false });
    renderDuos();
    expect(screen.queryByText(/LP together/)).toBeNull();
  });

  it("shows the owner's LP split with and without the duo on the collapsed row", () => {
    mockDuos({
      data: [duo({ puuid: "p1" }), duo({ puuid: "p2", gameName: "Solo" })],
      isPending: false,
    });
    mockDuoLp([
      {
        puuid: "p1",
        together: { games: 30, lpDelta: 142 },
        without: { games: 40, lpDelta: -18 },
        matches: [],
      },
      // Every ranked game in the window was together: no baseline to compare against.
      {
        puuid: "p2",
        together: { games: 4, lpDelta: -12 },
        without: { games: 0, lpDelta: 0 },
        matches: [],
      },
    ]);
    const { container } = renderDuos();
    expect(container.textContent).toContain(
      "+142 LP together over 30 ranked · -18 LP in the 40 without"
    );
    expect(container.textContent).toContain("-12 LP together over 4 ranked");
    expect(container.textContent).not.toContain("in the 0 without");
  });

  it("summarises the champion-combo count on the collapsed row", () => {
    mockDuos({
      data: [
        duo({
          championPairs: [
            pair({ teammateChamp: "Lux" }),
            pair({ teammateChamp: "Sona" }),
          ],
        }),
      ],
      isPending: false,
    });
    renderDuos();
    // Combo count hints at the expandable content; the most-played champ keeps identity.
    expect(screen.getByText(/Most on Yasuo · 2 combos/)).toBeTruthy();
    // Pairing rows are collapsed until the trigger is activated.
    expect(screen.queryByText("Ahri + Lux")).toBeNull();
  });

  it("reveals the per-pairing breakdown when the row is expanded via keyboard", async () => {
    const user = userEvent.setup();
    mockDuos({
      data: [
        duo({
          championPairs: [
            pair({ yourChamp: "Ahri", teammateChamp: "Lux", games: 4, wins: 3 }),
            pair({ yourChamp: "Ahri", teammateChamp: "Sona", games: 2, wins: 0 }),
          ],
        }),
      ],
      isPending: false,
    });
    renderDuos();

    const trigger = screen.getByRole("button", { name: /Other champion combos/ });
    trigger.focus();
    await user.keyboard("{Enter}");

    expect(screen.getByText("Ahri + Lux")).toBeTruthy();
    expect(screen.getByText("Ahri + Sona")).toBeTruthy();
    // Win rate per pairing: Lux 3/4 = 75%, Sona 0/2 = 0%.
    expect(screen.getByText("75%")).toBeTruthy();
    expect(screen.getByText("0%")).toBeTruthy();
  });

  it("has no axe violations with expandable duo rows", async () => {
    mockDuos({
      data: [duo({ championPairs: [pair()] })],
      isPending: false,
    });
    const { container } = renderDuos();
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});
