import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("motion/react", async () => {
  const actual = await vi.importActual<typeof import("motion/react")>("motion/react");
  return {
    ...actual,
    useReducedMotion: vi.fn(() => false),
  };
});

import { useReducedMotion } from "motion/react";

import { ChapterContainer } from "./chapter-container";

const useReducedMotionMock = vi.mocked(useReducedMotion);

describe("ChapterContainer", () => {
  beforeEach(() => {
    useReducedMotionMock.mockReturnValue(false);
  });

  afterEach(() => {
    useReducedMotionMock.mockReset();
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

  it("scales outer height by beats × beatViewports when beats > 1", () => {
    const { container } = render(
      <ChapterContainer beats={4} beatViewports={0.6}>
        <div />
      </ChapterContainer>
    );
    const section = container.querySelector("section") as HTMLElement | null;
    expect(section?.style.height).toBe("calc(2.4 * 100dvh)");
    expect(section?.getAttribute("data-beats")).toBe("4");
  });

  it("omits the data-beats attribute on single-pin chapters (default beats=1)", () => {
    const { container } = render(
      <ChapterContainer>
        <div />
      </ChapterContainer>
    );
    const section = container.querySelector("section");
    expect(section?.getAttribute("data-beats")).toBeNull();
  });

  it("multi-beat chapters still collapse under reduced motion", () => {
    useReducedMotionMock.mockReturnValue(true);
    const { container } = render(
      <ChapterContainer beats={4} beatViewports={0.6}>
        <div />
      </ChapterContainer>
    );
    const section = container.querySelector("section") as HTMLElement | null;
    expect(section?.style.height).toBe("");
    expect(section?.getAttribute("data-pin")).toBe("off");
  });

  it("uses the default beatViewports when only beats is provided", () => {
    const { container } = render(
      <ChapterContainer beats={3}>
        <div />
      </ChapterContainer>
    );
    const section = container.querySelector("section") as HTMLElement | null;
    // 3 × 0.6 → rounded to 1.8 to avoid floating-point noise in the calc().
    expect(section?.style.height).toBe("calc(1.8 * 100dvh)");
  });
});
