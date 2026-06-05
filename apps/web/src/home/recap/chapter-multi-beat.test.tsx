import { render } from "@testing-library/react";
import { configureAxe } from "jest-axe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("motion/react", async () => {
  const actual = await vi.importActual<typeof import("motion/react")>("motion/react");
  return {
    ...actual,
    useReducedMotion: vi.fn(() => false),
    useInView: vi.fn(() => true),
    useScroll: vi.fn(() => ({ scrollYProgress: { get: () => 0, on: () => () => {} } })),
    useTransform: vi.fn(() => "0vw"),
  };
});

vi.mock("./use-chapter-nudge", () => ({
  useChapterNudge: vi.fn(() => true),
}));

import { useReducedMotion } from "motion/react";

import { ChapterMultiBeat } from "./chapter-multi-beat";
import { MultiBeat } from "./multi-beat";

const mockedUseReducedMotion = vi.mocked(useReducedMotion);

const axe = configureAxe({
  rules: {
    "color-contrast": { enabled: false },
    "aria-hidden-focus": { enabled: false },
  },
});

describe("ChapterMultiBeat", () => {
  beforeEach(() => {
    mockedUseReducedMotion.mockReturnValue(false);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders the chapter as a carousel region", () => {
    const { container } = render(
      <ChapterMultiBeat slug="steam-3" ariaLabel="Steam recap">
        <MultiBeat index={0} beatCount={1}>
          <p>beat</p>
        </MultiBeat>
      </ChapterMultiBeat>
    );
    const section = container.querySelector("section");
    expect(section?.getAttribute("aria-roledescription")).toBe("carousel");
    expect(section?.getAttribute("aria-label")).toBe("Steam recap");
    expect(section?.getAttribute("data-chapter")).toBe("steam-3");
    expect(section?.getAttribute("data-chapter-beat-count")).toBe("1");
  });

  // Section height is `beatCount * 100dvh` to provide the scroll runway
  // that drives the horizontal track. happy-dom drops `dvh` values from
  // inline style serialization so it can't be asserted here; verified
  // via the live diagnose-multi-beat-flag.mjs probe instead, and the
  // beat-count attribute on the section makes the multiplier observable.

  // No `--masthead-h` published anymore — masthead sizes to its content
  // via flex layout, track takes whatever's left via `flex-1 min-h-0`.
  // The prior fixed-height approach reserved extra space when the title
  // card was shorter than the reserved height, producing a visible gap
  // between masthead and beat content.

  it("renders the identity slot as a header inside a sticky stage", () => {
    const { container } = render(
      <ChapterMultiBeat identity={<span>title</span>}>
        <MultiBeat index={0} beatCount={1}>
          <p>beat</p>
        </MultiBeat>
      </ChapterMultiBeat>
    );
    const stage = container.querySelector("[data-chapter-stage]");
    expect(stage?.className).toContain("sticky");
    expect(stage?.className).toContain("top-0");
    const header = container.querySelector("header[data-chapter-masthead]");
    expect(header).not.toBeNull();
    expect(header?.textContent).toContain("title");
  });

  it("renders a horizontal track below the masthead under standard motion", () => {
    const { container } = render(
      <ChapterMultiBeat identity={<span>title</span>}>
        <MultiBeat index={0} beatCount={2}>
          <p>a</p>
        </MultiBeat>
        <MultiBeat index={1} beatCount={2}>
          <p>b</p>
        </MultiBeat>
      </ChapterMultiBeat>
    );
    const track = container.querySelector("[data-chapter-track]");
    expect(track).not.toBeNull();
    expect(track?.className).toContain("flex");
    expect(track?.className).toContain("flex-row");
  });

  it("renders identity in flow (not sticky) under reduced motion", () => {
    mockedUseReducedMotion.mockReturnValue(true);
    const { container } = render(
      <ChapterMultiBeat identity={<span>title</span>}>
        <MultiBeat index={0} beatCount={1}>
          <p>beat</p>
        </MultiBeat>
      </ChapterMultiBeat>
    );
    const section = container.querySelector("section");
    expect(section?.getAttribute("data-reduced-motion")).toBe("");
    expect(container.querySelector("[data-chapter-stage]")).toBeNull();
    expect(container.querySelector("div[data-chapter-masthead]")?.textContent).toBe(
      "title"
    );
  });

  it("counts only valid element children for beat-count", () => {
    const { container } = render(
      <ChapterMultiBeat>
        <MultiBeat index={0} beatCount={3}>
          <p>a</p>
        </MultiBeat>
        {null}
        <MultiBeat index={1} beatCount={3}>
          <p>b</p>
        </MultiBeat>
        {false}
        <MultiBeat index={2} beatCount={3}>
          <p>c</p>
        </MultiBeat>
      </ChapterMultiBeat>
    );
    expect(container.querySelector("section")?.getAttribute("data-chapter-beat-count")).toBe(
      "3"
    );
  });

  it("passes axe with carousel + slide structure", async () => {
    const { container } = render(
      <ChapterMultiBeat slug="steam-3" ariaLabel="Steam recap" identity={<h2>Steam</h2>}>
        <MultiBeat index={0} beatCount={2}>
          <p>beat one</p>
        </MultiBeat>
        <MultiBeat index={1} beatCount={2}>
          <p>beat two</p>
        </MultiBeat>
      </ChapterMultiBeat>
    );
    const results = await axe(container);
    expect(results.violations).toHaveLength(0);
  });
});
