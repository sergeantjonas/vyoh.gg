import { useAccountFromSlug } from "@/lol/_shared/account/use-account-from-slug";
import { useChampionBuildFlow } from "@/lol/champions/use-champion-build-flow";
import { useItems } from "@/lol/matches/use-items";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { render, screen } from "@testing-library/react";
import type { ChampionBuildFlowEntry, LolAccount } from "@vyoh/shared";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChampionBuildSankey } from "./champion-build-sankey";

vi.mock("@/lol/_shared/account/use-account-from-slug", () => ({
  useAccountFromSlug: vi.fn(),
}));

vi.mock("@/lol/champions/use-champion-build-flow", () => ({
  useChampionBuildFlow: vi.fn(),
}));

vi.mock("@/lol/matches/use-items", () => ({
  useItems: vi.fn(),
}));

vi.mock("@visx/responsive", () => ({
  ParentSize: ({ children }: { children: (size: { width: number }) => ReactNode }) =>
    children({ width: 600 }),
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
      <ChampionBuildSankey accountSlug="jonas-euw" championKey="ahri" />
    </TooltipPrimitive.Provider>
  );
}

afterEach(() => {
  vi.mocked(useAccountFromSlug).mockReset();
  vi.mocked(useChampionBuildFlow).mockReset();
  vi.mocked(useItems).mockReset();
});

describe("ChampionBuildSankey", () => {
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

  it("renders the singular game phrasing when the top path has exactly one game (skipping link filter)", () => {
    // With only 1 occurrence per link, MIN_LINK_GAMES=2 filters everything out
    // → empty graph + below MIN_ENTRIES branch fires the empty card.
    setFlow({ data: Array.from({ length: 6 }, () => entry([3001])) });
    renderShell();
    // Single-item path: only 1 step, no links → "Most-built path on 1 item: Abyssal Mask (6 games)."
    expect(
      screen.getByText(/Most-built path on 1 item: Abyssal Mask \(6 games\)\./)
    ).toBeTruthy();
  });
});
