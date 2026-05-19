import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Input } from "./input";

describe("Input", () => {
  it("renders an input element with data-slot=input", () => {
    render(<Input placeholder="search" />);
    const el = screen.getByPlaceholderText("search");
    expect(el.tagName).toBe("INPUT");
    expect(el.getAttribute("data-slot")).toBe("input");
  });

  it("honours the type prop", () => {
    render(<Input type="email" aria-label="email" />);
    expect(screen.getByLabelText("email").getAttribute("type")).toBe("email");
  });

  it("forwards onChange", () => {
    const onChange = vi.fn();
    render(<Input aria-label="x" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("x"), { target: { value: "hi" } });
    expect(onChange).toHaveBeenCalled();
  });

  it("merges the className", () => {
    render(<Input aria-label="x" className="my-input" />);
    expect(screen.getByLabelText("x").className).toContain("my-input");
  });
});
