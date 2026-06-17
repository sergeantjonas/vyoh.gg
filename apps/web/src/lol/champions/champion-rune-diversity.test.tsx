import { useAccountFromSlug } from "@/lol/_shared/account/use-account-from-slug";
import { type PerkInfo, usePerks } from "@/lol/_shared/analytics/use-perks";
import { useChampionRuneDiversity } from "@/lol/champions/use-champion-rune-diversity";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { render, screen } from "@testing-library/react";
import type { ChampionRuneDiversityEntry, LolAccount } from "@vyoh/shared";
import { configureAxe } from "jest-axe";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChampionRuneDiversity } from "./champion-rune-diversity";

vi.mock("@/lol/_shared/account/use-account-from-slug", () => ({
  useAccountFromSlug: vi.fn(),
}));

vi.mock("@/lol/champions/use-champion-rune-diversity", () => ({
  useChampionRuneDiversity: vi.fn(),
}));

vi.mock("@/lol/_shared/analytics/use-perks", () => ({
  usePerks: vi.fn(),
}));

const account: LolAccount = {
  region: "euw1",
  gameName: "Jonas",
  tagLine: "EUW",
  slug: "jonas-euw",
};

const perks = new Map<number, PerkInfo>([
  [8005, { iconUrl: "/8005.png", name: "Press the Attack", description: "" }],
  [8112, { iconUrl: "/8112.png", name: "Electrocute", description: "" }],
  [9923, { iconUrl: "/9923.png", name: "Hail of Blades", description: "" }],
]);

function setDiversity(opts: {
  data?: ChampionRuneDiversityEntry[] | undefined;
  isPending?: boolean;
}) {
  vi.mocked(useAccountFromSlug).mockReturnValue(account);
  vi.mocked(useChampionRuneDiversity).mockReturnValue({
    data: opts.data,
    isPending: opts.isPending ?? false,
  } as unknown as ReturnType<typeof useChampionRuneDiversity>);
  vi.mocked(usePerks).mockReturnValue(perks);
}

function renderShell() {
  return render(
    <TooltipPrimitive.Provider>
      <ChampionRuneDiversity accountSlug="jonas-euw" championKey="ahri" />
    </TooltipPrimitive.Provider>
  );
}

afterEach(() => {
  vi.mocked(useAccountFromSlug).mockReset();
  vi.mocked(useChampionRuneDiversity).mockReset();
  vi.mocked(usePerks).mockReset();
});

describe("ChampionRuneDiversity", () => {
  it("renders null while the query is pending", () => {
    setDiversity({ isPending: true, data: undefined });
    const { container } = renderShell();
    expect(container.firstChild).toBeNull();
  });

  it("renders null when data is undefined", () => {
    setDiversity({ data: undefined });
    const { container } = renderShell();
    expect(container.firstChild).toBeNull();
  });

  it("renders the empty state below the MIN_ENTRIES total-games threshold", () => {
    setDiversity({ data: [{ keystoneId: 8005, games: 3, wins: 2 }] });
    renderShell();
    expect(screen.getByText("Rune diversity")).toBeTruthy();
    expect(screen.getByText(/Need 5\+ games on this champion/)).toBeTruthy();
  });

  it("renders a dominant-keystone verdict and one row per keystone", () => {
    setDiversity({
      data: [
        { keystoneId: 8005, games: 8, wins: 5 },
        { keystoneId: 8112, games: 2, wins: 1 },
      ],
    });
    renderShell();
    // 10 total games, top keystone has 8/10 (>= 60%) → "lean on" verdict.
    expect(screen.getByText(/You lean on Press the Attack — 8 of 10 games/)).toBeTruthy();
    // Both keystone names render as row labels.
    expect(screen.getByText("Press the Attack")).toBeTruthy();
    expect(screen.getByText("Electrocute")).toBeTruthy();
  });

  it("reframes the verdict when no keystone dominates", () => {
    setDiversity({
      data: [
        { keystoneId: 8005, games: 4, wins: 2 },
        { keystoneId: 8112, games: 4, wins: 3 },
        { keystoneId: 9923, games: 3, wins: 1 },
      ],
    });
    renderShell();
    expect(screen.getByText(/You spread across 3 keystones over 11 games/)).toBeTruthy();
  });

  it("suppresses the lift marker for keystones below the per-keystone confidence floor", () => {
    setDiversity({
      data: [
        { keystoneId: 8005, games: 7, wins: 7 }, // confident, 100% → ▲ vs baseline
        { keystoneId: 8112, games: 1, wins: 0 }, // n=1 → no marker, stays neutral
      ],
    });
    renderShell();
    // baseline WR = 7/8 (0.875); the confident row's 100% lifts > +0.05 → one ▲,
    // the n=1 row is below the confidence floor so it shows no marker at all.
    expect(screen.queryAllByText("▲")).toHaveLength(1);
    expect(screen.queryByText("▼")).toBeNull();
  });

  it("has no axe violations", async () => {
    setDiversity({
      data: [
        { keystoneId: 8005, games: 8, wins: 5 },
        { keystoneId: 8112, games: 3, wins: 1 },
      ],
    });
    const axe = configureAxe({
      rules: {
        "color-contrast": { enabled: false },
        "aria-hidden-focus": { enabled: false },
      },
    });
    const { container } = renderShell();
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});
