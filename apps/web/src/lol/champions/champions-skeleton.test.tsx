import { render } from "@testing-library/react";
import { MotionConfig } from "motion/react";
import { describe, expect, it } from "vitest";
import { ChampionsSkeleton } from "./champions-skeleton";

describe("ChampionsSkeleton", () => {
  it("renders six skeleton rows", () => {
    const { container } = render(
      <MotionConfig reducedMotion="always">
        <ChampionsSkeleton />
      </MotionConfig>
    );
    expect(container.querySelectorAll("li").length).toBe(6);
  });
});
