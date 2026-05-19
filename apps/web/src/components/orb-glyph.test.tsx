import { render } from "@testing-library/react";
import { MotionConfig } from "motion/react";
import { describe, expect, it } from "vitest";
import { OrbGlyph } from "./orb-glyph";

describe("OrbGlyph", () => {
  it("renders the orb image marked aria-hidden", () => {
    const { container } = render(
      <MotionConfig reducedMotion="never">
        <OrbGlyph />
      </MotionConfig>
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelector("img")?.getAttribute("src")).toContain(
      "vyoh-orb-mark"
    );
  });

  it("applies the className to the outer wrapper", () => {
    const { container } = render(
      <MotionConfig reducedMotion="never">
        <OrbGlyph className="size-10" />
      </MotionConfig>
    );
    expect((container.firstElementChild as HTMLElement).className).toContain("size-10");
  });
});
