import { mainScrollRef } from "@/lib/scroll-container";
import { registerOpenDetailPanel } from "@/lib/scroll-container-context";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MotionConfig } from "motion/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ScrollToTop } from "./scroll-to-top";

describe("ScrollToTop", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    Object.defineProperty(container, "scrollTop", {
      value: 0,
      writable: true,
      configurable: true,
    });
    container.scrollTo = vi.fn() as unknown as Element["scrollTo"];
    mainScrollRef.current = container;
  });

  afterEach(() => {
    mainScrollRef.current = null;
  });

  it("is hidden when scrollTop is below the threshold", () => {
    render(
      <MotionConfig reducedMotion="always">
        <ScrollToTop />
      </MotionConfig>
    );
    expect(screen.queryByRole("button", { name: "Scroll to top" })).toBeNull();
  });

  it("becomes visible once scrollTop crosses the threshold", () => {
    render(
      <MotionConfig reducedMotion="always">
        <ScrollToTop />
      </MotionConfig>
    );
    act(() => {
      Object.defineProperty(container, "scrollTop", {
        value: 1000,
        writable: true,
        configurable: true,
      });
      fireEvent.scroll(container);
    });
    expect(screen.getByRole("button", { name: "Scroll to top" })).toBeTruthy();
  });

  it("scrolls the container to the top when clicked", () => {
    render(
      <MotionConfig reducedMotion="always">
        <ScrollToTop />
      </MotionConfig>
    );
    act(() => {
      Object.defineProperty(container, "scrollTop", {
        value: 1000,
        writable: true,
        configurable: true,
      });
      fireEvent.scroll(container);
    });
    fireEvent.click(screen.getByRole("button", { name: "Scroll to top" }));
    expect(container.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
  });

  // The button targets main scroll, which a detail panel locks, and it sits
  // above the panel in z-order — so it has to yield while one is open.
  it("hides itself while a detail panel is registered and returns after dispose", () => {
    render(
      <MotionConfig reducedMotion="always">
        <ScrollToTop />
      </MotionConfig>
    );
    act(() => {
      Object.defineProperty(container, "scrollTop", {
        value: 1000,
        writable: true,
        configurable: true,
      });
      fireEvent.scroll(container);
    });
    expect(screen.getByRole("button", { name: "Scroll to top" })).toBeTruthy();

    let dispose!: () => void;
    act(() => {
      dispose = registerOpenDetailPanel();
    });
    // Removal is synchronous here: `act` flushes AnimatePresence's exit, so
    // there is no deferred-unmount window to wait on.
    expect(screen.queryByRole("button", { name: "Scroll to top" })).toBeNull();

    act(() => {
      dispose();
    });
    expect(screen.getByRole("button", { name: "Scroll to top" })).toBeTruthy();
  });
});
