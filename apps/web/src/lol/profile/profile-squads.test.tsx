import { useAccountFromSlug } from "@/lol/_shared/account/use-account-from-slug";
import { useSquads } from "@/lol/profile/use-squads";
import { render, screen } from "@testing-library/react";
import type { LolAccount, Squad, SquadMember } from "@vyoh/shared";
import { MotionConfig } from "motion/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProfileSquads } from "./profile-squads";

vi.mock("@/lol/_shared/account/use-account-from-slug", () => ({
  useAccountFromSlug: vi.fn(),
}));

vi.mock("@/lol/profile/use-squads", () => ({
  useSquads: vi.fn(),
}));

// Identity passthrough — the display-name resolution is covered by useChampions'
// own tests; here we only care that the squad rows render.
vi.mock("@/lol/champions/use-champions", () => ({
  useChampionName: () => (alias: string) => alias,
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

function mockSquads(value: { data: Squad[] | undefined; isPending: boolean }): void {
  vi.mocked(useAccountFromSlug).mockReturnValue(account);
  vi.mocked(useSquads).mockReturnValue(value as unknown as ReturnType<typeof useSquads>);
}

function member(overrides: Partial<SquadMember> = {}): SquadMember {
  return {
    puuid: "m1",
    gameName: "Mate",
    tagLine: "EUW",
    topChampion: "Lulu",
    ...overrides,
  };
}

function squad(overrides: Partial<Squad> = {}): Squad {
  const members = overrides.members ?? [
    member({ puuid: "m1", gameName: "Alice", topChampion: "Lulu" }),
    member({ puuid: "m2", gameName: "Bob", topChampion: "Yasuo" }),
  ];
  return {
    members,
    size: members.length + 1,
    games: 8,
    wins: 5,
    matchIds: [],
    ...overrides,
  };
}

function renderSquads() {
  return render(
    <MotionConfig reducedMotion="always">
      <ProfileSquads accountSlug="jonas-euw" />
    </MotionConfig>
  );
}

afterEach(() => {
  vi.mocked(useAccountFromSlug).mockReset();
  vi.mocked(useSquads).mockReset();
});

describe("ProfileSquads", () => {
  it("renders nothing while the squads query is pending", () => {
    mockSquads({ data: undefined, isPending: true });
    const { container } = renderSquads();
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing (no empty state) when no squad is detected", () => {
    mockSquads({ data: [], isPending: false });
    const { container } = renderSquads();
    expect(container.firstChild).toBeNull();
  });

  it("renders a trio row with stack label, member names, win/loss split and WR", () => {
    mockSquads({ data: [squad({ games: 8, wins: 5 })], isPending: false });
    const { container } = renderSquads();
    expect(screen.getByText("Squads")).toBeTruthy();
    expect(screen.getByText("Alice, Bob")).toBeTruthy();
    expect(screen.getByText("Trio")).toBeTruthy();
    expect(container.textContent).toContain("8 games");
    // 5 wins / 8 games ≈ 63%.
    expect(container.textContent).toContain("63% WR");
  });

  it("labels a full 5-stack and caps the section at 3 rows", () => {
    const fiveStack = squad({
      members: [
        member({ puuid: "a", gameName: "A" }),
        member({ puuid: "b", gameName: "B" }),
        member({ puuid: "c", gameName: "C" }),
        member({ puuid: "d", gameName: "D" }),
      ],
      games: 12,
      wins: 9,
    });
    mockSquads({
      data: [
        fiveStack,
        squad({
          members: [
            member({ puuid: "e", gameName: "E" }),
            member({ puuid: "f", gameName: "F" }),
          ],
        }),
        squad({
          members: [
            member({ puuid: "g", gameName: "G" }),
            member({ puuid: "h", gameName: "H" }),
          ],
        }),
        squad({
          members: [
            member({ puuid: "i", gameName: "I" }),
            member({ puuid: "j", gameName: "J" }),
          ],
        }),
      ],
      isPending: false,
    });
    renderSquads();
    expect(screen.getByText("5-stack")).toBeTruthy();
    expect(screen.getByText("A, B, C, D")).toBeTruthy();
    // 4th squad is past DISPLAY_COUNT = 3.
    expect(screen.queryByText("I, J")).toBeNull();
  });
});
