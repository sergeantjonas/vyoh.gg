import { useSteamChronotype } from "@/steam/use-steam-chronotype";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { render, screen } from "@testing-library/react";
import type { SteamChronotypeHour } from "@vyoh/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SteamChronotypeTile } from "./steam-chronotype-tile";

vi.mock("@/steam/use-steam-chronotype", () => ({
  useSteamChronotype: vi.fn(),
}));

function hours(values: number[]): SteamChronotypeHour[] {
  return values.map((count, hour) => ({ hour, count }) as SteamChronotypeHour);
}

function mockChrono(value: {
  data?: { hours: SteamChronotypeHour[]; totalCount: number; timeZone: string };
  isPending?: boolean;
}) {
  vi.mocked(useSteamChronotype).mockReturnValue({
    data: value.data,
    isPending: value.isPending ?? false,
  } as unknown as ReturnType<typeof useSteamChronotype>);
}

function renderTile() {
  return render(
    <TooltipPrimitive.Provider>
      <SteamChronotypeTile />
    </TooltipPrimitive.Provider>
  );
}

afterEach(() => {
  vi.mocked(useSteamChronotype).mockReset();
});

describe("SteamChronotypeTile", () => {
  it("renders the loading verdict while the query is pending", () => {
    mockChrono({ isPending: true });
    renderTile();
    expect(screen.getByText("Loading unlock distribution…")).toBeTruthy();
  });

  it("renders the empty verdict when no data is returned", () => {
    mockChrono({});
    renderTile();
    expect(screen.getByText("No unlock data available.")).toBeTruthy();
  });

  it("renders the full tile with title and timezone footer", () => {
    mockChrono({
      data: {
        hours: hours(Array.from({ length: 24 }, (_, h) => (h === 22 ? 5 : 1))),
        totalCount: 28,
        timeZone: "Europe/Brussels",
      },
    });
    renderTile();
    expect(screen.getByText("Chronotype")).toBeTruthy();
    expect(screen.getByText("When I unlock achievements.")).toBeTruthy();
    expect(screen.getByText(/Hours in Brussels · last 28 unlocks/)).toBeTruthy();
  });

  it("uses the raw timezone string when it has no '/'", () => {
    mockChrono({
      data: {
        hours: hours(Array.from({ length: 24 }, () => 0)),
        totalCount: 0,
        timeZone: "UTC",
      },
    });
    renderTile();
    expect(screen.getByText(/Hours in UTC/)).toBeTruthy();
  });
});
