import { render, screen } from "@testing-library/react";
import type { MatchSummary } from "@vyoh/shared";
import { describe, expect, it } from "vitest";
import { MatchList } from "./match-list";

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

    expect(screen.getByText("Ahri")).toBeInTheDocument();
    expect(screen.getByText("Jhin")).toBeInTheDocument();
    expect(screen.getByText("Ranked Solo")).toBeInTheDocument();
    expect(screen.getByText("ARAM")).toBeInTheDocument();
    expect(screen.getByText("8 / 3 / 12")).toBeInTheDocument();
    expect(screen.getByText("4 / 7 / 5")).toBeInTheDocument();
  });

  it("formats duration as Xm SSs", () => {
    render(<MatchList matches={matches} />);
    expect(screen.getByText(/30m 34s/)).toBeInTheDocument();
    expect(screen.getByText(/21m 20s/)).toBeInTheDocument();
  });
});
