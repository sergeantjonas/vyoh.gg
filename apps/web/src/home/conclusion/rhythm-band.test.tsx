import { useHomeChronotype } from "@/home/use-home-chronotype";
import { useHomeDaySplit } from "@/home/use-home-day-split";
import { useHomeSessionLengths } from "@/home/use-home-session-lengths";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { render, screen } from "@testing-library/react";
import type { HomeChronotype, HomeDaySplit, HomeSessionLengths } from "@vyoh/shared";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConclusionRhythmBand } from "./rhythm-band";

vi.mock("@/home/use-home-chronotype", () => ({ useHomeChronotype: vi.fn() }));
vi.mock("@/home/use-home-day-split", () => ({ useHomeDaySplit: vi.fn() }));
vi.mock("@/home/use-home-session-lengths", () => ({ useHomeSessionLengths: vi.fn() }));

type HookReturn<T> = { data: T | undefined; isPending: boolean };

function mockHooks(opts: {
  chronotype?: HookReturn<HomeChronotype>;
  daySplit?: HookReturn<HomeDaySplit>;
  sessions?: HookReturn<HomeSessionLengths>;
}) {
  vi.mocked(useHomeChronotype).mockReturnValue(
    (opts.chronotype ?? { data: undefined, isPending: true }) as unknown as ReturnType<
      typeof useHomeChronotype
    >
  );
  vi.mocked(useHomeDaySplit).mockReturnValue(
    (opts.daySplit ?? { data: undefined, isPending: true }) as unknown as ReturnType<
      typeof useHomeDaySplit
    >
  );
  vi.mocked(useHomeSessionLengths).mockReturnValue(
    (opts.sessions ?? { data: undefined, isPending: true }) as unknown as ReturnType<
      typeof useHomeSessionLengths
    >
  );
}

function renderWithProviders(ui: ReactNode) {
  return render(<TooltipPrimitive.Provider>{ui}</TooltipPrimitive.Provider>);
}

function makeChronotype(): HomeChronotype {
  const hours = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    total: 0,
    lol: 0,
    steam: 0,
  }));
  hours[20] = { hour: 20, total: 7, lol: 5, steam: 2 };
  return { hours, totalLolCount: 5, totalSteamCount: 2, timeZone: "Europe/Brussels" };
}

function makeDaySplit(): HomeDaySplit {
  const hours = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    lolMinutes: 0,
    steamMinutes: 0,
  }));
  hours[21] = { hour: 21, lolMinutes: 30, steamMinutes: 15 };
  return {
    hours,
    totalLolMinutes: 30,
    totalSteamMinutes: 15,
    timeZone: "Europe/Brussels",
  };
}

function makeSessions(): HomeSessionLengths {
  return {
    buckets: [
      { label: "<30m", lolCount: 1, steamCount: 0 },
      { label: "30m–1h", lolCount: 2, steamCount: 1 },
      { label: "1h–2h", lolCount: 1, steamCount: 1 },
      { label: "2h–4h", lolCount: 0, steamCount: 1 },
      { label: "4h+", lolCount: 0, steamCount: 0 },
    ],
    lolSessionCount: 4,
    steamSessionCount: 3,
  };
}

afterEach(() => {
  vi.mocked(useHomeChronotype).mockReset();
  vi.mocked(useHomeDaySplit).mockReset();
  vi.mocked(useHomeSessionLengths).mockReset();
});

describe("ConclusionRhythmBand", () => {
  it("renders the band title and three strip headers", () => {
    mockHooks({});
    renderWithProviders(<ConclusionRhythmBand />);
    expect(screen.getByText("Rhythm")).toBeTruthy();
    expect(screen.getByText("When")).toBeTruthy();
    expect(screen.getByText("Where")).toBeTruthy();
    expect(screen.getByText("How long")).toBeTruthy();
  });

  it("renders loading fallbacks for each strip while its hook is pending", () => {
    mockHooks({});
    renderWithProviders(<ConclusionRhythmBand />);
    expect(screen.getByText("Loading hours…")).toBeTruthy();
    expect(screen.getByText("Loading stream split…")).toBeTruthy();
    expect(screen.getByText("Loading session shapes…")).toBeTruthy();
  });

  it("renders the hour-axis tick labels when chronotype data resolves", () => {
    mockHooks({ chronotype: { data: makeChronotype(), isPending: false } });
    renderWithProviders(<ConclusionRhythmBand />);
    expect(screen.queryByText("Loading hours…")).toBeNull();
    expect(screen.getByText("00")).toBeTruthy();
    expect(screen.getByText("06")).toBeTruthy();
    expect(screen.getByText("12")).toBeTruthy();
    expect(screen.getByText("18")).toBeTruthy();
    expect(screen.getByText("23")).toBeTruthy();
  });

  it("renders the stream-split caption with the resolved share percentages", () => {
    mockHooks({ daySplit: { data: makeDaySplit(), isPending: false } });
    renderWithProviders(<ConclusionRhythmBand />);
    expect(screen.getByText(/67% LoL \/ 33% Steam/)).toBeTruthy();
  });

  it("renders the sessions caption with the short-share + count breakdown", () => {
    mockHooks({ sessions: { data: makeSessions(), isPending: false } });
    renderWithProviders(<ConclusionRhythmBand />);
    expect(
      screen.getByText(/57% under 1h · 4 LoL sessions \+ 3 Steam sessions/)
    ).toBeTruthy();
  });

  it("renders the empty-state copy when a hook resolves with no data", () => {
    mockHooks({
      chronotype: { data: undefined, isPending: false },
      daySplit: { data: undefined, isPending: false },
      sessions: { data: undefined, isPending: false },
    });
    renderWithProviders(<ConclusionRhythmBand />);
    expect(screen.getByText("No hour distribution yet.")).toBeTruthy();
    expect(screen.getByText("No stream split yet.")).toBeTruthy();
    expect(screen.getByText("No session data yet.")).toBeTruthy();
  });
});
