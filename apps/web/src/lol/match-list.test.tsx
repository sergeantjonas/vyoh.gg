import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { MatchSummary } from "@vyoh/shared";
import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { MatchList } from "./match-list";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: { children: ReactNode }) => <a {...props}>{children}</a>,
}));

function renderWithProviders(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MotionConfig reducedMotion="always">{ui}</MotionConfig>
    </QueryClientProvider>
  );
}

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

function hasFlatText(text: string) {
  return (_: string, el: Element | null) => el?.textContent === text;
}

describe("MatchList", () => {
  it("renders one item per match with champion, queue, and kda", () => {
    renderWithProviders(<MatchList matches={matches} accountSlug="ahri" />);

    expect(screen.queryByText("Ahri")).not.toBeNull();
    expect(screen.queryByText("Jhin")).not.toBeNull();
    expect(screen.queryByText(/Ranked Solo/)).not.toBeNull();
    expect(screen.queryByText(/ARAM/)).not.toBeNull();
    expect(screen.queryByText(hasFlatText("8 / 3 / 12"))).not.toBeNull();
    expect(screen.queryByText(hasFlatText("4 / 7 / 5"))).not.toBeNull();
  });

  it("formats duration as Xm SSs", () => {
    renderWithProviders(<MatchList matches={matches} accountSlug="ahri" />);
    expect(screen.queryByText(/30m 34s/)).not.toBeNull();
    expect(screen.queryByText(/21m 20s/)).not.toBeNull();
  });
});
