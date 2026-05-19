import {
  useChampionAliasFromName,
  useChampionName,
  useChampions,
} from "@/lol/champions/use-champions";
import { useMatchWindow } from "@/lol/matches/match-window-context";
import { useCurrentPatchChanges } from "@/lol/patches/use-current-patch-changes";
import { fireEvent, render, screen } from "@testing-library/react";
import type { CurrentPatchChangesResponse, MatchSummary } from "@vyoh/shared";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProfilePatchNotice } from "./profile-patch-notice";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: { children: ReactNode }) => (
    <a {...(props as Record<string, string>)}>{children}</a>
  ),
}));

vi.mock("@/lol/matches/match-window-context", () => ({
  useMatchWindow: vi.fn(),
}));

vi.mock("@/lol/champions/use-champions", () => ({
  useChampionName: vi.fn(),
  useChampionAliasFromName: vi.fn(),
  useChampions: vi.fn(),
}));

vi.mock("@/lol/patches/use-current-patch-changes", () => ({
  useCurrentPatchChanges: vi.fn(),
}));

vi.mock("@/lol/_shared/assets/champion-square-icon", () => ({
  ChampionSquareIcon: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

function mockChampions(ready: boolean) {
  vi.mocked(useChampions).mockReturnValue({
    isSuccess: ready,
  } as unknown as ReturnType<typeof useChampions>);
  vi.mocked(useChampionName).mockReturnValue((alias: string) => alias);
  vi.mocked(useChampionAliasFromName).mockReturnValue((name: string) => name);
}

function mockWindow(matches: MatchSummary[] | undefined) {
  vi.mocked(useMatchWindow).mockReturnValue({
    matches,
    isPending: false,
    total: matches?.length ?? 0,
    count: 20,
    setCount: () => {},
  } as unknown as ReturnType<typeof useMatchWindow>);
}

function mockChanges(data: CurrentPatchChangesResponse | undefined) {
  vi.mocked(useCurrentPatchChanges).mockReturnValue({
    data,
  } as unknown as ReturnType<typeof useCurrentPatchChanges>);
}

function summary(overrides: Partial<MatchSummary> = {}): MatchSummary {
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

function renderNotice() {
  return render(<ProfilePatchNotice accountSlug="jonas-euw" />);
}

beforeEach(() => {
  window.localStorage.clear();
  mockChampions(true);
  mockWindow([summary({ champion: "Ahri" })]);
});

afterEach(() => {
  vi.mocked(useMatchWindow).mockReset();
  vi.mocked(useChampions).mockReset();
  vi.mocked(useChampionName).mockReset();
  vi.mocked(useChampionAliasFromName).mockReset();
  vi.mocked(useCurrentPatchChanges).mockReset();
  window.localStorage.clear();
});

describe("ProfilePatchNotice", () => {
  it("renders nothing when the changes query has no data", () => {
    mockChanges(undefined);
    const { container } = renderNotice();
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when the patch has zero changes for the user's champions", () => {
    mockChanges({ patchVersion: "16.10.1", changes: [] });
    const { container } = renderNotice();
    expect(container.firstChild).toBeNull();
  });

  it("renders the patch header and a per-champion change line", () => {
    mockChanges({
      patchVersion: "16.10.1",
      changes: [
        {
          champion: "Ahri",
          changes: [
            {
              ability: "Q",
              slot: "Q",
              iconPath: null,
              changeType: "buff",
              changeText: "Damage increased.",
            },
          ],
        },
      ],
    } as CurrentPatchChangesResponse);
    renderNotice();
    expect(screen.getByText(/Patch 16\.10\.1 · changes for your champions/)).toBeTruthy();
    expect(screen.getByText("Ahri")).toBeTruthy();
    expect(screen.getByText("Damage increased.")).toBeTruthy();
  });

  it("collapses changes past MAX_LINES_PER_CHAMPION and expands on click", () => {
    const lines = Array.from({ length: 9 }, (_, i) => ({
      ability: "Q",
      slot: "Q",
      iconPath: null,
      changeType: "buff" as const,
      changeText: `line ${i + 1}`,
    }));
    mockChanges({
      patchVersion: "16.10.1",
      changes: [{ champion: "Ahri", changes: lines }],
    } as CurrentPatchChangesResponse);
    renderNotice();
    expect(screen.getByText("line 6")).toBeTruthy();
    expect(screen.queryByText("line 7")).toBeNull();
    fireEvent.click(screen.getByText("+3 more changes"));
    expect(screen.getByText("line 7")).toBeTruthy();
    expect(screen.getByText("line 9")).toBeTruthy();
    expect(screen.getByText("Show less")).toBeTruthy();
  });

  it("dismisses the notice on click and persists the dismissal in localStorage", () => {
    mockChanges({
      patchVersion: "16.10.1",
      changes: [
        {
          champion: "Ahri",
          changes: [
            {
              ability: "Q",
              slot: "Q",
              iconPath: null,
              changeType: "buff",
              changeText: "Damage increased.",
            },
          ],
        },
      ],
    } as CurrentPatchChangesResponse);
    const { container } = renderNotice();
    fireEvent.click(screen.getByLabelText("Dismiss patch notice"));
    expect(container.firstChild).toBeNull();
    expect(window.localStorage.getItem("vyoh:patch-notice-dismissed:16.10.1")).toBe("1");
  });
});
