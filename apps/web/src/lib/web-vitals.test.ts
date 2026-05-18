import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// One callback per web-vitals helper; the bus retains them so we can fire
// synthetic metrics from a test without standing up a real browser.
const reporters: Record<string, ((metric: unknown) => void) | undefined> = {
  CLS: undefined,
  FCP: undefined,
  INP: undefined,
  LCP: undefined,
  TTFB: undefined,
};

vi.mock("web-vitals", () => ({
  onCLS: (cb: (m: unknown) => void) => {
    reporters.CLS = cb;
  },
  onFCP: (cb: (m: unknown) => void) => {
    reporters.FCP = cb;
  },
  onINP: (cb: (m: unknown) => void) => {
    reporters.INP = cb;
  },
  onLCP: (cb: (m: unknown) => void) => {
    reporters.LCP = cb;
  },
  onTTFB: (cb: (m: unknown) => void) => {
    reporters.TTFB = cb;
  },
}));

describe("subscribeWebVitals / reportWebVitals", () => {
  beforeEach(() => {
    vi.resetModules();
    for (const k of Object.keys(reporters)) reporters[k] = undefined;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("broadcasts metrics to every subscribed reporter", async () => {
    const { subscribeWebVitals } = await import("./web-vitals");
    const sub = vi.fn();
    subscribeWebVitals(sub);
    const sample = { name: "CLS", value: 0.05, rating: "good" };
    reporters.CLS?.(sample);
    expect(sub).toHaveBeenCalledWith(sample);
  });

  it("replays the latest metric for late subscribers", async () => {
    const { subscribeWebVitals } = await import("./web-vitals");
    subscribeWebVitals(vi.fn());
    const sample = { name: "LCP", value: 1234, rating: "good" };
    reporters.LCP?.(sample);

    const lateSub = vi.fn();
    subscribeWebVitals(lateSub);
    expect(lateSub).toHaveBeenCalledWith(sample);
  });

  it("returns an unsubscribe function that stops broadcasts to that reporter", async () => {
    const { subscribeWebVitals } = await import("./web-vitals");
    const sub = vi.fn();
    const unsubscribe = subscribeWebVitals(sub);
    unsubscribe();
    reporters.FCP?.({ name: "FCP", value: 800, rating: "good" });
    expect(sub).not.toHaveBeenCalled();
  });

  it("only initializes the web-vitals listeners once across many subscribe calls", async () => {
    const { subscribeWebVitals } = await import("./web-vitals");
    subscribeWebVitals(vi.fn());
    const firstCls = reporters.CLS;
    subscribeWebVitals(vi.fn());
    // If start() ran twice we'd have re-bound the CLS callback.
    expect(reporters.CLS).toBe(firstCls);
  });

  it("reportWebVitals defaults to a console reporter that logs without throwing", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const { reportWebVitals } = await import("./web-vitals");
    reportWebVitals();
    reporters.CLS?.({ name: "CLS", value: 0.123, rating: "good" });
    reporters.LCP?.({ name: "LCP", value: 1500, rating: "needs-improvement" });
    reporters.TTFB?.({ name: "TTFB", value: 100, rating: "poor" });
    expect(info).toHaveBeenCalled();
  });
});
