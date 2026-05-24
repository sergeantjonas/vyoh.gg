import { render } from "@testing-library/react";
import { MotionConfig } from "motion/react";
import { describe, expect, it } from "vitest";
import { GameDetailSkeleton } from "./game-detail-skeleton";

describe("GameDetailSkeleton", () => {
  it("renders sections mirroring the loaded layout", () => {
    const { container } = render(
      <MotionConfig reducedMotion="always">
        <GameDetailSkeleton />
      </MotionConfig>
    );
    // Title strip + playtime card + screenshot strip + stat-cards grid + achievement panel = 5 top-level sections
    expect(container.firstElementChild?.children.length).toBe(5);
    // Shimmer blocks are rendered as relative overflow-hidden divs from ShimmerBlock
    expect(
      container.querySelectorAll("div[class*='animate-shimmer']").length
    ).toBeGreaterThan(0);
  });
});
