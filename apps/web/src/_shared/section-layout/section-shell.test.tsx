import { mainScrollRef } from "@/lib/scroll-container";
import { fireEvent, render, screen } from "@testing-library/react";
import { MotionConfig } from "motion/react";
import { type RefObject, createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SectionShell } from "./section-shell";

class FakeResizeObserver {
  observed: Element[] = [];
  callback: ResizeObserverCallback;
  constructor(cb: ResizeObserverCallback) {
    this.callback = cb;
  }
  observe(el: Element) {
    this.observed.push(el);
  }
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
  // SectionShell portals its header into #section-header-slot (declared in
  // __root.tsx). Mount a stand-in slot before each render so the portal has
  // a target — without it the header never renders and all header-related
  // assertions fail.
  const slot = document.createElement("div");
  slot.id = "section-header-slot";
  document.body.appendChild(slot);
});

afterEach(() => {
  vi.unstubAllGlobals();
  mainScrollRef.current = null;
  document.getElementById("section-header-slot")?.remove();
});

function renderShell(props: Partial<Parameters<typeof SectionShell>[0]> = {}) {
  return render(
    <MotionConfig reducedMotion="always">
      <SectionShell
        identity={<span>identity</span>}
        actions={<button type="button">act</button>}
        nav={<nav>nav</nav>}
        {...props}
      >
        <p>section body</p>
      </SectionShell>
    </MotionConfig>
  );
}

describe("SectionShell", () => {
  it("renders identity, actions, nav and children", () => {
    renderShell();
    expect(screen.getByText("identity")).toBeTruthy();
    expect(screen.getByRole("button", { name: "act" })).toBeTruthy();
    expect(screen.getByText("nav")).toBeTruthy();
    expect(screen.getByText("section body")).toBeTruthy();
  });

  it("forwards the header element to an external ref object", () => {
    const ref = createRef<HTMLElement>();
    renderShell({ headerRef: ref as RefObject<HTMLElement> });
    expect(ref.current).not.toBeNull();
    expect(ref.current?.tagName).toBe("HEADER");
  });

  it("forwards the header element to an external callback ref", () => {
    const fn = vi.fn();
    renderShell({ headerRef: fn });
    expect(fn).toHaveBeenCalled();
    const arg = fn.mock.calls[0]?.[0];
    expect(arg?.tagName).toBe("HEADER");
  });

  it("calls onHeaderRect with a DOMRect on mount", () => {
    const onHeaderRect = vi.fn();
    renderShell({ onHeaderRect });
    expect(onHeaderRect).toHaveBeenCalled();
    const rect = onHeaderRect.mock.calls[0]?.[0];
    expect(typeof rect.height).toBe("number");
    expect(typeof rect.top).toBe("number");
  });

  it("toggles the bandOpaque overlay when the main scroll container scrolls past 16px", () => {
    const scrollEl = document.createElement("div");
    Object.defineProperty(scrollEl, "scrollTop", { value: 32, writable: true });
    mainScrollRef.current = scrollEl;

    renderShell();
    fireEvent.scroll(scrollEl);
    // Header is portaled to #section-header-slot in document.body, not the
    // RTL container — query the slot directly.
    const overlay = document
      .getElementById("section-header-slot")
      ?.querySelector('[aria-hidden="true"]');
    expect(overlay).not.toBeNull();
    expect((overlay as HTMLElement).style.opacity).toBe("1");
  });

  it("leaves the band transparent while scrollTop is ≤16", () => {
    const scrollEl = document.createElement("div");
    Object.defineProperty(scrollEl, "scrollTop", { value: 4, writable: true });
    mainScrollRef.current = scrollEl;

    renderShell();
    fireEvent.scroll(scrollEl);
    const overlay = document
      .getElementById("section-header-slot")
      ?.querySelector('[aria-hidden="true"]');
    expect((overlay as HTMLElement).style.opacity).toBe("0");
  });

  it("only renders the actions container element when actions are provided", () => {
    const { rerender } = renderShell({ actions: undefined });
    expect(screen.queryByRole("button", { name: "act" })).toBeNull();
    rerender(
      <MotionConfig reducedMotion="always">
        <SectionShell identity={<span>identity</span>} nav={<nav>nav</nav>}>
          <p>body</p>
        </SectionShell>
      </MotionConfig>
    );
    // Identity is in the portaled header (in document.body), not in the
    // RTL container — query via screen so the body subtree is searched.
    expect(screen.getByText("identity")).toBeTruthy();
  });
});
