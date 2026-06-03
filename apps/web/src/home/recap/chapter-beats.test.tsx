import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("motion/react", async () => {
  const actual = await vi.importActual<typeof import("motion/react")>("motion/react");
  return {
    ...actual,
    useReducedMotion: vi.fn(() => false),
  };
});

vi.mock("./use-beat-index", () => ({
  useBeatIndex: vi.fn(() => 0),
}));

import { useReducedMotion } from "motion/react";

import { ChapterBeat, ChapterBeats } from "./chapter-beats";
import { ChapterContainer } from "./chapter-container";
import { useBeatIndex } from "./use-beat-index";

const useReducedMotionMock = vi.mocked(useReducedMotion);
const useBeatIndexMock = vi.mocked(useBeatIndex);

describe("ChapterBeats", () => {
  beforeEach(() => {
    useReducedMotionMock.mockReturnValue(false);
    useBeatIndexMock.mockReturnValue(0);
  });

  afterEach(() => {
    useReducedMotionMock.mockReset();
    useBeatIndexMock.mockReset();
  });

  it("publishes data-beats and data-active-beat from the container's beat count", () => {
    const { container } = render(
      <ChapterContainer beats={4}>
        <ChapterBeats>
          <ChapterBeat index={0}>
            <div data-testid="beat-0" />
          </ChapterBeat>
          <ChapterBeat index={1}>
            <div data-testid="beat-1" />
          </ChapterBeat>
        </ChapterBeats>
      </ChapterContainer>
    );
    const beats = container.querySelector("[data-chapter-beats]");
    expect(beats).toBeTruthy();
    expect(beats?.getAttribute("data-beats")).toBe("4");
    expect(beats?.getAttribute("data-active-beat")).toBe("0");
  });

  it("renders each ChapterBeat with its index and an active marker for the current one", () => {
    useBeatIndexMock.mockReturnValue(1);
    const { container } = render(
      <ChapterContainer beats={3}>
        <ChapterBeats>
          <ChapterBeat index={0}>
            <div />
          </ChapterBeat>
          <ChapterBeat index={1}>
            <div />
          </ChapterBeat>
          <ChapterBeat index={2}>
            <div />
          </ChapterBeat>
        </ChapterBeats>
      </ChapterContainer>
    );
    const slots = container.querySelectorAll("[data-beat]");
    expect(slots.length).toBe(3);
    expect(slots[0]?.getAttribute("data-active")).toBe("false");
    expect(slots[1]?.getAttribute("data-active")).toBe("true");
    expect(slots[2]?.getAttribute("data-active")).toBe("false");
  });

  it("hides inactive beats from assistive tech and pointer events", () => {
    useBeatIndexMock.mockReturnValue(0);
    const { container } = render(
      <ChapterContainer beats={2}>
        <ChapterBeats>
          <ChapterBeat index={0}>
            <div />
          </ChapterBeat>
          <ChapterBeat index={1}>
            <div />
          </ChapterBeat>
        </ChapterBeats>
      </ChapterContainer>
    );
    const slots = container.querySelectorAll("[data-beat]");
    expect(slots[0]?.getAttribute("aria-hidden")).toBeNull();
    expect((slots[0] as HTMLElement).style.pointerEvents).toBe("auto");
    expect(slots[1]?.getAttribute("aria-hidden")).toBe("true");
    expect((slots[1] as HTMLElement).style.pointerEvents).toBe("none");
  });

  it("flattens to a vertical stack under reduced motion with no aria-hidden", () => {
    useReducedMotionMock.mockReturnValue(true);
    const { container } = render(
      <ChapterContainer beats={3}>
        <ChapterBeats>
          <ChapterBeat index={0}>
            <div data-testid="b0" />
          </ChapterBeat>
          <ChapterBeat index={1}>
            <div data-testid="b1" />
          </ChapterBeat>
          <ChapterBeat index={2}>
            <div data-testid="b2" />
          </ChapterBeat>
        </ChapterBeats>
      </ChapterContainer>
    );
    const slots = container.querySelectorAll("[data-beat]");
    expect(slots.length).toBe(3);
    for (const slot of slots) {
      expect(slot.getAttribute("aria-hidden")).toBeNull();
      expect(slot.getAttribute("data-active")).toBeNull();
    }
  });

  it("throws when used outside a ChapterContainer (structural misuse is loud)", () => {
    // Suppress the React error-boundary console.error for this assertion.
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      render(
        <ChapterBeats>
          <ChapterBeat index={0}>
            <div />
          </ChapterBeat>
        </ChapterBeats>
      )
    ).toThrow(/useChapterPin must be used inside <ChapterContainer>/);
    consoleError.mockRestore();
  });
});
