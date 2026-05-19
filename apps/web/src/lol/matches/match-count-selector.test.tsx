import { fireEvent, render, screen } from "@testing-library/react";
import { MotionConfig } from "motion/react";
import { describe, expect, it, vi } from "vitest";
import {
  MAX_COUNT,
  MatchCountSelector,
  deriveCountOptions,
} from "./match-count-selector";

function renderSelector(props: {
  value: number;
  total: number;
  onChange?: (v: number) => void;
}) {
  return render(
    <MotionConfig reducedMotion="always">
      <MatchCountSelector
        value={props.value}
        total={props.total}
        onChange={props.onChange ?? (() => {})}
        layoutId="test-indicator"
      />
    </MotionConfig>
  );
}

describe("deriveCountOptions", () => {
  it("returns an empty list when total is non-positive", () => {
    expect(deriveCountOptions(0)).toEqual([]);
    expect(deriveCountOptions(-5)).toEqual([]);
  });

  it("returns only the total when fewer than the smallest preset", () => {
    expect(deriveCountOptions(10)).toEqual([10]);
  });

  it("appends the exact total when it sits between presets", () => {
    expect(deriveCountOptions(30)).toEqual([20, 30]);
  });

  it("returns just the presets when total matches a preset exactly", () => {
    expect(deriveCountOptions(50)).toEqual([20, 50]);
    expect(deriveCountOptions(MAX_COUNT)).toEqual([20, 50, MAX_COUNT]);
  });

  it("caps at MAX_COUNT for accounts above the cap", () => {
    expect(deriveCountOptions(MAX_COUNT + 75)).toEqual([20, 50, MAX_COUNT]);
  });
});

describe("MatchCountSelector", () => {
  it("renders nothing when there are no options", () => {
    const { container } = renderSelector({ value: 20, total: 0 });
    expect(container.firstChild).toBeNull();
  });

  it("renders the 'All N' label when total sits between presets", () => {
    renderSelector({ value: 30, total: 30 });
    expect(screen.getByText("20")).toBeTruthy();
    expect(screen.getByText("All 30")).toBeTruthy();
  });

  it("fires onChange with the picked count", () => {
    const onChange = vi.fn();
    renderSelector({ value: 20, total: MAX_COUNT, onChange });
    fireEvent.click(screen.getByText(String(MAX_COUNT)));
    expect(onChange).toHaveBeenCalledWith(MAX_COUNT);
  });

  it("renders the active indicator on the selected option only", () => {
    const { container } = renderSelector({ value: 50, total: MAX_COUNT });
    const indicators = container.querySelectorAll('[class*="from-foreground/10"]');
    expect(indicators.length).toBe(1);
  });
});
