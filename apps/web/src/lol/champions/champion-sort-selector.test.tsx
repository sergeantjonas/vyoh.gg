import { fireEvent, render, screen } from "@testing-library/react";
import { MotionConfig } from "motion/react";
import { describe, expect, it, vi } from "vitest";
import { CHAMPION_SORT_OPTIONS, ChampionSortSelector } from "./champion-sort-selector";

function renderSelector(
  value: (typeof CHAMPION_SORT_OPTIONS)[number]["value"],
  onChange = vi.fn()
) {
  return {
    onChange,
    ...render(
      <MotionConfig reducedMotion="always">
        <ChampionSortSelector value={value} onChange={onChange} layoutId="t-sort" />
      </MotionConfig>
    ),
  };
}

describe("ChampionSortSelector", () => {
  it("renders one button per sort option", () => {
    renderSelector("games");
    expect(screen.getAllByRole("button")).toHaveLength(CHAMPION_SORT_OPTIONS.length);
    expect(screen.getByText("Games")).toBeTruthy();
    expect(screen.getByText("Win rate")).toBeTruthy();
    expect(screen.getByText("KDA")).toBeTruthy();
    expect(screen.getByText("Playtime")).toBeTruthy();
  });

  it("invokes onChange with the option's value when a button is clicked", () => {
    const { onChange } = renderSelector("games");
    fireEvent.click(screen.getByText("Win rate"));
    expect(onChange).toHaveBeenCalledWith("winRate");
  });

  it("highlights the active option's button", () => {
    renderSelector("avgKda");
    const active = screen.getByText("KDA").closest("button");
    expect(active?.className).toContain("text-foreground");
    expect(active?.className).not.toContain("text-muted-foreground");
  });
});
