import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { GradientLayer } from "./ambient-hero";
import AmbientHeroCanvas from "./ambient-hero-canvas";

const TEST_LAYERS: readonly GradientLayer[] = [
  { cx: 0.3, cy: 0.3, radius: 800, lch: [0.5, 0.18, 230], alpha: 0.3, phase: 0 },
  { cx: 0.7, cy: 0.3, radius: 900, lch: [0.6, 0.16, 65], alpha: 0.28, phase: 1.1 },
];

describe("AmbientHeroCanvas", () => {
  it("mounts a data-ambient-canvas element", () => {
    const { container } = render(<AmbientHeroCanvas layers={TEST_LAYERS} />);
    expect(container.querySelector("[data-ambient-canvas]")).not.toBeNull();
  });

  it("renders the canvas with the vignette mask", () => {
    const { container } = render(<AmbientHeroCanvas layers={TEST_LAYERS} />);
    const canvas = container.querySelector(
      "[data-ambient-canvas]"
    ) as HTMLCanvasElement | null;
    expect(canvas?.style.maskImage).toContain("radial-gradient");
  });

  it("cleans up without errors on unmount", () => {
    const { unmount } = render(<AmbientHeroCanvas layers={TEST_LAYERS} />);
    expect(() => unmount()).not.toThrow();
  });
});
