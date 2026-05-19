import { render, screen } from "@testing-library/react";
import { MotionConfig } from "motion/react";
import { describe, expect, it } from "vitest";
import { TrendStreak } from "./trend-streak";

function renderStreak(streak: Parameters<typeof TrendStreak>[0]["streak"]) {
  return render(
    <MotionConfig reducedMotion="always">
      <TrendStreak streak={streak} />
    </MotionConfig>
  );
}

describe("TrendStreak", () => {
  it("renders nothing when streak is null", () => {
    const { container } = renderStreak(null);
    expect(container.firstChild).toBeNull();
  });

  it("renders a win streak with the fire emoji and W suffix", () => {
    renderStreak({ type: "win", count: 4 });
    expect(screen.getByText("🔥")).toBeTruthy();
    expect(screen.getByText(/4\s*W streak/)).toBeTruthy();
  });

  it("renders a loss streak with the snowflake emoji and L suffix", () => {
    renderStreak({ type: "loss", count: 3 });
    expect(screen.getByText("❄️")).toBeTruthy();
    expect(screen.getByText(/3\s*L streak/)).toBeTruthy();
  });

  it("applies emerald styling for wins and rose styling for losses", () => {
    const { container, rerender } = renderStreak({ type: "win", count: 1 });
    const winChip = container.querySelector("div");
    expect(winChip?.className).toContain("emerald");

    rerender(
      <MotionConfig reducedMotion="always">
        <TrendStreak streak={{ type: "loss", count: 1 }} />
      </MotionConfig>
    );
    const lossChip = container.querySelector("div");
    expect(lossChip?.className).toContain("red");
  });
});
