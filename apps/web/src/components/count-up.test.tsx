import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CountUp } from "./count-up";

describe("CountUp", () => {
  it("renders the final value immediately in test mode (animation bypassed)", () => {
    render(<CountUp to={42} />);
    expect(screen.getByText("42")).toBeTruthy();
  });

  it("formats the value to the requested decimal precision", () => {
    render(<CountUp to={Math.PI} decimals={2} />);
    expect(screen.getByText("3.14")).toBeTruthy();
  });

  it("applies the className to the wrapping span", () => {
    const { container } = render(<CountUp to={5} className="font-mono" />);
    expect(container.querySelector("span")?.className).toContain("font-mono");
  });
});
