import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EditorialCloser } from "./editorial-closer";

describe("EditorialCloser", () => {
  it("renders the framing line and signature", () => {
    render(<EditorialCloser />);
    expect(screen.getByText(/That's the picture\. Built with React 19/)).toBeTruthy();
    expect(screen.getByText("— Vyoh")).toBeTruthy();
  });
});
