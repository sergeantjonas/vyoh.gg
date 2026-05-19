import { render } from "@testing-library/react";
import { MotionConfig } from "motion/react";
import { describe, expect, it } from "vitest";
import { MatchDetailSkeleton } from "./match-detail-skeleton";

function renderSkeleton(tab?: "recap" | "your-game" | "timeline") {
  return render(
    <MotionConfig reducedMotion="always">
      <MatchDetailSkeleton {...(tab !== undefined && { tab })} />
    </MotionConfig>
  );
}

describe("MatchDetailSkeleton", () => {
  it("renders the recap layout with participant rows by default", () => {
    const { container } = renderSkeleton();
    // Recap renders 2 columns of 5 participant rows = 10 li elements.
    expect(container.querySelectorAll("li").length).toBe(10);
  });

  it("renders the recap layout when tab='recap'", () => {
    const { container } = renderSkeleton("recap");
    expect(container.querySelectorAll("li").length).toBe(10);
    expect(container.querySelector("aside")).toBeNull();
  });

  it("renders the your-game layout with a sidebar aside", () => {
    const { container } = renderSkeleton("your-game");
    expect(container.querySelector("aside")).not.toBeNull();
    expect(container.querySelectorAll("li").length).toBe(0);
  });

  it("renders the timeline layout with two sections and no participant rows", () => {
    const { container } = renderSkeleton("timeline");
    expect(container.querySelectorAll("section").length).toBe(2);
    expect(container.querySelectorAll("li").length).toBe(0);
    expect(container.querySelector("aside")).toBeNull();
  });
});
