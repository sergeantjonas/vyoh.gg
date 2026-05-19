import { render } from "@testing-library/react";
import { MotionConfig } from "motion/react";
import { describe, expect, it } from "vitest";
import { TrendsSkeleton } from "./trends-skeleton";

describe("TrendsSkeleton", () => {
  it("renders the placeholder grid and section blocks without throwing", () => {
    const { container } = render(
      <MotionConfig reducedMotion="always">
        <TrendsSkeleton />
      </MotionConfig>
    );
    // Sanity check that the skeleton actually rendered shimmer placeholders.
    expect(
      container.querySelector(".animate-pulse, .relative.overflow-hidden")
    ).not.toBeNull();
    // Each shimmer block carries a rounded class — should be enough of them.
    expect(container.querySelectorAll("div").length).toBeGreaterThan(20);
  });
});
