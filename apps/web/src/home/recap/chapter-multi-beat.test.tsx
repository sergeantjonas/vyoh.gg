import { render } from "@testing-library/react";
import { configureAxe } from "jest-axe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("motion/react", async () => {
  const actual = await vi.importActual<typeof import("motion/react")>("motion/react");
  return {
    ...actual,
    useReducedMotion: vi.fn(() => false),
    useInView: vi.fn(() => true),
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
    // happy-dom doesn't compute real styles for contrast checks.
    "color-contrast": { enabled: false },
    // Radix-style focus management fires false positives in happy-dom.
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

  it("renders the chapter as a region with carousel ARIA", () => {
    const { container } = render(
      <ChapterMultiBeat slug="steam-3" ariaLabel="Steam recap">
        <MultiBeat index={0} beatCount={1}>
          <p>beat</p>
        </MultiBeat>
      </ChapterMultiBeat>
    );
    const section = container.querySelector("section");
    // <section> with aria-label has implicit role="region"; no explicit attribute.
    expect(section?.getAttribute("aria-roledescription")).toBe("carousel");
    expect(section?.getAttribute("aria-label")).toBe("Steam recap");
    expect(section?.getAttribute("data-chapter")).toBe("steam-3");
    expect(section?.getAttribute("data-chapter-beat-count")).toBe("1");
  });

  it("publishes --masthead-h as inline style with default 20vh", () => {
    const { container } = render(
      <ChapterMultiBeat>
        <MultiBeat index={0} beatCount={1}>
          <p>beat</p>
        </MultiBeat>
      </ChapterMultiBeat>
    );
    const section = container.querySelector("section");
    // happy-dom serializes custom properties on style.cssText.
    expect(section?.getAttribute("style") ?? "").toContain("--masthead-h: 20vh");
  });

  it("publishes a custom masthead height when provided", () => {
    const { container } = render(
      <ChapterMultiBeat mastheadHeight="24vh">
        <MultiBeat index={0} beatCount={1}>
          <p>beat</p>
        </MultiBeat>
      </ChapterMultiBeat>
    );
    const section = container.querySelector("section");
    expect(section?.getAttribute("style") ?? "").toContain("--masthead-h: 24vh");
  });

  it("renders the identity slot as a sticky header under standard motion", () => {
    const { container } = render(
      <ChapterMultiBeat identity={<span>title</span>}>
        <MultiBeat index={0} beatCount={1}>
          <p>beat</p>
        </MultiBeat>
      </ChapterMultiBeat>
    );
    const header = container.querySelector("header[data-chapter-masthead]");
    expect(header).not.toBeNull();
    expect(header?.className).toContain("sticky");
    expect(header?.className).toContain("top-0");
    // Identity content is rendered as a direct child of the header.
    expect(header?.textContent).toContain("title");
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
    // No <header> with sticky in reduced motion — masthead becomes a
    // plain div in normal flow so the page is a flat stack.
    expect(container.querySelector("header[data-chapter-masthead]")).toBeNull();
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
    expect(
      container.querySelector("section")?.getAttribute("data-chapter-beat-count")
    ).toBe("3");
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
