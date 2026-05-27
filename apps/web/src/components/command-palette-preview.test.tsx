import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CommandPalettePreview } from "./command-palette-preview";

vi.mock("@/components/command-palette-preview-champion", () => ({
  CommandPalettePreviewChampion: ({ alias }: { alias: string }) => (
    <div data-testid="champion-preview" data-alias={alias} />
  ),
}));

describe("CommandPalettePreview dispatch", () => {
  it("renders nothing for empty value", () => {
    const { container } = render(<CommandPalettePreview value="" />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing for un-prefixed values (pages, tabs, recents)", () => {
    const { container } = render(<CommandPalettePreview value="home" />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing for account values (no preview content yet)", () => {
    const { container } = render(<CommandPalettePreview value="account:foo Foo BAR" />);
    expect(container.firstChild).toBeNull();
  });

  it("dispatches champion sentinel to the champion preview", () => {
    render(<CommandPalettePreview value="champion:jinx jinx jinx" />);
    const preview = screen.getByTestId("champion-preview");
    expect(preview.getAttribute("data-alias")).toBe("jinx");
  });

  it("preserves alias casing through dispatch", () => {
    render(<CommandPalettePreview value="champion:JarvanIV jarvaniv jarvan iv" />);
    expect(screen.getByTestId("champion-preview").getAttribute("data-alias")).toBe(
      "JarvanIV"
    );
  });
});
