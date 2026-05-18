import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { fireEvent, render, screen } from "@testing-library/react";
import type { HomeChronotype, HomeChronotypeHour } from "@vyoh/shared";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TileChronotype } from "./tile-chronotype";
import { useHomeChronotype } from "./use-home-chronotype";

vi.mock("./use-home-chronotype", () => ({
  useHomeChronotype: vi.fn(),
}));

type HookReturn = { data: HomeChronotype | undefined; isPending: boolean };

function mockHook(value: HookReturn): void {
  vi.mocked(useHomeChronotype).mockReturnValue(
    value as unknown as ReturnType<typeof useHomeChronotype>
  );
}

function renderWithProviders(ui: ReactNode) {
  return render(<TooltipPrimitive.Provider>{ui}</TooltipPrimitive.Provider>);
}

function emptyHour(hour: number): HomeChronotypeHour {
  return { hour, total: 0, lol: 0, steam: 0 };
}

function makeData(overrides: Partial<HomeChronotype> = {}): HomeChronotype {
  const hours = Array.from({ length: 24 }, (_, i) => emptyHour(i));
  // Two distinct peaks so each toggle has visible data.
  hours[14] = { hour: 14, total: 6, lol: 5, steam: 1 };
  hours[22] = { hour: 22, total: 4, lol: 0, steam: 4 };
  return {
    hours,
    totalLolCount: 5,
    totalSteamCount: 5,
    timeZone: "Europe/Brussels",
    ...overrides,
  };
}

afterEach(() => {
  vi.mocked(useHomeChronotype).mockReset();
});

describe("TileChronotype", () => {
  it("renders the loading placeholder while the chronotype query is pending", () => {
    mockHook({ data: undefined, isPending: true });
    renderWithProviders(<TileChronotype />);
    expect(screen.queryByText("Loading play distribution…")).not.toBeNull();
  });

  it("renders the no-data placeholder when the query resolves with no data", () => {
    mockHook({ data: undefined, isPending: false });
    renderWithProviders(<TileChronotype />);
    expect(screen.queryByText("No play distribution available.")).not.toBeNull();
  });

  it("renders the default 'Both' headline and combined footer copy with the resolved tz label", () => {
    mockHook({ data: makeData(), isPending: false });
    renderWithProviders(<TileChronotype />);

    expect(screen.queryByText("When I play and unlock achievements.")).not.toBeNull();
    // tzLabel is the segment after the last '/' in the IANA zone.
    expect(
      screen.queryByText(
        (_: string, el: Element | null) =>
          el?.textContent === "Hours in Brussels · 5 matches + 5 unlocks"
      )
    ).not.toBeNull();
  });

  it("switches headline + footer noun when the stream toggle moves between Both → LoL → Steam", () => {
    mockHook({ data: makeData(), isPending: false });
    renderWithProviders(<TileChronotype />);

    fireEvent.click(screen.getByRole("button", { name: "LoL" }));
    expect(screen.queryByText("When I play.")).not.toBeNull();
    expect(
      screen.queryByText(
        (_: string, el: Element | null) =>
          el?.textContent === "Hours in Brussels · 5 matches"
      )
    ).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Steam" }));
    expect(screen.queryByText("When I unlock achievements.")).not.toBeNull();
    expect(
      screen.queryByText(
        (_: string, el: Element | null) =>
          el?.textContent === "Hours in Brussels · 5 unlocks"
      )
    ).not.toBeNull();
  });

  it("reflects active toggle via aria-pressed on the corresponding button", () => {
    mockHook({ data: makeData(), isPending: false });
    renderWithProviders(<TileChronotype />);

    const lol = screen.getByRole("button", { name: "LoL" });
    expect(lol.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(lol);
    expect(lol.getAttribute("aria-pressed")).toBe("true");
    expect(
      screen.getByRole("button", { name: "Both" }).getAttribute("aria-pressed")
    ).toBe("false");
  });
});
