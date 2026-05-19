import { MatchWindowProvider } from "@/lol/matches/match-window-context";
import { render, screen } from "@testing-library/react";
import type { MatchSummary } from "@vyoh/shared";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { ProfileRecentForm } from "./profile-recent-form";

vi.mock("@/lol/_shared/ui/match-record", () => ({
  MatchRecord: ({ matches }: { matches: MatchSummary[] }) => (
    <div data-testid="record">count={matches.length}</div>
  ),
}));

vi.mock("@/lol/trends/trend-streak", () => ({
  TrendStreak: ({ streak }: { streak: unknown }) => (
    <span data-testid="streak">{JSON.stringify(streak)}</span>
  ),
}));

function fakeMatch(overrides: Partial<MatchSummary> = {}): MatchSummary {
  return {
    matchId: `M${Math.random()}`,
    win: true,
    remake: false,
    playedAt: new Date().toISOString(),
    queueType: "Ranked Solo",
    ...overrides,
  } as unknown as MatchSummary;
}

function renderWith(matches: MatchSummary[] | undefined): ReactNode {
  return render(
    <MatchWindowProvider
      value={{
        matches,
        isPending: false,
        total: matches?.length ?? 0,
        count: matches?.length ?? 0,
        setCount: () => {},
      }}
    >
      <ProfileRecentForm accountSlug="ahri" />
    </MatchWindowProvider>
  ) as unknown as ReactNode;
}

describe("ProfileRecentForm", () => {
  it("renders null when matches are undefined", () => {
    const { container } = renderWith(undefined) as unknown as { container: HTMLElement };
    expect(container.firstChild).toBeNull();
  });

  it("renders null when there are no matches", () => {
    const { container } = renderWith([]) as unknown as { container: HTMLElement };
    expect(container.firstChild).toBeNull();
  });

  it("renders null when every match is a remake", () => {
    const { container } = renderWith([
      fakeMatch({ remake: true }),
      fakeMatch({ remake: true }),
    ]) as unknown as { container: HTMLElement };
    expect(container.firstChild).toBeNull();
  });

  it("renders the record and streak when at least one non-remake match exists", () => {
    renderWith([fakeMatch()]);
    expect(screen.getByText("Recent Form")).toBeTruthy();
    expect(screen.getByTestId("record")).toBeTruthy();
    expect(screen.getByTestId("streak")).toBeTruthy();
  });

  it("caps the record at 20 entries even when more matches exist", () => {
    const matches = Array.from({ length: 30 }, () => fakeMatch());
    renderWith(matches);
    expect(screen.getByTestId("record").textContent).toBe("count=20");
  });
});
