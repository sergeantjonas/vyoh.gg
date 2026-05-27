import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CommandPalettePreview } from "./command-palette-preview";

describe("CommandPalettePreview", () => {
  it("renders nothing when value is empty", () => {
    const { container } = render(<CommandPalettePreview value="" />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the value twice (smoke-test wiring before Chunk 3 content)", () => {
    render(<CommandPalettePreview value="account:zoe-eune" />);
    const preview = screen.getByTestId("command-palette-preview");
    const matches = preview.textContent?.match(/account:zoe-eune/g) ?? [];
    expect(matches).toHaveLength(2);
  });

  it("applies the .palette-preview class for anchor-positioning wiring", () => {
    // The `.palette-preview` rule in `apps/web/src/index.css` carries the
    // actual `position-anchor: --palette-focused-row` declaration. happy-dom
    // drops anchor-positioning properties from inline `style`, so the class
    // is the testable contract.
    render(<CommandPalettePreview value="x" />);
    const preview = screen.getByTestId("command-palette-preview");
    expect(preview.className).toContain("palette-preview");
  });
});
