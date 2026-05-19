import { useSeriousMatches } from "@/lol/_shared/serious-queues/serious-queues";
import { render, screen } from "@testing-library/react";
import type { MatchSummary } from "@vyoh/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProfileRoleStrip } from "./profile-role-strip";

vi.mock("@/lol/_shared/serious-queues/serious-queues", () => ({
  useSeriousMatches: vi.fn(),
}));

vi.mock("@/lol/_shared/assets/role-icon", async () => {
  const actual = await vi.importActual<typeof import("@/lol/_shared/assets/role-icon")>(
    "@/lol/_shared/assets/role-icon"
  );
  return {
    ...actual,
    RoleIcon: ({ position }: { position: string }) => <span data-role-icon={position} />,
  };
});

function mockSerious(matches: MatchSummary[] | undefined) {
  vi.mocked(useSeriousMatches).mockReturnValue({
    matches,
    isPending: false,
  });
}

function match(overrides: Partial<MatchSummary> = {}): MatchSummary {
  return {
    matchId: "M_1",
    queueType: "Ranked Solo",
    champion: "Ahri",
    kills: 0,
    deaths: 0,
    assists: 0,
    win: true,
    durationSec: 1800,
    playedAt: "2026-01-01T00:00:00Z",
    remake: false,
    teamPosition: "MIDDLE",
    gameVersion: "16.9.1.1",
    visionScore: 0,
    damageShare: 0,
    firstBloodKill: false,
    csAt10: 0,
    csAt15: 0,
    goldAt10: 0,
    goldAt15: 0,
    teamGoldDiffAt15: 0,
    deathTimings: [],
    deathXs: [],
    deathYs: [],
    killTimings: [],
    killXs: [],
    killYs: [],
    laneOpponent: null,
    ...overrides,
  };
}

afterEach(() => {
  vi.mocked(useSeriousMatches).mockReset();
});

describe("ProfileRoleStrip", () => {
  it("renders nothing when no matches are available", () => {
    mockSerious(undefined);
    const { container } = render(<ProfileRoleStrip />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when every match is a remake (total = 0)", () => {
    mockSerious([
      match({ matchId: "1", remake: true }),
      match({ matchId: "2", remake: true }),
    ]);
    const { container } = render(<ProfileRoleStrip />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the role strip and a WR line on roles with 3+ games", () => {
    const matches: MatchSummary[] = [
      match({ matchId: "1", teamPosition: "MIDDLE", win: true }),
      match({ matchId: "2", teamPosition: "MIDDLE", win: true }),
      match({ matchId: "3", teamPosition: "MIDDLE", win: false }),
      match({ matchId: "4", teamPosition: "TOP", win: true }),
    ];
    mockSerious(matches);
    render(<ProfileRoleStrip />);
    // 5 role slots always render. MIDDLE has 3 games → "67% WR" line visible.
    expect(screen.getByText(/67% WR/)).toBeTruthy();
  });

  it("emits the heavy-ARAM notice when most matches lack a positioned role", () => {
    // 1 SR game + 10 ARAM (teamPosition is "Invalid" → not a role) → aramRatio > 0.9.
    const matches: MatchSummary[] = [
      match({ matchId: "sr", teamPosition: "MIDDLE" }),
      ...Array.from({ length: 19 }, (_, i) =>
        match({ matchId: `aram_${i}`, teamPosition: "Invalid" })
      ),
    ];
    mockSerious(matches);
    render(<ProfileRoleStrip />);
    expect(screen.getByText("Mostly ARAM — role data limited.")).toBeTruthy();
  });
});
