import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { render, screen } from "@testing-library/react";
import type { SteamReviewSummary } from "@vyoh/shared";
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { ReviewSummaryChip } from "./review-summary-chip";

function summary(overrides: Partial<SteamReviewSummary> = {}): SteamReviewSummary {
  return {
    reviewCount: 56_501,
    percentPositive: 94,
    reviewScore: 8,
    reviewScoreLabel: "Very Positive",
    ...overrides,
  };
}

function renderWithTooltip(ui: ReactElement) {
  return render(<TooltipPrimitive.Provider>{ui}</TooltipPrimitive.Provider>);
}

describe("ReviewSummaryChip", () => {
  it("renders the label and a locale-formatted count", () => {
    renderWithTooltip(<ReviewSummaryChip summary={summary()} />);
    expect(screen.getByText("Very Positive")).toBeTruthy();
    expect(screen.getByText("56,501")).toBeTruthy();
  });

  it("returns null when no summary is present", () => {
    const { container } = renderWithTooltip(<ReviewSummaryChip summary={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("applies the green/emerald colour family for very-positive labels", () => {
    const { container } = renderWithTooltip(
      <ReviewSummaryChip summary={summary({ reviewScoreLabel: "Very Positive" })} />
    );
    const chip = container.firstChild as HTMLElement;
    expect(chip.className).toMatch(/green/);
  });

  it("falls back to a neutral colour for an unrecognised label", () => {
    const { container } = renderWithTooltip(
      <ReviewSummaryChip summary={summary({ reviewScoreLabel: "Glorious" })} />
    );
    const chip = container.firstChild as HTMLElement;
    expect(chip.className).toMatch(/zinc/);
  });
});
