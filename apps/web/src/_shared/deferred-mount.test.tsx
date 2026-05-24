import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeferredMount } from "./deferred-mount";

type Observer = {
  observe: ReturnType<typeof vi.fn>;
  unobserve: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  trigger: (isIntersecting: boolean) => void;
};

const observers: Observer[] = [];

class FakeIntersectionObserver implements Observer {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  callback: IntersectionObserverCallback;
  constructor(cb: IntersectionObserverCallback) {
    this.callback = cb;
    observers.push(this);
  }
  // Fire the callback synchronously inside an `act` from the test body —
  // mimics the browser dispatching IO entries from the scroll observer.
  trigger(isIntersecting: boolean) {
    this.callback(
      [{ isIntersecting } as unknown as IntersectionObserverEntry],
      this as unknown as IntersectionObserver
    );
  }
}

beforeEach(() => {
  observers.length = 0;
  vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("DeferredMount", () => {
  it("renders a sized placeholder before the wrapper intersects the viewport", () => {
    const { container } = render(
      <DeferredMount minHeight={300}>
        <p>real content</p>
      </DeferredMount>
    );
    expect(screen.queryByText("real content")).toBeNull();
    const placeholder = container.firstElementChild as HTMLElement;
    expect(placeholder.style.minHeight).toBe("300px");
  });

  it("mounts the child when the observer fires with isIntersecting=true", () => {
    render(
      <DeferredMount>
        <p>real content</p>
      </DeferredMount>
    );
    expect(screen.queryByText("real content")).toBeNull();
    const io = observers[0];
    if (!io) throw new Error("IO not created");
    act(() => io.trigger(true));
    expect(screen.getByText("real content")).toBeTruthy();
    // Observer disconnects after the first intersection so further
    // visibility changes don't churn React state.
    expect(io.disconnect).toHaveBeenCalled();
  });

  it("keeps the child mounted after a subsequent non-intersecting tick", () => {
    render(
      <DeferredMount>
        <p>real content</p>
      </DeferredMount>
    );
    const io = observers[0];
    if (!io) throw new Error("IO not created");
    act(() => io.trigger(true));
    // No new observer is created after mount, so calling trigger(false)
    // through the original observer ref is the only path back — and the
    // mount stays. Reads from the disconnected observer are inert.
    act(() => io.trigger(false));
    expect(screen.getByText("real content")).toBeTruthy();
  });

  it("mounts immediately and skips the observer entirely when eager is true", () => {
    render(
      <DeferredMount eager>
        <p>real content</p>
      </DeferredMount>
    );
    expect(screen.getByText("real content")).toBeTruthy();
    expect(observers.length).toBe(0);
  });
});
