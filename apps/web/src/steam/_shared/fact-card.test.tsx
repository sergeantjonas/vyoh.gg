import { render, screen } from "@testing-library/react";
import { MotionConfig } from "motion/react";
import { describe, expect, it } from "vitest";
import { FactCard } from "./fact-card";

function renderWithMotion(ui: React.ReactElement) {
  return render(<MotionConfig reducedMotion="always">{ui}</MotionConfig>);
}

describe("FactCard", () => {
  it("renders the title and verdict from the underlying CardShell", () => {
    renderWithMotion(<FactCard title="Library" verdict="200 owned games" />);
    expect(screen.getByText("Library")).toBeTruthy();
    expect(screen.getByText("200 owned games")).toBeTruthy();
  });

  it("renders the singular metric label when metric is exactly 1", () => {
    renderWithMotion(
      <FactCard
        title="Wishlist"
        verdict="One title parked."
        metric={1}
        metricLabel={{ singular: "title", plural: "titles" }}
      />
    );
    expect(screen.getByText(/1 title/)).toBeTruthy();
  });

  it("renders the plural metric label when metric is not 1", () => {
    renderWithMotion(
      <FactCard
        title="Wishlist"
        verdict="21 parked."
        metric={21}
        metricLabel={{ singular: "title", plural: "titles" }}
      />
    );
    expect(screen.getByText(/21 titles/)).toBeTruthy();
  });

  it("omits the indicator block when metric or metricLabel is undefined", () => {
    const { container } = renderWithMotion(
      <FactCard title="Catalog" verdict="No facts available." />
    );
    expect(container.querySelector("[aria-hidden='true']")).toBeNull();
  });
});
