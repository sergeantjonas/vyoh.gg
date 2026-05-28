import { render, screen } from "@testing-library/react";
import type { MatchSummary } from "@vyoh/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CommandPalettePreview } from "./command-palette-preview";

vi.mock("@/components/command-palette-preview-champion", () => ({
  CommandPalettePreviewChampion: ({ alias }: { alias: string }) => (
    <div data-testid="champion-preview" data-alias={alias} />
  ),
}));

vi.mock("@/components/command-palette-preview-match", () => ({
  CommandPalettePreviewMatch: ({ match }: { match: MatchSummary }) => (
    <div data-testid="match-preview" data-match-id={match.matchId} />
  ),
}));

vi.mock("@/components/command-palette-preview-steam-game", () => ({
  CommandPalettePreviewSteamGame: ({ appid }: { appid: string }) => (
    <div data-testid="steam-game-preview" data-appid={appid} />
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
    const { container } = render(<CommandPalettePreview matches={null} value="" />);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId("champion-preview")).toBeNull();
  });

  it("renders nothing for un-prefixed values (pages, tabs, recents)", () => {
    render(<CommandPalettePreview matches={null} value="home" />);
    expect(screen.queryByTestId("champion-preview")).toBeNull();
  });

  it("renders nothing for account values (no preview content yet)", () => {
    render(<CommandPalettePreview matches={null} value="account:foo Foo BAR" />);
    expect(screen.queryByTestId("champion-preview")).toBeNull();
  });

  it("dispatches champion sentinel to the champion preview", () => {
    render(<CommandPalettePreview matches={null} value="champion:jinx jinx jinx" />);
    const preview = screen.getByTestId("champion-preview");
    expect(preview.getAttribute("data-alias")).toBe("jinx");
  });

  it("preserves alias casing through dispatch", () => {
    render(
      <CommandPalettePreview
        matches={null}
        value="champion:JarvanIV jarvaniv jarvan iv"
      />
    );
    expect(screen.getByTestId("champion-preview").getAttribute("data-alias")).toBe(
      "JarvanIV"
    );
  });

  it("dispatches match sentinel to the match preview when match is in the cache", () => {
    const match = { matchId: "EUW1_1234", champion: "Jinx", win: true } as MatchSummary;
    render(
      <CommandPalettePreview
        matches={[match]}
        value="match:EUW1_1234 jinx wins ranked solo"
      />
    );
    const preview = screen.getByTestId("match-preview");
    expect(preview.getAttribute("data-match-id")).toBe("EUW1_1234");
  });

  it("renders nothing for match sentinel when the cache hasn't loaded", () => {
    render(<CommandPalettePreview matches={null} value="match:EUW1_1234 jinx wins" />);
    expect(screen.queryByTestId("match-preview")).toBeNull();
  });

  it("renders nothing for match sentinel when the match isn't in the cache", () => {
    render(<CommandPalettePreview matches={[]} value="match:EUW1_404 jinx wins" />);
    expect(screen.queryByTestId("match-preview")).toBeNull();
  });

  it("dispatches steam-game sentinel to the steam-game preview", () => {
    render(
      <CommandPalettePreview matches={null} value="steam-game:570 steam dota 2 570" />
    );
    const preview = screen.getByTestId("steam-game-preview");
    expect(preview.getAttribute("data-appid")).toBe("570");
  });
});
