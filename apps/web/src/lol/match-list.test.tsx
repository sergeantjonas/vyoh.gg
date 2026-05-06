import { render, screen } from "@testing-library/react";
import type { MatchSummary } from "@vyoh/shared";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { MatchList } from "./match-list";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: { children: ReactNode }) => <a {...props}>{children}</a>,
}));

const matches: MatchSummary[] = [
  {
    matchId: "EUW1_1",
    queueType: "Ranked Solo",
    champion: "Ahri",
    kills: 8,
    deaths: 3,
    assists: 12,
    win: true,
    durationSec: 1834,
    playedAt: new Date(Date.now() - 2 * 3_600_000).toISOString(),
  },
  {
    matchId: "EUW1_2",
    queueType: "ARAM",
    champion: "Jhin",
    kills: 4,
    deaths: 7,
    assists: 5,
    win: false,
    durationSec: 1280,
    playedAt: new Date(Date.now() - 50 * 3_600_000).toISOString(),
  },
];

describe("MatchList", () => {
  it("renders one item per match with champion, queue, and kda", () => {
    render(<MatchList matches={matches} />);

    expect(screen.queryByText("Ahri")).not.toBeNull();
    expect(screen.queryByText("Jhin")).not.toBeNull();
    expect(screen.queryByText("Ranked Solo")).not.toBeNull();
    expect(screen.queryByText("ARAM")).not.toBeNull();
    expect(screen.queryByText("8 / 3 / 12")).not.toBeNull();
    expect(screen.queryByText("4 / 7 / 5")).not.toBeNull();
  });

  it("formats duration as Xm SSs", () => {
    render(<MatchList matches={matches} />);
    expect(screen.queryByText(/30m 34s/)).not.toBeNull();
    expect(screen.queryByText(/21m 20s/)).not.toBeNull();
  });
});
