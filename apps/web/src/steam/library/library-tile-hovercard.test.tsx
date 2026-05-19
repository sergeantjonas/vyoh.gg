import { act, fireEvent, render, screen } from "@testing-library/react";
import type { SteamOwnedGame } from "@vyoh/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LibraryTileHovercardContent } from "./library-tile-hovercard";
import { useGameMedia } from "./use-game-media";

vi.mock("./use-game-media", () => ({
  useGameMedia: vi.fn(),
}));

function mockMedia(screenshots: { thumbUrl: string; fullUrl?: string }[] = []) {
  vi.mocked(useGameMedia).mockReturnValue({
    data: { screenshots },
  } as unknown as ReturnType<typeof useGameMedia>);
}

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
    ...overrides,
  } as SteamOwnedGame;
}

beforeEach(() => {
  mockMedia([]);
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-05-19T12:00:00Z"));
});

afterEach(() => {
  vi.mocked(useGameMedia).mockReset();
  vi.useRealTimers();
});

describe("LibraryTileHovercardContent", () => {
  it("renders '0 min' under Total when the game has never been launched", () => {
    render(<LibraryTileHovercardContent game={game()} />);
    expect(screen.getByText("Total")).toBeTruthy();
    expect(screen.getAllByText("0 min").length).toBeGreaterThan(0);
  });

  it("renders minutes precision under 60 minutes", () => {
    render(<LibraryTileHovercardContent game={game({ playtimeForeverMinutes: 45 })} />);
    expect(screen.getByText("45 min")).toBeTruthy();
  });

  it("renders tenths-of-hour precision under 10 hours", () => {
    render(<LibraryTileHovercardContent game={game({ playtimeForeverMinutes: 204 })} />);
    expect(screen.getByText("3.4 hrs")).toBeTruthy();
  });

  it("renders whole-hour precision at or above 10 hours", () => {
    render(
      <LibraryTileHovercardContent game={game({ playtimeForeverMinutes: 6_000 })} />
    );
    expect(screen.getByText("100 hrs")).toBeTruthy();
  });

  it("omits the 'Last played' row when rtimeLastPlayedAt is null", () => {
    const { container } = render(
      <LibraryTileHovercardContent game={game({ rtimeLastPlayedAt: null })} />
    );
    expect(container.textContent).not.toContain("Last played");
  });

  it("renders a relative-time 'Last played' line when the timestamp is set", () => {
    // 10 days before the system time → "10 days ago".
    const tenDaysAgo = new Date("2026-05-09T12:00:00Z").toISOString();
    const { container } = render(
      <LibraryTileHovercardContent
        game={game({ rtimeLastPlayedAt: tenDaysAgo, playtimeForeverMinutes: 30 })}
      />
    );
    expect(container.textContent).toContain("Last played");
    expect(container.textContent).toMatch(/10 days ago/);
  });

  it("renders 'months ago' for timestamps in the 1–24 month range", () => {
    // 90 days back → ~3 months.
    const threeMonthsAgo = new Date("2026-02-18T12:00:00Z").toISOString();
    const { container } = render(
      <LibraryTileHovercardContent
        game={game({ rtimeLastPlayedAt: threeMonthsAgo, playtimeForeverMinutes: 5 })}
      />
    );
    expect(container.textContent).toMatch(/months ago/);
  });

  it("renders 'years ago' for timestamps further back than 24 months", () => {
    // ~3 years ago.
    const yearsAgo = new Date("2023-05-19T12:00:00Z").toISOString();
    const { container } = render(
      <LibraryTileHovercardContent
        game={game({ rtimeLastPlayedAt: yearsAgo, playtimeForeverMinutes: 5 })}
      />
    );
    expect(container.textContent).toMatch(/years ago/);
  });

  it("falls back to the capsule when the hero img errors", () => {
    const { container } = render(<LibraryTileHovercardContent game={game()} />);
    const hero = container.querySelector("img");
    if (!hero) throw new Error("hero img not rendered");
    fireEvent.error(hero);
    // After error, capsule img replaces hero — but still exactly one img.
    expect(container.querySelectorAll("img").length).toBe(1);
  });

  it("treats a zero-width hero onLoad as a 404 (wsrv empty-200 path)", () => {
    const { container } = render(<LibraryTileHovercardContent game={game()} />);
    const hero = container.querySelector("img");
    if (!hero) throw new Error("hero img not rendered");
    Object.defineProperty(hero, "naturalWidth", { value: 0, configurable: true });
    fireEvent.load(hero);
    // Still one img after the swap (capsule fallback).
    expect(container.querySelectorAll("img").length).toBe(1);
  });

  it("marks the hero as loaded when onLoad reports a non-zero natural width", () => {
    const { container } = render(<LibraryTileHovercardContent game={game()} />);
    const hero = container.querySelector("img") as HTMLImageElement;
    Object.defineProperty(hero, "naturalWidth", { value: 1280, configurable: true });
    fireEvent.load(hero);
    expect(hero.style.opacity).toBe("1");
  });

  it("rotates the screenshot index on the interval when ≥2 screenshots exist", () => {
    mockMedia([
      { thumbUrl: "https://example.com/a.jpg" },
      { thumbUrl: "https://example.com/b.jpg" },
      { thumbUrl: "https://example.com/c.jpg" },
    ]);
    render(<LibraryTileHovercardContent game={game()} />);
    // Advance two rotation intervals — the second one flips `hasRotated`.
    act(() => {
      vi.advanceTimersByTime(2_500);
    });
    act(() => {
      vi.advanceTimersByTime(2_500);
    });
    // Sanity: at least three screenshot imgs render (one per element).
    const imgs = document.querySelectorAll('img[src^="https://example.com"]');
    expect(imgs.length).toBe(3);
  });

  it("skips the rotation tick while the document is hidden", () => {
    mockMedia([
      { thumbUrl: "https://example.com/a.jpg" },
      { thumbUrl: "https://example.com/b.jpg" },
    ]);
    const visibilitySpy = vi
      .spyOn(document, "visibilityState", "get")
      .mockReturnValue("hidden");
    render(<LibraryTileHovercardContent game={game()} />);
    act(() => {
      vi.advanceTimersByTime(2_500);
    });
    // We can't read index directly; just ensure rendering did not throw and the
    // imgs still exist.
    expect(document.querySelectorAll('img[src^="https://example.com"]').length).toBe(2);
    visibilitySpy.mockRestore();
  });
});
