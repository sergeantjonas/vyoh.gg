import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `vi.mock` is hoisted — the factory must be self-contained (no
// references to test-file top-level vars). Build the fake main here and
// re-import it below via `mainScrollRef.current` so tests can mutate
// scrollTop / read scrollTo calls.
vi.mock("@/lib/scroll-container", () => ({
  mainScrollRef: {
    current: {
      scrollTop: 0,
      clientHeight: 800,
      scrollTo: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      getBoundingClientRect: () => ({ top: 0, bottom: 800 }) as DOMRect,
    },
  },
}));

import { mainScrollRef } from "@/lib/scroll-container";

import { NextChapterCaret } from "./next-chapter-caret";

const fakeMain = mainScrollRef.current as unknown as {
  scrollTop: number;
  clientHeight: number;
  scrollTo: ReturnType<typeof vi.fn>;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
  getBoundingClientRect: () => DOMRect;
};

// Synthesize chapter outer-divs with known geometry. `top` is the
// boundingClientRect.top value (viewport-relative).
function mountChapters(specs: Array<{ label: string; topPx: number }>) {
  for (const spec of specs) {
    const div = document.createElement("div");
    div.setAttribute("data-recap-chapter", spec.label);
    div.setAttribute("data-chapter-label", spec.label);
    Object.defineProperty(div, "getBoundingClientRect", {
      configurable: true,
      value: () =>
        ({
          top: spec.topPx,
          bottom: spec.topPx + 800,
          left: 0,
          right: 0,
        }) as DOMRect,
    });
    document.body.appendChild(div);
  }
}

beforeEach(() => {
  fakeMain.scrollTop = 0;
  fakeMain.scrollTo.mockClear();
  fakeMain.addEventListener.mockClear();
  fakeMain.removeEventListener.mockClear();
});

afterEach(() => {
  // Clean up chapter divs between tests so each test's mountChapters
  // starts from an empty DOM.
  for (const node of document.querySelectorAll("[data-recap-chapter]")) {
    node.remove();
  }
});

describe("NextChapterCaret", () => {
  it("renders nothing when there are no chapter elements in the DOM", () => {
    render(<NextChapterCaret />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("renders nothing when the user is past the last chapter", () => {
    mountChapters([{ label: "Ahri", topPx: -2000 }]);
    fakeMain.scrollTop = 5000;
    render(<NextChapterCaret />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("renders the caret pointing at the first chapter when at the top of the page", () => {
    mountChapters([
      { label: "Ahri", topPx: 800 },
      { label: "Resident Evil 4", topPx: 1600 },
    ]);
    render(<NextChapterCaret />);
    expect(screen.getByRole("button", { name: "Scroll to Ahri" })).toBeTruthy();
    expect(screen.getByText("Ahri")).toBeTruthy();
  });

  it("flips the label to the FOLLOWING chapter once the user is inside the current one", () => {
    // Ahri at viewport top (just nudged), RE4 below.
    mountChapters([
      { label: "Ahri", topPx: 0 },
      { label: "Resident Evil 4", topPx: 800 },
    ]);
    fakeMain.scrollTop = 0;
    render(<NextChapterCaret />);
    // Dead-zone (SKIP_PAST_PX = 80) skips the current chapter — caret
    // points at RE4, not Ahri.
    expect(
      screen.getByRole("button", { name: "Scroll to Resident Evil 4" })
    ).toBeTruthy();
  });

  it("scrolls the main container to the target chapter top on click", () => {
    mountChapters([{ label: "Ahri", topPx: 800 }]);
    render(<NextChapterCaret />);
    fireEvent.click(screen.getByRole("button"));
    expect(fakeMain.scrollTo).toHaveBeenCalledWith(
      expect.objectContaining({ top: 800, behavior: "smooth" })
    );
  });

  it("re-computes the target chapter on scroll", () => {
    mountChapters([
      { label: "Ahri", topPx: 800 },
      { label: "Resident Evil 4", topPx: 1600 },
    ]);
    render(<NextChapterCaret />);
    expect(screen.getByText("Ahri")).toBeTruthy();
    // Capture the scroll listener registered against fakeMain.
    const onScroll = fakeMain.addEventListener.mock.calls.find(
      ([type]) => type === "scroll"
    )?.[1] as () => void;
    expect(onScroll).toBeDefined();
    // Simulate scrolling past Ahri — bounding rects move up by 800px.
    fakeMain.scrollTop = 800;
    for (const node of document.querySelectorAll<HTMLElement>("[data-recap-chapter]")) {
      const label = node.dataset.chapterLabel as string;
      const newTop = label === "Ahri" ? 0 : 800;
      Object.defineProperty(node, "getBoundingClientRect", {
        configurable: true,
        value: () => ({ top: newTop, bottom: newTop + 800 }) as DOMRect,
      });
    }
    act(() => onScroll());
    expect(
      screen.getByRole("button", { name: "Scroll to Resident Evil 4" })
    ).toBeTruthy();
  });
});
