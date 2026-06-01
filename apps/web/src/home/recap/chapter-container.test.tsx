import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mainScrollRef } from "@/lib/scroll-container";

vi.mock("motion/react", async () => {
  const actual = await vi.importActual<typeof import("motion/react")>("motion/react");
  return {
    ...actual,
    useReducedMotion: vi.fn(() => false),
  };
});

import { useReducedMotion } from "motion/react";

import { ChapterContainer } from "./chapter-container";
import { ChapterProgressContext } from "./chapter-context";

const useReducedMotionMock = vi.mocked(useReducedMotion);

describe("ChapterContainer", () => {
  beforeEach(() => {
    useReducedMotionMock.mockReturnValue(false);
    mainScrollRef.current = document.createElement("div");
  });

  afterEach(() => {
    mainScrollRef.current = null;
  });

  it("renders its children inside the sticky pin wrapper", () => {
    const { container } = render(
      <ChapterContainer slug="ahri">
        <div data-testid="content">content</div>
      </ChapterContainer>
    );
    const section = container.querySelector("[data-chapter='ahri']");
    expect(section).toBeTruthy();
    const pin = section?.querySelector("[data-chapter-pin]");
    expect(pin).toBeTruthy();
    expect(pin?.querySelector("[data-testid='content']")).toBeTruthy();
  });

  it("applies the pin-viewports height to the outer section", () => {
    const { container } = render(
      <ChapterContainer pinViewports={1.5}>
        <div />
      </ChapterContainer>
    );
    const section = container.querySelector("section") as HTMLElement | null;
    expect(section?.style.height).toBe("calc(1.5 * 100dvh)");
    expect(section?.getAttribute("data-pin")).toBe("on");
  });

  it("collapses the pin under reduced motion — no fixed height, no sticky", () => {
    useReducedMotionMock.mockReturnValue(true);
    const { container } = render(
      <ChapterContainer pinViewports={2}>
        <div />
      </ChapterContainer>
    );
    const section = container.querySelector("section") as HTMLElement | null;
    expect(section?.style.height).toBe("");
    expect(section?.getAttribute("data-pin")).toBe("off");
    const pin = container.querySelector("[data-chapter-pin]") as HTMLElement | null;
    expect(pin?.className).not.toContain("sticky");
    expect(pin?.className).not.toContain("h-dvh");
  });

  it("forwards aria-label to the section landmark when provided", () => {
    const { container } = render(
      <ChapterContainer ariaLabel="Your Ahri">
        <div />
      </ChapterContainer>
    );
    const section = container.querySelector("section");
    expect(section?.getAttribute("aria-label")).toBe("Your Ahri");
  });

  it("publishes a MotionValue<number> on ChapterProgressContext", () => {
    const slot: { mv: { get: () => number } | null } = { mv: null };
    function Probe() {
      return (
        <ChapterProgressContext.Consumer>
          {(value) => {
            if (value) slot.mv = value as unknown as { get: () => number };
            return null;
          }}
        </ChapterProgressContext.Consumer>
      );
    }
    render(
      <ChapterContainer>
        <Probe />
      </ChapterContainer>
    );
    expect(slot.mv).not.toBeNull();
    if (!slot.mv) throw new Error("ChapterProgressContext did not provide a value");
    // MotionValue exposes `.get()`; starting state is 0 (chapter not yet
    // in pin window during tests where rects are zero-height).
    expect(typeof slot.mv.get).toBe("function");
    expect(slot.mv.get()).toBe(0);
  });
});
