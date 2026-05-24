import { describe, expect, it, vi } from "vitest";
import { emitRouteTransitionStart, onRouteTransitionStart } from "./route-transition-bus";

describe("route-transition-bus", () => {
  it("invokes every subscribed listener on emit", () => {
    const a = vi.fn();
    const b = vi.fn();
    const unsubA = onRouteTransitionStart(a);
    const unsubB = onRouteTransitionStart(b);

    emitRouteTransitionStart();

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);

    unsubA();
    unsubB();
  });

  it("stops invoking a listener after its unsubscribe is called", () => {
    const listener = vi.fn();
    const unsubscribe = onRouteTransitionStart(listener);

    emitRouteTransitionStart();
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    emitRouteTransitionStart();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("does not error on emit with zero subscribers", () => {
    expect(() => emitRouteTransitionStart()).not.toThrow();
  });
});
