import { render, screen } from "@testing-library/react";
import type { SteamOwnedGame } from "@vyoh/shared";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { LibraryTile } from "./library-tile";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: { children: ReactNode }) => (
    <a {...(props as Record<string, string>)}>{children}</a>
  ),
}));

vi.mock("@/steam/profile-backdrop", () => ({
  prefetchSteamGameBackdrop: vi.fn(),
}));

vi.mock("./library-tile-hovercard", () => ({
  LibraryTileHovercardContent: () => null,
}));

function game(overrides: Partial<SteamOwnedGame> = {}): SteamOwnedGame {
  return {
    appid: 440,
    name: "Team Fortress 2",
    playtimeForeverMinutes: 0,
    playtime2WeeksMinutes: 0,
    rtimeLastPlayedAt: null,
    iconHash: null,
    appType: 0,
    assetTimestamp: null,
    tagIds: [],
    ...overrides,
  } as unknown as SteamOwnedGame;
}

function renderTile(g: SteamOwnedGame) {
  return render(
    <ul>
      <LibraryTile game={g} />
    </ul>
  );
}

describe("LibraryTile", () => {
  it("renders the game name", () => {
    renderTile(game({ name: "Half-Life 2" }));
    expect(screen.getByText("Half-Life 2")).toBeTruthy();
  });

  it("renders the 'Never launched' meta when playtime is zero", () => {
    renderTile(game({ playtimeForeverMinutes: 0 }));
    expect(screen.getByText("Never launched")).toBeTruthy();
  });

  it("renders a formatted lifetime line when playtime is non-zero", () => {
    const { container } = renderTile(game({ playtimeForeverMinutes: 240 }));
    expect(container.textContent).toMatch(/lifetime/);
    expect(container.textContent).not.toContain("Never launched");
  });
});
