import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Checkbox } from "./checkbox";

describe("Checkbox", () => {
  it("renders an unchecked checkbox by default", () => {
    render(<Checkbox aria-label="Pick me" />);
    const cb = screen.getByRole("checkbox", { name: "Pick me" });
    expect(cb.getAttribute("data-state")).toBe("unchecked");
  });

  it("calls onCheckedChange when toggled", () => {
    const onCheckedChange = vi.fn();
    render(<Checkbox aria-label="t" onCheckedChange={onCheckedChange} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "t" }));
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it("renders the checked state when checked is true", () => {
    render(<Checkbox aria-label="t" checked />);
    expect(screen.getByRole("checkbox").getAttribute("data-state")).toBe("checked");
  });

  it("applies the className", () => {
    render(<Checkbox aria-label="t" className="my-cb" />);
    expect(screen.getByRole("checkbox").className).toContain("my-cb");
  });
});
