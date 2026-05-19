import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Metric } from "web-vitals";
import { PerfOverlay } from "./perf-overlay";

const perfFlag = vi.hoisted(() => ({ value: false }));
const webVitalsState = vi.hoisted(() => ({
  emit: null as ((metric: Metric) => void) | null,
}));

vi.mock("@/lib/use-perf-flag", () => ({
  usePerfFlag: () => perfFlag.value,
}));

vi.mock("@/lib/web-vitals", () => ({
  subscribeWebVitals: (cb: (metric: Metric) => void) => {
    webVitalsState.emit = cb;
    return () => {
      webVitalsState.emit = null;
    };
  },
}));

beforeEach(() => {
  perfFlag.value = false;
  webVitalsState.emit = null;
});

afterEach(() => {
  perfFlag.value = false;
  webVitalsState.emit = null;
});

describe("PerfOverlay", () => {
  it("renders nothing when the perf flag is off", () => {
    const { container } = render(<PerfOverlay />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the metrics list with em-dashes until readings arrive", () => {
    perfFlag.value = true;
    render(<PerfOverlay />);
    expect(screen.getByText("LCP")).toBeTruthy();
    expect(screen.getByText("INP")).toBeTruthy();
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("formats a timing metric as ms with the rating colour", () => {
    perfFlag.value = true;
    const { container } = render(<PerfOverlay />);
    act(() => {
      webVitalsState.emit?.({
        name: "LCP",
        value: 1234.5,
        rating: "good",
      } as Metric);
    });
    const ms = screen.getByText("1235ms");
    expect(ms.getAttribute("class")).toContain("emerald");
    // Subsequent emits replace, not append
    expect(container.querySelectorAll("li").length).toBe(5);
  });

  it("formats CLS to 3 decimals", () => {
    perfFlag.value = true;
    render(<PerfOverlay />);
    act(() => {
      webVitalsState.emit?.({
        name: "CLS",
        value: 0.0876,
        rating: "needs-improvement",
      } as Metric);
    });
    expect(screen.getByText("0.088")).toBeTruthy();
  });
});
