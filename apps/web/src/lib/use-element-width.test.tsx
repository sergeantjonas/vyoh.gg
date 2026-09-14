import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useElementWidth } from "./use-element-width";

type Callback = (entries: Array<{ contentRect: { width: number } }>) => void;

class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  observed: Element[] = [];
  disconnected = false;
  callback: Callback;
  constructor(callback: Callback) {
    this.callback = callback;
    FakeResizeObserver.instances.push(this);
  }
  observe(el: Element) {
    this.observed.push(el);
  }
  unobserve() {}
  disconnect() {
    this.disconnected = true;
  }
}

function Probe() {
  const { ref, width } = useElementWidth();
  return (
    <div ref={ref} data-testid="box">
      {width}
    </div>
  );
}

describe("useElementWidth", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    FakeResizeObserver.instances = [];
  });

  it("reads the element once mounted and follows resizes until unmount", () => {
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
    const { unmount } = render(<Probe />);
    const box = screen.getByTestId("box");
    // happy-dom lays nothing out, so the mount read is 0 and the observer
    // carries the real numbers.
    expect(box.textContent).toBe("0");
    const observer = FakeResizeObserver.instances[0];
    if (!observer) throw new Error("no observer");
    expect(observer.observed).toEqual([box]);
    act(() => observer.callback([{ contentRect: { width: 512 } }]));
    expect(box.textContent).toBe("512");
    unmount();
    expect(observer.disconnected).toBe(true);
  });

  it("settles for the mount read where ResizeObserver is missing", () => {
    vi.stubGlobal("ResizeObserver", undefined);
    render(<Probe />);
    expect(screen.getByTestId("box").textContent).toBe("0");
  });
});
