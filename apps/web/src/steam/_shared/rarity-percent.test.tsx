import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { RarityPercent } from "./rarity-percent";

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

  it("emits the underline + cursor-help classes on the trigger so the tooltip affordance is visible", () => {
    const { container } = renderWithProvider(<RarityPercent percent={5} />);
    const trigger = container.querySelector("span");
    expect(trigger?.className).toContain("cursor-help");
    expect(trigger?.className).toContain("underline");
  });
});
