import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CommandPalettePreview } from "./command-palette-preview";

vi.mock("@/components/command-palette-preview-champion", () => ({
  CommandPalettePreviewChampion: ({ alias }: { alias: string }) => (
    <div data-testid="champion-preview" data-alias={alias} />
  ),
}));

// Floating UI needs a reference element to anchor against. The dispatcher
// finds the focused cmdk row via `document.querySelector('[cmdk-item]
// [aria-selected="true"]')`, so the dispatch specs that assert content
// renders need to install one in the test DOM.
function installCmdkItem() {
  const item = document.createElement("div");
  item.setAttribute("cmdk-item", "");
  item.setAttribute("aria-selected", "true");
  document.body.appendChild(item);
  return () => item.remove();
}

describe("CommandPalettePreview dispatch", () => {
  let cleanup: (() => void) | undefined;
  beforeEach(() => {
    cleanup = installCmdkItem();
  });
  afterEach(() => {
    cleanup?.();
  });

  it("renders nothing for empty value", () => {
    const { container } = render(<CommandPalettePreview value="" />);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId("champion-preview")).toBeNull();
  });

  it("renders nothing for un-prefixed values (pages, tabs, recents)", () => {
    render(<CommandPalettePreview value="home" />);
    expect(screen.queryByTestId("champion-preview")).toBeNull();
  });

  it("renders nothing for account values (no preview content yet)", () => {
    render(<CommandPalettePreview value="account:foo Foo BAR" />);
    expect(screen.queryByTestId("champion-preview")).toBeNull();
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
