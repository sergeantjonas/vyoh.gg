import { ActiveMatchProvider } from "@/lol/matches/active-match-context";
import { MatchRow } from "@/lol/matches/match-row";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { MatchSummary } from "@vyoh/shared";
import { configureAxe } from "jest-axe";
import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { CommandPaletteProvider } from "./command-palette-context";
import CommandPaletteDialog from "./command-palette-dialog";
import { Nav } from "./nav";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    params: _params,
    replace: _replace,
    ...rest
  }: {
    children: ReactNode;
    to?: string;
    params?: unknown;
    replace?: boolean;
    [key: string]: unknown;
  }) => (
    <a href={to as string | undefined} {...(rest as object)}>
      {children}
    </a>
  ),
  useRouterState: ({
    select,
  }: {
    select: (s: { location: { pathname: string } }) => unknown;
  }) => select({ location: { pathname: "/" } }),
  useNavigate: () => vi.fn(),
}));

vi.mock("@/identity/use-me", () => ({
  useMe: () => ({ data: undefined }),
}));

vi.mock("@/lol/champions/use-champions", () => ({
  useChampionName: () => (key: string) => key,
  useChampions: () => ({ data: new Map() }),
}));

vi.mock("@/lol/_shared/assets/champion-square-icon", () => ({
  ChampionSquareIcon: () => null,
}));

vi.mock("@/lol/matches/use-matches", () => ({
  prefetchCachedMatches: vi.fn(),
}));

// Disable rules that produce false positives in happy-dom:
// - color-contrast: requires real computed styles
// - aria-hidden-focus: Radix Dialog hides background with aria-hidden; happy-dom's focus
//   simulation triggers false violations against the (correctly visible) dialog portal
const axe = configureAxe({
  rules: {
    "color-contrast": { enabled: false },
    "aria-hidden-focus": { enabled: false },
  },
});

function wrap(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <TooltipPrimitive.Provider>
      <QueryClientProvider client={client}>
        <MotionConfig reducedMotion="always">{ui}</MotionConfig>
      </QueryClientProvider>
    </TooltipPrimitive.Provider>
  );
}

const sampleMatch: MatchSummary = {
  matchId: "EUW1_1",
  queueType: "Ranked Solo",
  champion: "Ahri",
  kills: 8,
  deaths: 3,
  assists: 12,
  win: true,
  durationSec: 1834,
  playedAt: new Date(Date.now() - 2 * 3_600_000).toISOString(),
  remake: false,
  teamPosition: "MIDDLE",
  gameVersion: "14.20.586.5840",
  visionScore: 30,
  damageShare: 0.25,
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
};

describe("Accessibility (axe)", () => {
  it("CommandPaletteDialog has no violations when open", async () => {
    wrap(<CommandPaletteDialog open onOpenChange={vi.fn()} />);
    // Dialog portal renders into document.body — scan the full body
    const results = await axe(document.body);
    expect(results.violations).toHaveLength(0);
  });

  it("Nav has no violations", async () => {
    const { container } = wrap(
      <CommandPaletteProvider>
        <Nav />
      </CommandPaletteProvider>
    );
    const results = await axe(container);
    expect(results.violations).toHaveLength(0);
  });

  it("MatchRow has no violations", async () => {
    const { container } = wrap(
      <ActiveMatchProvider>
        <MatchRow match={sampleMatch} accountSlug="ahri" championDisplayName="Ahri" />
      </ActiveMatchProvider>
    );
    const results = await axe(container);
    expect(results.violations).toHaveLength(0);
  });
});
