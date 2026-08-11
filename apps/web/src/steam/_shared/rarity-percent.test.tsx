import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import {
  RarityPercent,
  formatRarityPercent,
  formatRarityPercentEditorial,
} from "./rarity-percent";

function renderWithProvider(ui: ReactNode) {
  return render(<TooltipPrimitive.Provider>{ui}</TooltipPrimitive.Provider>);
}

describe("RarityPercent", () => {
  it("formats the percent with one decimal", () => {
    renderWithProvider(<RarityPercent percent={0.532} />);
    expect(screen.getByText("0.5%")).toBeTruthy();
  });

  it("rounds to one decimal", () => {
    renderWithProvider(<RarityPercent percent={4.06} />);
    expect(screen.getByText("4.1%")).toBeTruthy();
  });

  it("renders the optional prefix inline before the percent", () => {
    const { container } = renderWithProvider(
      <RarityPercent percent={1.2} prefix="Very rare · " />
    );
    expect(container.textContent).toContain("Very rare · 1.2%");
  });

  // Steam reports 0 for any share below its one-decimal resolution, which a
  // freshly launched game does in bulk. "0.0%" beside an unlock the owner
  // holds is a claim that nobody holds it.
  it("renders a sub-resolution rarity as an upper bound rather than 0.0%", () => {
    const { container } = renderWithProvider(<RarityPercent percent={0} />);
    expect(screen.getByText("<0.1%")).toBeTruthy();
    expect(container.textContent).not.toContain("0.0%");
  });

  it("emits the underline + cursor-help classes on the trigger so the tooltip affordance is visible", () => {
    const { container } = renderWithProvider(<RarityPercent percent={5} />);
    const trigger = container.querySelector("span");
    expect(trigger?.className).toContain("cursor-help");
    expect(trigger?.className).toContain("underline");
  });
});

describe("formatRarityPercent", () => {
  it("keeps one decimal for anything Steam can express", () => {
    expect(formatRarityPercent(0.1)).toBe("0.1%");
    expect(formatRarityPercent(47.9)).toBe("47.9%");
  });

  it("labels every value that would round to 0.0 as an upper bound", () => {
    expect(formatRarityPercent(0)).toBe("<0.1%");
    expect(formatRarityPercent(0.04)).toBe("<0.1%");
  });
});

describe("formatRarityPercentEditorial", () => {
  it("keeps the decimal below 10% and drops it above", () => {
    expect(formatRarityPercentEditorial(1.84)).toBe("1.8%");
    expect(formatRarityPercentEditorial(12.4)).toBe("12%");
  });

  it("labels sub-resolution rarities as an upper bound", () => {
    expect(formatRarityPercentEditorial(0)).toBe("<0.1%");
  });
});
