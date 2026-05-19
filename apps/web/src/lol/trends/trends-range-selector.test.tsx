import { fireEvent, render, screen } from "@testing-library/react";
import { MotionConfig } from "motion/react";
import { describe, expect, it, vi } from "vitest";
import { type TrendsRangeId, TrendsRangeSelector } from "./trends-range-selector";

function renderSelector(
  value: TrendsRangeId,
  onChange: (id: TrendsRangeId) => void = () => {}
) {
  return render(
    <MotionConfig reducedMotion="always">
      <TrendsRangeSelector value={value} onChange={onChange} />
    </MotionConfig>
  );
}

describe("TrendsRangeSelector", () => {
  it("renders all four ranges as buttons", () => {
    renderSelector("30d");
    expect(screen.getByText("7 days")).toBeTruthy();
    expect(screen.getByText("30 days")).toBeTruthy();
    expect(screen.getByText("100 games")).toBeTruthy();
    expect(screen.getByText("Patch")).toBeTruthy();
  });

  it("fires onChange with the picked range id", () => {
    const onChange = vi.fn();
    renderSelector("30d", onChange);
    fireEvent.click(screen.getByText("7 days"));
    expect(onChange).toHaveBeenCalledWith("7d");
    fireEvent.click(screen.getByText("100 games"));
    expect(onChange).toHaveBeenCalledWith("100g");
    fireEvent.click(screen.getByText("Patch"));
    expect(onChange).toHaveBeenCalledWith("patch");
  });

  it("emits the active layoutId indicator on the selected button only", () => {
    const { container } = renderSelector("100g");
    const indicators = container.querySelectorAll('[class*="from-foreground/10"]');
    expect(indicators.length).toBe(1);
  });

  it("does not fire onChange when nothing is clicked", () => {
    const onChange = vi.fn();
    renderSelector("30d", onChange);
    expect(onChange).not.toHaveBeenCalled();
  });
});
