import { MatchWindowProvider } from "@/lol/matches/match-window-context";
import { render, screen } from "@testing-library/react";
import type { MatchSummary } from "@vyoh/shared";
import { describe, expect, it, vi } from "vitest";
import { ProfileQueueDistribution } from "./profile-queue-distribution";

vi.mock("@/lol/_shared/queue/queue-color", () => ({
  queueColor: () => "#abc",
}));

function fakeMatch(queueType: string): MatchSummary {
  return { queueType } as unknown as MatchSummary;
}

function renderWith(matches: MatchSummary[] | undefined) {
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
      <ProfileQueueDistribution />
    </MatchWindowProvider>
  );
}

describe("ProfileQueueDistribution", () => {
  it("renders null while matches are undefined", () => {
    const { container } = renderWith(undefined);
    expect(container.firstChild).toBeNull();
  });

  it("renders null when there are no matches", () => {
    const { container } = renderWith([]);
    expect(container.firstChild).toBeNull();
  });

  it("renders one bar segment and one legend row per queueType, with counts", () => {
    renderWith([fakeMatch("Ranked Solo"), fakeMatch("Ranked Solo"), fakeMatch("ARAM")]);
    expect(screen.getByText("Queue distribution")).toBeTruthy();
    expect(screen.getByText("Ranked Solo")).toBeTruthy();
    expect(screen.getByText("ARAM")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByText("1")).toBeTruthy();
  });
});
