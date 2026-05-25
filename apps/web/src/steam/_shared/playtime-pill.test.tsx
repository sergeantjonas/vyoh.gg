import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PlaytimePill } from "./playtime-pill";

describe("PlaytimePill", () => {
  it("renders label + value side by side", () => {
    render(<PlaytimePill label="Total" value="13h" tone="active" />);
    expect(screen.getByText("Total")).toBeTruthy();
    expect(screen.getByText("13h")).toBeTruthy();
  });

  it("uses the active tone classes for real values", () => {
    const { container } = render(
      <PlaytimePill label="Total" value="13h" tone="active" />
    );
    expect(container.firstElementChild?.className).toMatch(/bg-foreground\/5/);
  });

  it("uses the muted tone classes for placeholder values", () => {
    const { container } = render(<PlaytimePill label="Recent" value="—" tone="muted" />);
    expect(container.firstElementChild?.className).toMatch(/text-muted-foreground\/70/);
  });
});
