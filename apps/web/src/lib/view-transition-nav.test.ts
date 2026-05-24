import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  navigateWithViewTransition,
  supportsViewTransitions,
  withReorderViewTransition,
} from "./view-transition-nav";

type StartVT = (cb: () => void | Promise<void>) => unknown;
// The DOM lib declares `startViewTransition` as non-optional, but happy-dom
// doesn't ship it. Cast through unknown so the test setup can install/remove
// the property without TS treating it as required.
const docVT = document as unknown as { startViewTransition?: StartVT };

const installStartViewTransition = (impl: StartVT) => {
  docVT.startViewTransition = impl;
};

const removeStartViewTransition = () => {
  Reflect.deleteProperty(docVT, "startViewTransition");
};

describe("supportsViewTransitions", () => {
  afterEach(removeStartViewTransition);

  it("returns false when document lacks startViewTransition (happy-dom default)", () => {
    expect(supportsViewTransitions()).toBe(false);
  });

  it("returns true once startViewTransition is present on document", () => {
    installStartViewTransition((cb) => {
      void cb();
    });
    expect(supportsViewTransitions()).toBe(true);
  });
});

describe("navigateWithViewTransition", () => {
  beforeEach(removeStartViewTransition);

  afterEach(() => {
    removeStartViewTransition();
    vi.restoreAllMocks();
  });

  it("calls navigateFn directly when the API is unsupported", async () => {
    const navigateFn = vi.fn().mockResolvedValue(undefined);
    await navigateWithViewTransition(navigateFn);
    expect(navigateFn).toHaveBeenCalledTimes(1);
  });

  it("awaits async navigation in the unsupported path", async () => {
    const order: string[] = [];
    const navigateFn = vi.fn(async () => {
      await Promise.resolve();
      order.push("navigated");
    });
    await navigateWithViewTransition(navigateFn);
    order.push("after-await");
    expect(order).toEqual(["navigated", "after-await"]);
  });

  it("wraps navigateFn inside document.startViewTransition when supported", async () => {
    const startVT = vi.fn<StartVT>((cb) => {
      void cb();
    });
    installStartViewTransition(startVT);
    const navigateFn = vi.fn().mockResolvedValue(undefined);

    await navigateWithViewTransition(navigateFn);

    expect(startVT).toHaveBeenCalledTimes(1);
    expect(navigateFn).toHaveBeenCalledTimes(1);
  });

  it("awaits navigation inside the VT callback so the snapshot stays frozen", async () => {
    const order: string[] = [];
    const startVT = vi.fn<StartVT>(async (cb) => {
      order.push("vt-start");
      await cb();
      order.push("vt-end");
    });
    installStartViewTransition(startVT);
    const navigateFn = vi.fn(async () => {
      await Promise.resolve();
      order.push("navigated");
    });

    await navigateWithViewTransition(navigateFn);
    // The primitive does not await the VT callback (per the API contract:
    // startViewTransition returns immediately and runs the callback async).
    // Flush microtasks so the callback's awaits resolve before assertion.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(order).toEqual(["vt-start", "navigated", "vt-end"]);
  });
});

describe("withReorderViewTransition", () => {
  // Flush the helper's queued microtask. The helper defers its
  // startViewTransition call by one microtask so Radix Select/Popover
  // close-on-select handlers finish dispatching before parent state is
  // synchronously committed — without this Radix's dismissable-layer
  // gets stuck and the dropdown stops accepting clicks.
  const flushMicrotasks = () => Promise.resolve();

  beforeEach(removeStartViewTransition);

  afterEach(() => {
    removeStartViewTransition();
    vi.restoreAllMocks();
  });

  it("calls update directly when the API is unsupported (no microtask defer)", () => {
    const update = vi.fn();
    withReorderViewTransition(update);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it("wraps update inside startViewTransition on supported non-WebKit engines", async () => {
    // happy-dom reports an empty `navigator.vendor`, which is_webkit() treats
    // as non-WebKit — so without further mocking we land in the supported path.
    const startVT = vi.fn<StartVT>((cb) => {
      void cb();
      return { types: new Set<string>() };
    });
    installStartViewTransition(startVT);
    const update = vi.fn();

    withReorderViewTransition(update);
    // Before the microtask flush, neither the VT nor the update has run.
    expect(startVT).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();

    await flushMicrotasks();

    expect(startVT).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it("tags the transition with the `intra-section` type so the spring curve applies", async () => {
    const types = new Set<string>();
    const startVT = vi.fn<StartVT>((cb) => {
      void cb();
      return { types };
    });
    installStartViewTransition(startVT);

    withReorderViewTransition(() => {});
    await flushMicrotasks();

    expect(types.has("intra-section")).toBe(true);
  });

  it("tolerates engines that omit the `types` Set (older Chrome/Safari)", async () => {
    // Pre-Chrome-125 / pre-Safari-18.2 expose startViewTransition without the
    // types property. The helper must fall through silently rather than throw.
    const startVT = vi.fn<StartVT>((cb) => {
      void cb();
      return {};
    });
    installStartViewTransition(startVT);
    const update = vi.fn();

    withReorderViewTransition(update);
    await expect(flushMicrotasks()).resolves.not.toThrow();
    expect(update).toHaveBeenCalledTimes(1);
  });
});
