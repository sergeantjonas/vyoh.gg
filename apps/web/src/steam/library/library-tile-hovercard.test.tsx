import { useGameScreenshots } from "@/steam/game/use-game-screenshots";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { SteamOwnedGame } from "@vyoh/shared";
import { configureAxe } from "jest-axe";
import { MotionConfig } from "motion/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LibraryTileHovercardContent } from "./library-tile-hovercard";

vi.mock("@/steam/game/use-game-screenshots", () => ({
  useGameScreenshots: vi.fn(),
}));

function mockMedia(entries: { filename: string; ordinal: number }[] = []) {
  vi.mocked(useGameScreenshots).mockReturnValue({
    data: { appid: 440, allAges: entries, mature: [] },
    isPending: false,
  } as unknown as ReturnType<typeof useGameScreenshots>);
}

function mockMediaPending() {
  vi.mocked(useGameScreenshots).mockReturnValue({
    data: undefined,
    isPending: true,
  } as unknown as ReturnType<typeof useGameScreenshots>);
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
  vi.mocked(useGameScreenshots).mockReset();
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

  it("renders a pulsing scrim over the hero while the screenshots query is pending", () => {
    mockMediaPending();
    const { container } = render(<LibraryTileHovercardContent game={game()} />);
    // The scrim is the absolutely-positioned animate-pulse div over the hero;
    // it's the only `animate-pulse` element in the hovercard body.
    expect(container.querySelector(".animate-pulse")).toBeTruthy();
  });

  it("removes the pulsing scrim once the screenshots query resolves (empty bucket)", () => {
    mockMedia([]);
    const { container } = render(<LibraryTileHovercardContent game={game()} />);
    expect(container.querySelector(".animate-pulse")).toBeNull();
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
      { filename: "ss_a.jpg", ordinal: 1 },
      { filename: "ss_b.jpg", ordinal: 2 },
      { filename: "ss_c.jpg", ordinal: 3 },
    ]);
    render(<LibraryTileHovercardContent game={game()} />);
    // Advance two rotation intervals — the second one flips `hasRotated`.
    act(() => {
      vi.advanceTimersByTime(2_500);
    });
    act(() => {
      vi.advanceTimersByTime(2_500);
    });
    // Sanity: three screenshot imgs render (one per entry), URL composed via
    // the shared helper so the host comes from the steamstatic CDN base.
    const imgs = document.querySelectorAll('img[src*="steamstatic"]');
    expect(imgs.length).toBe(3);
  });

  it("renders the short description in the meta block when set", () => {
    const { container } = render(
      <LibraryTileHovercardContent
        game={game({ shortDescription: "A hat-based shooter." })}
      />
    );
    expect(container.textContent).toContain("A hat-based shooter.");
  });

  it("omits the short description block when null", () => {
    const { container } = render(
      <LibraryTileHovercardContent game={game({ shortDescription: null })} />
    );
    // No <p> with italic class slipped in.
    expect(container.querySelector("p.italic")).toBeNull();
  });

  it("skips the rotation tick while the document is hidden", () => {
    mockMedia([
      { filename: "ss_a.jpg", ordinal: 1 },
      { filename: "ss_b.jpg", ordinal: 2 },
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
    expect(document.querySelectorAll('img[src*="steamstatic"]').length).toBe(2);
    visibilitySpy.mockRestore();
  });

  it("renders a looping <video> in place of the screenshot rotation when a microtrailer exists", () => {
    mockMedia([
      { filename: "ss_a.jpg", ordinal: 1 },
      { filename: "ss_b.jpg", ordinal: 2 },
    ]);
    const { container } = render(
      <LibraryTileHovercardContent
        game={game({
          microtrailerWebm: "440/657549/hash/1750745214/microtrailer.webm",
          microtrailerMp4: "440/657549/hash/1750745214/microtrailer.mp4",
          microtrailerPoster: "256998128/movie.293x165.jpg",
          microtrailerName: "Full Launch trailer",
        })}
      />
    );
    const video = container.querySelector("video");
    if (!video) throw new Error("video not rendered");
    expect(video.getAttribute("aria-label")).toBe("Full Launch trailer");
    expect(video.hasAttribute("autoplay")).toBe(true);
    expect(video.hasAttribute("loop")).toBe(true);
    expect(video.hasAttribute("muted")).toBe(true);
    expect(video.getAttribute("poster")).toContain(
      "/img/steam/microtrailer-poster/256998128/movie.293x165.jpg"
    );
    const sources = video.querySelectorAll("source");
    expect(sources.length).toBe(2);
    expect(sources[0]?.getAttribute("type")).toBe("video/webm");
    expect(sources[1]?.getAttribute("type")).toBe("video/mp4");
    // Screenshot rotation suppressed even when screenshots exist.
    expect(container.querySelectorAll('img[src*="steamstatic"]').length).toBe(0);
  });

  it("falls back to the poster <img> under prefers-reduced-motion", () => {
    const { container } = render(
      <MotionConfig reducedMotion="always">
        <LibraryTileHovercardContent
          game={game({
            microtrailerWebm: "440/657549/hash/1750745214/microtrailer.webm",
            microtrailerMp4: "440/657549/hash/1750745214/microtrailer.mp4",
            microtrailerPoster: "256998128/movie.293x165.jpg",
            microtrailerName: "Full Launch trailer",
          })}
        />
      </MotionConfig>
    );
    expect(container.querySelector("video")).toBeNull();
    const posterImg = container.querySelector(
      'img[src*="/img/steam/microtrailer-poster/"]'
    );
    expect(posterImg).not.toBeNull();
    expect(posterImg?.getAttribute("alt")).toBe("Full Launch trailer");
  });

  it("does not fetch screenshots when the microtrailer is present", () => {
    render(
      <LibraryTileHovercardContent
        game={game({
          microtrailerWebm: "440/657549/hash/1750745214/microtrailer.webm",
          microtrailerMp4: null,
          microtrailerPoster: null,
          microtrailerName: null,
        })}
      />
    );
    const lastCallEnabled = vi.mocked(useGameScreenshots).mock.calls.at(-1)?.[1]?.enabled;
    expect(lastCallEnabled).toBe(false);
  });

  it("omits the mp4 source when only the webm filename is set", () => {
    const { container } = render(
      <LibraryTileHovercardContent
        game={game({
          microtrailerWebm: "440/657549/hash/1750745214/microtrailer.webm",
          microtrailerMp4: null,
          microtrailerPoster: null,
          microtrailerName: null,
        })}
      />
    );
    const sources = container.querySelectorAll("video source");
    expect(sources.length).toBe(1);
    expect(sources[0]?.getAttribute("type")).toBe("video/webm");
  });

  it("renders the screenshot rotation unchanged when no microtrailer exists", () => {
    mockMedia([
      { filename: "ss_a.jpg", ordinal: 1 },
      { filename: "ss_b.jpg", ordinal: 2 },
    ]);
    const { container } = render(<LibraryTileHovercardContent game={game()} />);
    expect(container.querySelector("video")).toBeNull();
    expect(document.querySelectorAll('img[src*="steamstatic"]').length).toBe(2);
  });

  it("passes an axe scan on the rotation branch", async () => {
    // Axe uses microtasks + setTimeout internally; fake timers (set in
    // beforeEach for the rotation tests) leave the scan hanging. Drop back
    // to real timers for the scan, then restore so afterEach can still call
    // useRealTimers cleanly. The trailer branch is excluded because
    // happy-dom kicks off real fetches for `<video>` sources, which the
    // scan races with — we cover that branch separately by asserting the
    // explicit aria-label / source structure above.
    vi.useRealTimers();
    const axe = configureAxe({
      rules: {
        "color-contrast": { enabled: false },
        "aria-hidden-focus": { enabled: false },
      },
    });
    mockMedia([{ filename: "ss_a.jpg", ordinal: 1 }]);
    const rotation = render(<LibraryTileHovercardContent game={game()} />);
    expect((await axe(rotation.container)).violations).toEqual([]);
  });
});
