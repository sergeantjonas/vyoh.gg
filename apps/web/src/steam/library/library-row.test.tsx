import { render, screen } from "@testing-library/react";
import type { SteamOwnedGame } from "@vyoh/shared";
import type { ReactNode } from "react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { LibraryRow } from "./library-row";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: { children: ReactNode }) => <a {...props}>{children}</a>,
}));

// profile-backdrop's prefetch import has side-effects; mock to keep tests pure.
vi.mock("@/steam/profile-backdrop", () => ({
  prefetchSteamGameBackdrop: vi.fn(),
}));

function makeGame(overrides: Partial<SteamOwnedGame> = {}): SteamOwnedGame {
  return {
    appid: 440,
    name: "Team Fortress 2",
    playtimeForeverMinutes: 0,
    playtime2WeeksMinutes: null,
    assetUrlFormat: null,
    assetTimestamp: null,
    libraryCapsulePath: null,
    libraryCapsule2xPath: null,
    libraryHeroPath: null,
    libraryHero2xPath: null,
    headerPath: null,
    heroCapsulePath: null,
    logoPath: null,
    appType: 0,
    tagIds: [],
    rtimeLastPlayedAt: null,
    ...overrides,
  };
}

const NOW_ISO = "2026-05-19T12:00:00Z";

beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(NOW_ISO));
});

afterAll(() => {
  vi.useRealTimers();
});

describe("LibraryRow", () => {
  it("renders the game name and 'Never launched' when no playtime is recorded", () => {
    render(<LibraryRow game={makeGame({ name: "Half-Life 2" })} />);
    expect(screen.getByText("Half-Life 2")).toBeTruthy();
    expect(screen.getByText("Never launched")).toBeTruthy();
  });

  it("renders lifetime in hours when playtimeForeverMinutes is set", () => {
    const { container } = render(
      <LibraryRow game={makeGame({ playtimeForeverMinutes: 6000 })} />
    );
    // 6000m / 60 = 100h
    expect(container.textContent).toContain("100h lifetime");
  });

  it("appends 'last two weeks' marker when the 2-week field is non-zero", () => {
    const { container } = render(
      <LibraryRow
        game={makeGame({
          playtimeForeverMinutes: 6000,
          playtime2WeeksMinutes: 120,
        })}
      />
    );
    expect(container.textContent).toContain("100h lifetime");
    expect(container.textContent).toContain("2h last two weeks");
  });

  it("suppresses the 'last played' hint when the 2-week marker is set (avoids duplicate signals)", () => {
    const { container } = render(
      <LibraryRow
        game={makeGame({
          playtimeForeverMinutes: 6000,
          playtime2WeeksMinutes: 120,
          rtimeLastPlayedAt: "2026-05-18T00:00:00Z",
        })}
      />
    );
    expect(container.textContent).not.toMatch(/last played/);
  });

  it("renders the 'last played' hint for cold rows when 2-week is null", () => {
    const { container } = render(
      <LibraryRow
        game={makeGame({
          playtimeForeverMinutes: 6000,
          playtime2WeeksMinutes: null,
          // 180 days ago
          rtimeLastPlayedAt: "2025-11-20T12:00:00Z",
        })}
      />
    );
    expect(container.textContent).toMatch(/last played .*months ago/);
  });
});
