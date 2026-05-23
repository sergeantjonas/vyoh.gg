import { useAccountFromSlug } from "@/lol/_shared/account/use-account-from-slug";
import { useChampionBuildFlow } from "@/lol/champions/use-champion-build-flow";
import { useItems } from "@/lol/matches/use-items";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { render, screen } from "@testing-library/react";
import type { ChampionBuildFlowEntry, LolAccount } from "@vyoh/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChampionBuildPath } from "./champion-build-path";

vi.mock("@/lol/_shared/account/use-account-from-slug", () => ({
  useAccountFromSlug: vi.fn(),
}));

vi.mock("@/lol/champions/use-champion-build-flow", () => ({
  useChampionBuildFlow: vi.fn(),
}));

vi.mock("@/lol/matches/use-items", () => ({
  useItems: vi.fn(),
}));

const account: LolAccount = {
  region: "euw1",
  gameName: "Jonas",
  tagLine: "EUW",
  slug: "jonas-euw",
};

const items = new Map<number, { iconUrl: string; name: string }>([
  [3001, { iconUrl: "/3001.png", name: "Abyssal Mask" }],
  [3157, { iconUrl: "/3157.png", name: "Zhonya's Hourglass" }],
  [3089, { iconUrl: "/3089.png", name: "Rabadon's Deathcap" }],
  [3020, { iconUrl: "/3020.png", name: "Sorcerer's Shoes" }],
]);

function setFlow(opts: {
  data?: ChampionBuildFlowEntry[] | undefined;
  isPending?: boolean;
}) {
  vi.mocked(useAccountFromSlug).mockReturnValue(account);
  vi.mocked(useChampionBuildFlow).mockReturnValue({
    data: opts.data,
    isPending: opts.isPending ?? false,
  } as unknown as ReturnType<typeof useChampionBuildFlow>);
  vi.mocked(useItems).mockReturnValue({
    data: items,
  } as unknown as ReturnType<typeof useItems>);
}

function entry(items: number[], win = true): ChampionBuildFlowEntry {
  return { items, win } as ChampionBuildFlowEntry;
}

function renderShell() {
  return render(
    <TooltipPrimitive.Provider>
      <ChampionBuildPath accountSlug="jonas-euw" championKey="ahri" />
    </TooltipPrimitive.Provider>
  );
}

afterEach(() => {
  vi.mocked(useAccountFromSlug).mockReset();
  vi.mocked(useChampionBuildFlow).mockReset();
  vi.mocked(useItems).mockReset();
});

describe("ChampionBuildPath", () => {
  it("renders null while the build-flow query is pending", () => {
    setFlow({ isPending: true, data: undefined });
    const { container } = renderShell();
    expect(container.firstChild).toBeNull();
  });

  it("renders null when data is undefined", () => {
    setFlow({ data: undefined });
    const { container } = renderShell();
    expect(container.firstChild).toBeNull();
  });

  it("renders the 'need more matches' empty state below the MIN_ENTRIES threshold", () => {
    setFlow({ data: [entry([3001, 3157])] });
    renderShell();
    expect(screen.getByText("Build path")).toBeTruthy();
    expect(screen.getByText(/Need 5\+ matches with timeline data/)).toBeTruthy();
  });

  it("renders the dominant-path verdict and item names when the graph has data", () => {
    setFlow({
      data: Array.from({ length: 6 }, () => entry([3001, 3157, 3089], true)),
    });
    renderShell();
    expect(
      screen.getByText(
        /Most-built path on 3 items: Abyssal Mask → Zhonya's Hourglass → Rabadon's Deathcap/
      )
    ).toBeTruthy();
  });

  it("shows the dominant path row when paths share a prefix but diverge", () => {
    // Six builds: 4 follow Abyssal → Zhonya's → Rabadon's, 2 follow Abyssal → Zhonya's → Sorcerer's
    // → top path icons + games count visible.
    setFlow({
      data: [
        ...Array.from({ length: 4 }, () => entry([3001, 3157, 3089], true)),
        ...Array.from({ length: 2 }, () => entry([3001, 3157, 3020], false)),
      ],
    });
    renderShell();
    // Verdict mentions the dominant path with 4 games.
    expect(
      screen.getByText(
        /Abyssal Mask → Zhonya's Hourglass → Rabadon's Deathcap \(4 games\)/
      )
    ).toBeTruthy();
  });

  it("renders a 'N games across M other builds' footer when more than MAX_PATHS paths exist", () => {
    // 6 distinct 2-item builds + 5 baseline copies of one path so we exceed MAX_PATHS=5.
    setFlow({
      data: [
        ...Array.from({ length: 5 }, () => entry([3001, 3157], true)),
        entry([3001, 3089], true),
        entry([3001, 3020], false),
        entry([3157, 3089], true),
        entry([3157, 3020], false),
        entry([3089, 3020], true),
        entry([3020, 3001], false),
      ],
    });
    renderShell();
    expect(screen.getByText(/other builds?\./)).toBeTruthy();
  });

  it("renders the singular game phrasing when the top path has exactly one game", () => {
    setFlow({ data: Array.from({ length: 6 }, () => entry([3001])) });
    renderShell();
    expect(
      screen.getByText(/Most-built path on 1 item: Abyssal Mask \(6 games\)\./)
    ).toBeTruthy();
  });

  it("reframes the verdict and suppresses WR noise when no path repeats", () => {
    // Six games, six unique 3-item paths → every path has games=1.
    // WR%/delta are statistical noise at n=1 and "most-built" is a lie.
    setFlow({
      data: [
        entry([3001, 3157, 3089], true),
        entry([3157, 3089, 3001], true),
        entry([3089, 3001, 3157], false),
        entry([3001, 3089, 3157], true),
        entry([3157, 3001, 3089], false),
        entry([3089, 3157, 3001], true),
      ],
    });
    renderShell();
    expect(
      screen.getByText(/Builds vary — no item sequence has repeated across 6 games\./)
    ).toBeTruthy();
    // No "100%" WR badge — would be misleading at n=1.
    expect(screen.queryByText("100%")).toBeNull();
  });
});
