import { render } from "@testing-library/react";
import { MotionConfig } from "motion/react";
import { describe, expect, it } from "vitest";
import { WishlistSkeleton } from "./wishlist-skeleton";

describe("WishlistSkeleton", () => {
  it("renders six skeleton rows", () => {
    const { container } = render(
      <MotionConfig reducedMotion="always">
        <WishlistSkeleton />
      </MotionConfig>
    );
    expect(container.querySelectorAll("li").length).toBe(6);
  });
});
