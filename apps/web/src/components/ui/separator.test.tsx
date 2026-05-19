import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Separator } from "./separator";

describe("Separator", () => {
  it("renders a horizontal decorative separator by default", () => {
    const { container } = render(<Separator />);
    const sep = container.querySelector("[data-slot='separator']");
    expect(sep).toBeTruthy();
    expect(sep?.getAttribute("data-orientation")).toBe("horizontal");
  });

  it("renders a vertical separator when orientation=vertical", () => {
    const { container } = render(<Separator orientation="vertical" />);
    expect(
      container.querySelector("[data-slot='separator']")?.getAttribute("data-orientation")
    ).toBe("vertical");
  });

  it("respects decorative=false (assigns role=separator)", () => {
    const { container } = render(<Separator decorative={false} />);
    expect(container.querySelector("[role='separator']")).toBeTruthy();
  });

  it("merges className", () => {
    const { container } = render(<Separator className="x-sep" />);
    expect(container.querySelector("[data-slot='separator']")?.className).toContain(
      "x-sep"
    );
  });
});
