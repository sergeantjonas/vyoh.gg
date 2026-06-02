import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ConclusionFooterChips } from "./footer-chips";

describe("ConclusionFooterChips", () => {
  it("renders deploy, commit, and live-for labels", () => {
    render(<ConclusionFooterChips />);
    expect(screen.getByText("Deployed")).toBeTruthy();
    expect(screen.getByText("Commit")).toBeTruthy();
    expect(screen.getByText("Live for")).toBeTruthy();
  });

  it("renders the injected build commit string from the Vite define", () => {
    render(<ConclusionFooterChips />);
    expect(screen.getByText(__BUILD_COMMIT__)).toBeTruthy();
  });
});
