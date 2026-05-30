import { mainScrollRef } from "@/lib/scroll-container";
import { fireEvent, render, screen } from "@testing-library/react";
import { configureAxe } from "jest-axe";
import { MotionConfig } from "motion/react";
import { type ReactNode, type RefObject, createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SectionTab } from "./section-nav";
import { SectionShell } from "./section-shell";

// Tabs/live render via TanStack <Link>; stub it to a plain anchor (dropping the
// router-only props) so the strip mounts without a RouterProvider.
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    params: _params,
    search: _search,
    ...rest
  }: {
    children: ReactNode;
    to?: string;
    params?: unknown;
    search?: unknown;
  }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}));

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

const IconStub = () => <span data-testid="icon" />;

// color-contrast needs real computed styles (absent in happy-dom); aria-hidden-focus
// is a known Radix/happy-dom false positive (mirrors accessibility.test.tsx).
const axe = configureAxe({
  rules: {
    "color-contrast": { enabled: false },
    "aria-hidden-focus": { enabled: false },
  },
});

const TABS: SectionTab[] = [
  { to: "/profile", label: "Profile", Icon: IconStub, active: true },
  { to: "/matches", label: "Matches", Icon: IconStub, active: false },
];

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
        tabs={TABS}
        tabIndicatorId="test-tab-indicator"
        {...props}
      >
        <p>section body</p>
      </SectionShell>
    </MotionConfig>
  );
}

describe("SectionShell", () => {
  it("renders identity, actions, tabs and children", () => {
    renderShell();
    expect(screen.getByText("identity")).toBeTruthy();
    expect(screen.getByRole("button", { name: "act" })).toBeTruthy();
    // Tab labels render in the always-mounted full-row nav.
    expect(screen.getByRole("navigation", { name: "Section tabs" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Matches" })).toBeTruthy();
    expect(screen.getByText("section body")).toBeTruthy();
  });

  it("renders the collapsed section dropdown trigger alongside the tab row", () => {
    renderShell();
    // The dropdown trigger is always in the DOM (CSS hides it at ≥820px);
    // its accessible name is the neutral "Sections" label.
    expect(screen.getByRole("button", { name: "Sections" })).toBeTruthy();
  });

  it("has no axe violations for the merged strip (tabs + dropdown + live + actions)", async () => {
    renderShell({ live: { to: "/live", active: false } });
    // The strip is portaled into the slot in document.body, not the RTL
    // container — scan the slot subtree.
    const slot = document.getElementById("section-header-slot");
    expect(slot).not.toBeNull();
    const results = await axe(slot as HTMLElement);
    expect(results.violations).toEqual([]);
  });

  it("renders the leading slot when provided, omits it otherwise", () => {
    const { rerender } = renderShell();
    expect(screen.queryByText("‹ back")).toBeNull();
    rerender(
      <MotionConfig reducedMotion="always">
        <SectionShell
          identity={<span>identity</span>}
          leading={<span>‹ back</span>}
          tabs={TABS}
          tabIndicatorId="test-tab-indicator"
        >
          <p>section body</p>
        </SectionShell>
      </MotionConfig>
    );
    expect(screen.getByText("‹ back")).toBeTruthy();
  });

  it("renders no section nav when tabs is empty", () => {
    renderShell({ tabs: [] });
    expect(screen.queryByRole("navigation", { name: "Section tabs" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Sections" })).toBeNull();
    expect(screen.getByText("identity")).toBeTruthy();
  });

  it("renders the live chip only when a live route is provided", () => {
    const { rerender } = renderShell();
    expect(screen.queryByRole("link", { name: "Live game" })).toBeNull();
    rerender(
      <MotionConfig reducedMotion="always">
        <SectionShell
          identity={<span>identity</span>}
          tabs={TABS}
          tabIndicatorId="test-tab-indicator"
          live={{ to: "/live", active: false }}
        >
          <p>section body</p>
        </SectionShell>
      </MotionConfig>
    );
    expect(screen.getByRole("link", { name: "Live game" })).toBeTruthy();
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

  it("only renders the actions button when actions are provided", () => {
    renderShell({ actions: undefined });
    expect(screen.queryByRole("button", { name: "act" })).toBeNull();
    // Identity is in the portaled header (in document.body), not in the RTL
    // container — query via screen so the body subtree is searched.
    expect(screen.getByText("identity")).toBeTruthy();
  });
});
