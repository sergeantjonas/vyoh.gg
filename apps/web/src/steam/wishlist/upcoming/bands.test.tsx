import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { render, screen } from "@testing-library/react";
import type { SteamWishlistItem } from "@vyoh/shared";
import { configureAxe } from "jest-axe";
import { afterEach, describe, expect, it } from "vitest";
import type { QuarterBand, YearBand } from "./bucketing";
import { QuarterBands } from "./quarter-bands";
import { TbaPool } from "./tba-pool";
import { YearBands } from "./year-bands";

const axe = configureAxe({ rules: { "color-contrast": { enabled: false } } });

function utcDay(year: number, month0: number, day: number): number {
  return Date.UTC(year, month0, day, 12, 0, 0) / 1_000;
}

function item(appid: number, releaseDate: number | null): SteamWishlistItem {
  return {
    appid,
    name: `Game ${appid}`,
    dateAdded: 1_700_000_000,
    priority: 0,
    storeUrl: `https://store.steampowered.com/app/${appid}`,
    releaseDate,
    comingSoon: true,
  };
}

function withProvider(node: React.ReactNode) {
  return render(<TooltipPrimitive.Provider>{node}</TooltipPrimitive.Provider>);
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("QuarterBands", () => {
  const bands: QuarterBand[] = [
    { year: 2026, quarter: 3, items: [item(1, utcDay(2026, 8, 30))] },
  ];

  it("renders a band header with the density chip and capsule links", () => {
    withProvider(<QuarterBands bands={bands} />);
    expect(screen.getByRole("heading", { name: "Q3 2026" })).toBeTruthy();
    expect(screen.getByText(/· 1 title$/)).toBeTruthy();
    expect(screen.getByLabelText("Game 1 on Steam").getAttribute("href")).toBe(
      "https://store.steampowered.com/app/1"
    );
  });

  it("renders nothing when empty", () => {
    const { container } = withProvider(<QuarterBands bands={[]} />);
    expect(container.firstChild).toBeNull();
  });
});

describe("YearBands", () => {
  const bands: YearBand[] = [
    { year: 2027, items: [item(2, utcDay(2027, 11, 31)), item(3, utcDay(2027, 11, 31))] },
  ];

  it("renders a year header with a pluralised count", () => {
    withProvider(<YearBands bands={bands} />);
    expect(screen.getByRole("heading", { name: "2027" })).toBeTruthy();
    expect(screen.getByText(/· 2 titles$/)).toBeTruthy();
  });
});

describe("TbaPool", () => {
  it("renders frosted name chips linking to the store", () => {
    withProvider(<TbaPool items={[item(4, null), item(5, null)]} />);
    expect(screen.getByRole("heading", { name: "Still TBA" })).toBeTruthy();
    expect(screen.getByText(/· 2 games$/)).toBeTruthy();
    const chip = screen.getByRole("link", { name: "Game 4" });
    expect(chip.getAttribute("href")).toBe("https://store.steampowered.com/app/4");
  });

  it("renders nothing when empty", () => {
    const { container } = withProvider(<TbaPool items={[]} />);
    expect(container.firstChild).toBeNull();
  });
});

describe("band surfaces accessibility", () => {
  it("has no axe violations", async () => {
    const { container } = withProvider(
      <div>
        <QuarterBands
          bands={[{ year: 2026, quarter: 4, items: [item(1, utcDay(2026, 11, 31))] }]}
        />
        <YearBands bands={[{ year: 2027, items: [item(2, utcDay(2027, 11, 31))] }]} />
        <TbaPool items={[item(3, null)]} />
      </div>
    );
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});
