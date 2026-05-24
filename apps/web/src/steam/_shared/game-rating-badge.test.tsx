import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { render, screen } from "@testing-library/react";
import type { SteamGameRating } from "@vyoh/shared";
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { GameRatingBadge } from "./game-rating-badge";

function rating(overrides: Partial<SteamGameRating> = {}): SteamGameRating {
  return {
    type: "ESRB",
    rating: "M",
    descriptors: ["Violence", "Blood and Gore", "Suggestive Themes", "Language"],
    requiredAge: 17,
    useAgeGate: true,
    imageUrl: null,
    ...overrides,
  };
}

function renderWithTooltip(ui: ReactElement) {
  return render(<TooltipPrimitive.Provider>{ui}</TooltipPrimitive.Provider>);
}

describe("GameRatingBadge", () => {
  it("renders the body type and rating label", () => {
    renderWithTooltip(<GameRatingBadge rating={rating()} />);
    expect(screen.getByText("ESRB")).toBeTruthy();
    expect(screen.getByText("M")).toBeTruthy();
  });

  it("renders a '+N' descriptor pill when descriptors are present", () => {
    renderWithTooltip(<GameRatingBadge rating={rating()} />);
    expect(screen.getByText("+4")).toBeTruthy();
  });

  it("omits the descriptor pill when descriptors is empty", () => {
    const { container } = renderWithTooltip(
      <GameRatingBadge rating={rating({ descriptors: [] })} />
    );
    expect(container.textContent).not.toContain("+");
  });

  it("returns null when rating is null (AO-rated, ESRB-skipped, missing data)", () => {
    const { container } = renderWithTooltip(<GameRatingBadge rating={null} />);
    expect(container.firstChild).toBeNull();
  });
});
