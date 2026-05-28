import { render } from "@testing-library/react";
import { MotionConfig } from "motion/react";
import { describe, expect, it } from "vitest";
import { OrbGlyph } from "./orb-glyph";

describe("OrbGlyph", () => {
  it("renders the orb silhouette marked aria-hidden", () => {
    const { container } = render(
      <MotionConfig reducedMotion="never">
        <OrbGlyph />
      </MotionConfig>
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.getAttribute("aria-hidden")).toBe("true");
    // The silhouette is a CSS-mask span (not <img>) so it can be recolored
    // via --theme-color. happy-dom strips the inline mask-image style, so we
    // assert the structural shape: two inner spans — the animated halo and
    // the themed silhouette carrying the theme-color background class.
    const innerSpans = wrapper.querySelectorAll(":scope > span");
    expect(innerSpans).toHaveLength(2);
    expect(innerSpans[1]?.className).toContain("bg-[var(--theme-color)]");
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
