import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Loader } from "./loader";

describe("Loader", () => {
  it("renders an output with the default aria-label", () => {
    render(<Loader />);
    expect(screen.getByLabelText("Loading")).toBeTruthy();
  });

  it("respects a custom aria-label", () => {
    render(<Loader label="Fetching matches" />);
    expect(screen.getByLabelText("Fetching matches")).toBeTruthy();
  });

  it("renders the svg with the supplied size", () => {
    const { container } = render(<Loader size={32} />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("width")).toBe("32");
    expect(svg?.getAttribute("height")).toBe("32");
  });

  it("merges the provided className onto the svg", () => {
    const { container } = render(<Loader className="text-rose-500" />);
    expect(container.querySelector("svg")?.getAttribute("class")).toContain(
      "text-rose-500"
    );
  });
});
