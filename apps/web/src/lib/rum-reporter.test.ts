import type { RumBeacon } from "@vyoh/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Metric } from "web-vitals";
import { startRumReporter } from "./rum-reporter";

const { subscribers } = vi.hoisted(() => ({
  subscribers: [] as Array<(m: Metric) => void>,
}));
vi.mock("@/lib/web-vitals", () => ({
  subscribeWebVitals: (reporter: (m: Metric) => void) => {
    subscribers.push(reporter);
    return () => subscribers.splice(subscribers.indexOf(reporter), 1);
  },
}));

function metric(overrides: Partial<Metric>): Metric {
  return {
    id: "v6-1790861459105-4815162342108",
    name: "LCP",
    value: 1000,
    rating: "good",
    delta: 0,
    entries: [],
    navigationType: "navigate",
    ...overrides,
  } as Metric;
}

const emit = (m: Metric) => {
  for (const s of subscribers) s(m);
};

function setNavigator(props: Record<string, unknown>) {
  for (const [key, value] of Object.entries(props)) {
    Object.defineProperty(navigator, key, { value, configurable: true });
  }
}

function hide() {
  Object.defineProperty(document, "visibilityState", {
    value: "hidden",
    configurable: true,
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

const sendBeacon = vi.fn((_url: string, _body: string) => true);
const beacons = () =>
  sendBeacon.mock.calls.map(([, body]) => JSON.parse(body) as RumBeacon);

let stop: () => void = () => {};

beforeEach(() => {
  sendBeacon.mockClear();
  sendBeacon.mockImplementation(() => true);
  setNavigator({ sendBeacon, webdriver: false });
});

afterEach(() => {
  stop();
  subscribers.length = 0;
  Object.defineProperty(document, "visibilityState", {
    value: "visible",
    configurable: true,
  });
});

describe("startRumReporter", () => {
  it("beacons the latest value of each metric when the page is hidden", () => {
    stop = startRumReporter("/lol/$accountSlug/matches");
    emit(metric({ value: 1000 }));
    emit(metric({ value: 1200, rating: "good" }));
    emit(metric({ id: "v6-1790861459105-1234567890123", name: "CLS", value: 0.02 }));
    hide();

    expect(sendBeacon).toHaveBeenCalledTimes(1);
    expect(sendBeacon.mock.calls[0]?.[0]).toMatch(/\/rum$/);
    expect(beacons()[0]).toMatchObject({
      route: "/lol/$accountSlug/matches",
      navigationType: "navigate",
      samples: [
        {
          id: "v6-1790861459105-4815162342108",
          name: "LCP",
          value: 1200,
          rating: "good",
        },
        { id: "v6-1790861459105-1234567890123", name: "CLS", value: 0.02 },
      ],
    });
  });

  it("sends again only what changed since the last beacon", () => {
    stop = startRumReporter("/");
    emit(metric({}));
    emit(metric({ id: "v6-1790861459105-1234567890123", name: "CLS", value: 0.02 }));
    hide();
    emit(metric({ id: "v6-1790861459105-1234567890123", name: "CLS", value: 0.05 }));
    hide();
    window.dispatchEvent(new Event("pagehide"));

    expect(sendBeacon).toHaveBeenCalledTimes(2);
    expect(beacons()[1]?.samples).toEqual([
      expect.objectContaining({ name: "CLS", value: 0.05 }),
    ]);
  });

  it("keeps a sample pending when the browser refuses the beacon", () => {
    stop = startRumReporter("/");
    emit(metric({}));
    sendBeacon.mockImplementationOnce(() => false);
    hide();
    hide();

    expect(sendBeacon).toHaveBeenCalledTimes(2);
    expect(beacons()[1]?.samples).toHaveLength(1);
  });

  it("batches a bfcache restore separately, since the navigation type is per beacon", () => {
    stop = startRumReporter("/steam");
    emit(metric({}));
    emit(
      metric({
        id: "v6-1790861469105-1234567890123",
        navigationType: "back-forward-cache",
      })
    );
    hide();

    expect(
      beacons()
        .map((b) => b.navigationType)
        .sort()
    ).toEqual(["back-forward-cache", "navigate"]);
  });

  it("reports nothing from a headless browser", () => {
    setNavigator({ webdriver: true });
    stop = startRumReporter("/");
    emit(metric({}));
    hide();

    expect(subscribers).toHaveLength(0);
    expect(sendBeacon).not.toHaveBeenCalled();
  });
});
