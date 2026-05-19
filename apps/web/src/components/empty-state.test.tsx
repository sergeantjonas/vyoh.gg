import { render, screen } from "@testing-library/react";
import { MotionConfig } from "motion/react";
import { describe, expect, it } from "vitest";
import {
  EmptyChampionIllustration,
  EmptyLpHistoryIllustration,
  EmptyMatchesIllustration,
  EmptyState,
} from "./empty-state";

describe("EmptyState", () => {
  it("renders title, hint, illustration, and action", () => {
    render(
      <MotionConfig reducedMotion="always">
        <EmptyState
          illustration={<span data-testid="ill">x</span>}
          title="Nothing here"
          hint="Try again"
          action={<button type="button">Retry</button>}
        />
      </MotionConfig>
    );
    expect(screen.getByText("Nothing here")).toBeTruthy();
    expect(screen.getByText("Try again")).toBeTruthy();
    expect(screen.getByTestId("ill")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  });

  it("omits hint and action when not provided", () => {
    render(
      <MotionConfig reducedMotion="always">
        <EmptyState illustration={<span>x</span>} title="Empty" />
      </MotionConfig>
    );
    expect(screen.getByText("Empty")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it.each([
    ["EmptyMatchesIllustration", EmptyMatchesIllustration],
    ["EmptyLpHistoryIllustration", EmptyLpHistoryIllustration],
    ["EmptyChampionIllustration", EmptyChampionIllustration],
  ])("%s renders an aria-hidden svg", (_name, Component) => {
    const { container } = render(<Component className="text-foo" />);
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(svg?.getAttribute("class")).toContain("text-foo");
  });
});
