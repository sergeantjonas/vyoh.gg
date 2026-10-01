import { render, screen, within } from "@testing-library/react";
import type { WebVitalsSummary } from "@vyoh/shared";
import { describe, expect, it, vi } from "vitest";
import { FieldVitalsCard } from "./field-vitals-card";
import { useFieldVitals } from "./use-field-vitals";

vi.mock("./use-field-vitals", () => ({ useFieldVitals: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({
  useRouter: () => ({
    routesById: { "/": {}, "/lol/$accountSlug/matches/": {}, "/steam/library": {} },
  }),
}));

function withData(data: WebVitalsSummary) {
  vi.mocked(useFieldVitals).mockReturnValue({
    data,
    isPending: false,
    error: null,
  } as never);
}

const SUMMARY: WebVitalsSummary = {
  windowDays: 7,
  minSamples: 5,
  routes: [
    {
      route: "/lol/$accountSlug/matches/",
      formFactor: "desktop",
      metrics: {
        LCP: { p75: 2256, samples: 40, goodShare: 0.8 },
        INP: { p75: 240, samples: 31, goodShare: 0.6 },
        CLS: { p75: 0.3, samples: 22, goodShare: 0.4 },
      },
    },
    // A string in the template charset that this build's route tree does not know.
    {
      route: "/steam/game/570",
      formFactor: "mobile",
      metrics: { LCP: { p75: 900, samples: 9, goodShare: 1 } },
    },
  ],
};

describe("FieldVitalsCard", () => {
  it("shows each known page's p75 per Core Web Vital, rated by web-vitals' thresholds", () => {
    withData(SUMMARY);
    render(<FieldVitalsCard />);

    const row = screen
      .getByText("/lol/$accountSlug/matches")
      .closest("tr") as HTMLElement;
    expect(within(row).getByText("2.26 s").className).toContain("text-emerald-500");
    expect(within(row).getByText("240 ms").className).toContain("text-amber-300");
    expect(within(row).getByText("0.300").className).toContain("text-destructive");
    expect(within(row).getByText("80% good · 40")).toBeTruthy();
  });

  it("leaves out a route the web's route tree does not have", () => {
    withData(SUMMARY);
    render(<FieldVitalsCard />);
    expect(screen.queryByText("/steam/game/570")).toBeNull();
    expect(screen.getAllByRole("row")).toHaveLength(2);
  });

  it("marks a metric below the sample floor as blank", () => {
    withData({
      ...SUMMARY,
      routes: [
        {
          route: "/",
          formFactor: "mobile",
          metrics: { LCP: { p75: 4100, samples: 6, goodShare: 0 } },
        },
      ],
    });
    render(<FieldVitalsCard />);
    const row = screen.getByText("/").closest("tr") as HTMLElement;
    expect(within(row).getByText("4.10 s").className).toContain("text-destructive");
    expect(within(row).getAllByText("—")).toHaveLength(2);
  });

  it("says so when no page has enough samples yet", () => {
    withData({ ...SUMMARY, routes: [] });
    render(<FieldVitalsCard />);
    expect(screen.getByText(/No page has enough samples yet/)).toBeTruthy();
  });
});
