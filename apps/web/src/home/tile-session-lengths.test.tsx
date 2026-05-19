import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { render, screen } from "@testing-library/react";
import type { HomeSessionLengths } from "@vyoh/shared";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TileSessionLengths } from "./tile-session-lengths";
import { useHomeSessionLengths } from "./use-home-session-lengths";

vi.mock("./use-home-session-lengths", () => ({ useHomeSessionLengths: vi.fn() }));

function mockHook(value: { data: HomeSessionLengths | undefined; isPending: boolean }) {
  vi.mocked(useHomeSessionLengths).mockReturnValue(
    value as unknown as ReturnType<typeof useHomeSessionLengths>
  );
}

function renderWithTooltip(ui: ReactNode) {
  return render(<TooltipPrimitive.Provider>{ui}</TooltipPrimitive.Provider>);
}

const emptyBuckets: HomeSessionLengths["buckets"] = [
  { label: "<30m", lolCount: 0, steamCount: 0 },
  { label: "30m–1h", lolCount: 0, steamCount: 0 },
  { label: "1h–2h", lolCount: 0, steamCount: 0 },
  { label: "2h–4h", lolCount: 0, steamCount: 0 },
  { label: "4h+", lolCount: 0, steamCount: 0 },
];

afterEach(() => {
  vi.mocked(useHomeSessionLengths).mockReset();
});

describe("TileSessionLengths", () => {
  it("renders the loading verdict while pending", () => {
    mockHook({ data: undefined, isPending: true });
    renderWithTooltip(<TileSessionLengths />);
    expect(screen.getByText("Loading session lengths…")).toBeTruthy();
  });

  it("renders the no-data verdict when the query resolves with no data", () => {
    mockHook({ data: undefined, isPending: false });
    renderWithTooltip(<TileSessionLengths />);
    expect(screen.getByText("No session-length data available.")).toBeTruthy();
  });

  it("renders the not-enough verdict when both session counts are zero", () => {
    mockHook({
      data: { buckets: emptyBuckets, lolSessionCount: 0, steamSessionCount: 0 },
      isPending: false,
    });
    renderWithTooltip(<TileSessionLengths />);
    expect(screen.getByText("Not enough closed sessions yet.")).toBeTruthy();
  });

  it("renders the under-1h share headline and labelled footer when data is present", () => {
    mockHook({
      data: {
        buckets: [
          { label: "<30m", lolCount: 2, steamCount: 0 },
          { label: "30m–1h", lolCount: 1, steamCount: 1 },
          { label: "1h–2h", lolCount: 1, steamCount: 0 },
          { label: "2h–4h", lolCount: 0, steamCount: 1 },
          { label: "4h+", lolCount: 0, steamCount: 0 },
        ],
        lolSessionCount: 4,
        steamSessionCount: 2,
      },
      isPending: false,
    });
    renderWithTooltip(<TileSessionLengths />);
    // short = 2 + 1 + 1 = 4 of 6 total → 67%
    expect(screen.getByText("67% of sessions are under 1h.")).toBeTruthy();
    expect(
      screen.getByText(
        (_, el) =>
          el?.textContent === "Counts, not minutes · 4 LoL sessions + 2 Steam sessions"
      )
    ).toBeTruthy();
  });

  it("pluralizes labels in the footer correctly when counts are 1", () => {
    mockHook({
      data: {
        buckets: [
          { label: "<30m", lolCount: 1, steamCount: 1 },
          { label: "30m–1h", lolCount: 0, steamCount: 0 },
          { label: "1h–2h", lolCount: 0, steamCount: 0 },
          { label: "2h–4h", lolCount: 0, steamCount: 0 },
          { label: "4h+", lolCount: 0, steamCount: 0 },
        ],
        lolSessionCount: 1,
        steamSessionCount: 1,
      },
      isPending: false,
    });
    renderWithTooltip(<TileSessionLengths />);
    expect(
      screen.getByText(
        (_, el) =>
          el?.textContent === "Counts, not minutes · 1 LoL session + 1 Steam session"
      )
    ).toBeTruthy();
  });
});
