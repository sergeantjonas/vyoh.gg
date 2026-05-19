import { mainScrollRef } from "@/lib/scroll-container";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useScrollspy } from "./use-scrollspy";

const SECTION_IDS = ["a", "b", "c"] as const;

let rafCallbacks: FrameRequestCallback[] = [];

beforeEach(() => {
  rafCallbacks = [];
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    rafCallbacks.push(cb);
    return rafCallbacks.length;
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  mainScrollRef.current = null;
  document.body.innerHTML = "";
});

function flushRaf() {
  const cbs = rafCallbacks;
  rafCallbacks = [];
  for (const cb of cbs) cb(0);
}

function makeScrollEl(): HTMLDivElement {
  const el = document.createElement("div");
  // scrollTop is writable so navigateTo can be exercised
  Object.defineProperty(el, "scrollTop", { value: 0, writable: true });
  el.scrollTo = vi.fn() as unknown as Element["scrollTo"];
  return el;
}

function makeSection(id: string, top: number): HTMLElement {
  const el = document.createElement("section");
  el.dataset.id = id;
  el.getBoundingClientRect = () =>
    ({
      top,
      bottom: top + 100,
      height: 100,
      left: 0,
      right: 0,
      width: 0,
      x: 0,
      y: top,
    }) as DOMRect;
  return el;
}

describe("useScrollspy", () => {
  it("returns the first id as the initial active id", () => {
    mainScrollRef.current = makeScrollEl();
    const { result } = renderHook(() => useScrollspy(SECTION_IDS));
    expect(result.current.activeId).toBe("a");
  });

  it("falls back to '' when ids is empty", () => {
    mainScrollRef.current = makeScrollEl();
    const { result } = renderHook(() => useScrollspy([]));
    expect(result.current.activeId).toBe("");
  });

  it("does nothing when mainScrollRef is null (no listener attached)", () => {
    mainScrollRef.current = null;
    const { result } = renderHook(() => useScrollspy(SECTION_IDS));
    expect(result.current.activeId).toBe("a");
  });

  it("updates activeId to the last section whose top is at or above threshold", () => {
    const scrollEl = makeScrollEl();
    mainScrollRef.current = scrollEl;
    const { result } = renderHook(() => useScrollspy(SECTION_IDS));

    const sectionB = makeSection("b", 100);
    const sectionC = makeSection("c", 500);
    act(() => {
      result.current.refFor("b")(sectionB);
      result.current.refFor("c")(sectionC);
    });

    // No champion strip / header — threshold falls back to 96 + 80 = 176.
    // sectionB.top=100 ≤ 176 → active; sectionC.top=500 > 176 → not active.
    act(() => {
      scrollEl.dispatchEvent(new Event("scroll"));
    });
    expect(result.current.activeId).toBe("b");
  });

  it("uses the champion-strip rect.bottom as the threshold when present", () => {
    const scrollEl = makeScrollEl();
    mainScrollRef.current = scrollEl;
    const strip = document.createElement("div");
    strip.setAttribute("data-champion-strip", "");
    strip.getBoundingClientRect = () =>
      ({
        bottom: 300,
        height: 50,
        top: 250,
        left: 0,
        right: 0,
        width: 0,
        x: 0,
        y: 250,
      }) as DOMRect;
    document.body.appendChild(strip);

    const { result } = renderHook(() => useScrollspy(SECTION_IDS));
    const sectionB = makeSection("b", 200);
    act(() => {
      result.current.refFor("b")(sectionB);
    });
    act(() => {
      scrollEl.dispatchEvent(new Event("scroll"));
    });
    // 200 ≤ 300 → b is active
    expect(result.current.activeId).toBe("b");
  });

  it("uses the account-header bottom + 80 when no strip is present", () => {
    const scrollEl = makeScrollEl();
    mainScrollRef.current = scrollEl;
    const header = document.createElement("div");
    header.setAttribute("data-account-header", "");
    header.getBoundingClientRect = () =>
      ({
        bottom: 60,
        height: 40,
        top: 20,
        left: 0,
        right: 0,
        width: 0,
        x: 0,
        y: 20,
      }) as DOMRect;
    document.body.appendChild(header);

    const { result } = renderHook(() => useScrollspy(SECTION_IDS));
    // threshold = 60 + 80 = 140
    const sectionB = makeSection("b", 130);
    const sectionC = makeSection("c", 150);
    act(() => {
      result.current.refFor("b")(sectionB);
      result.current.refFor("c")(sectionC);
    });
    act(() => {
      scrollEl.dispatchEvent(new Event("scroll"));
    });
    expect(result.current.activeId).toBe("b");
  });

  it("re-evaluates on next animation frame when a section ref mounts", () => {
    const scrollEl = makeScrollEl();
    mainScrollRef.current = scrollEl;
    const { result } = renderHook(() => useScrollspy(SECTION_IDS));

    const sectionB = makeSection("b", 50);
    act(() => {
      result.current.refFor("b")(sectionB);
    });
    expect(result.current.activeId).toBe("a");
    act(() => {
      flushRaf();
    });
    expect(result.current.activeId).toBe("b");
  });

  it("removes the element from the map when ref is called with null", () => {
    const scrollEl = makeScrollEl();
    mainScrollRef.current = scrollEl;
    const { result } = renderHook(() => useScrollspy(SECTION_IDS));
    const sectionB = makeSection("b", 50);
    act(() => {
      result.current.refFor("b")(sectionB);
    });
    act(() => {
      flushRaf();
    });
    expect(result.current.activeId).toBe("b");

    act(() => {
      result.current.refFor("b")(null);
    });
    // Detach should mean evaluate sees no eligible section beyond default "a"
    act(() => {
      scrollEl.dispatchEvent(new Event("scroll"));
    });
    expect(result.current.activeId).toBe("a");
  });

  it("navigateTo scrolls the main container by section top minus threshold", () => {
    const scrollEl = makeScrollEl();
    Object.defineProperty(scrollEl, "scrollTop", { value: 200, writable: true });
    mainScrollRef.current = scrollEl;
    const { result } = renderHook(() => useScrollspy(SECTION_IDS));
    const sectionC = makeSection("c", 400);
    act(() => {
      result.current.refFor("c")(sectionC);
    });

    act(() => {
      result.current.navigateTo("c");
    });
    // threshold = 96 + 80 = 176; top = scrollTop(200) + rect.top(400) - 176 = 424
    expect(scrollEl.scrollTo).toHaveBeenCalledWith({ top: 424, behavior: "smooth" });
  });

  it("navigateTo with smooth=false uses behavior 'auto'", () => {
    const scrollEl = makeScrollEl();
    mainScrollRef.current = scrollEl;
    const { result } = renderHook(() => useScrollspy(SECTION_IDS));
    const sectionC = makeSection("c", 400);
    act(() => {
      result.current.refFor("c")(sectionC);
    });
    act(() => {
      result.current.navigateTo("c", false);
    });
    expect(scrollEl.scrollTo).toHaveBeenCalledWith(
      expect.objectContaining({ behavior: "auto" })
    );
  });

  it("navigateTo is a no-op when the section is unknown or scrollEl is missing", () => {
    const scrollEl = makeScrollEl();
    mainScrollRef.current = scrollEl;
    const { result } = renderHook(() => useScrollspy(SECTION_IDS));
    act(() => {
      result.current.navigateTo("missing");
    });
    expect(scrollEl.scrollTo).not.toHaveBeenCalled();
  });

  it("removes the scroll listener on unmount", () => {
    const scrollEl = makeScrollEl();
    const removeSpy = vi.spyOn(scrollEl, "removeEventListener");
    mainScrollRef.current = scrollEl;
    const { unmount } = renderHook(() => useScrollspy(SECTION_IDS));
    unmount();
    expect(removeSpy).toHaveBeenCalledWith("scroll", expect.any(Function));
  });
});
