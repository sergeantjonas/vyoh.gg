import { render, screen } from "@testing-library/react";
import type { HomeFirstPlayed } from "@vyoh/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TileFirstPlayed } from "./tile-first-played";
import { useHomeFirstPlayed } from "./use-home-first-played";

vi.mock("./use-home-first-played", () => ({ useHomeFirstPlayed: vi.fn() }));
vi.mock("@/lol/champions/use-champions", () => ({
  useChampionName: () => (alias: string) => alias,
}));
vi.mock("@/lol/_shared/assets/champion-square-icon", () => ({
  ChampionSquareIcon: ({ alt }: { alt: string }) => <img alt={alt} />,
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
    <a {...props}>{children}</a>
  ),
}));

function mockHook(value: { data: HomeFirstPlayed | undefined; isPending: boolean }) {
  vi.mocked(useHomeFirstPlayed).mockReturnValue(
    value as unknown as ReturnType<typeof useHomeFirstPlayed>
  );
}

const NOW = new Date("2026-05-19T12:00:00.000Z").getTime();

beforeEach(() => {
  vi.useFakeTimers({ now: NOW });
});

afterEach(() => {
  vi.useRealTimers();
  vi.mocked(useHomeFirstPlayed).mockReset();
});

describe("TileFirstPlayed", () => {
  it("renders the loading verdict while pending", () => {
    mockHook({ data: undefined, isPending: true });
    render(<TileFirstPlayed />);
    expect(screen.getByText("Looking for what's new…")).toBeTruthy();
  });

  it("renders the no-signal verdict when the query resolves with no data", () => {
    mockHook({ data: undefined, isPending: false });
    render(<TileFirstPlayed />);
    expect(screen.getByText("No rotation signal available.")).toBeTruthy();
  });

  it("renders the window-days verdict on a 'none' result", () => {
    mockHook({ data: { kind: "none", windowDays: 30 }, isPending: false });
    render(<TileFirstPlayed />);
    expect(screen.getByText("Same rotation as the last 30 days.")).toBeTruthy();
  });

  it("renders the LoL view with a deep link when accountSlug is present", () => {
    mockHook({
      data: {
        kind: "lol",
        champion: "Ahri",
        firstPlayedAt: new Date(NOW - 3 * 86_400_000).toISOString(),
        matchId: "EUW1_1",
        matchCount: 4,
        wins: 3,
        accountSlug: "ahri",
      },
      isPending: false,
    });
    const { container } = render(<TileFirstPlayed />);
    expect(screen.getByText("Ahri · LoL")).toBeTruthy();
    expect(screen.getByText(/3d ago · 4 matches \(3W-1L\)/)).toBeTruthy();
    expect(container.querySelector("a")).not.toBeNull();
  });

  it("renders the LoL view without a link when accountSlug is null", () => {
    mockHook({
      data: {
        kind: "lol",
        champion: "Ahri",
        firstPlayedAt: new Date(NOW).toISOString(),
        matchId: "X",
        matchCount: 1,
        wins: 0,
        accountSlug: null,
      },
      isPending: false,
    });
    const { container } = render(<TileFirstPlayed />);
    expect(container.querySelector("a")).toBeNull();
    expect(screen.getByText(/today · 1 match \(0W-1L\)/)).toBeTruthy();
  });

  it("renders the Steam view with playtime so far", () => {
    mockHook({
      data: {
        kind: "steam",
        appid: 12345,
        name: "Hades",
        firstPlayedAt: new Date(NOW - 86_400_000).toISOString(),
        totalMinutes: 90,
      },
      isPending: false,
    });
    render(<TileFirstPlayed />);
    expect(screen.getByText("Hades · Steam")).toBeTruthy();
    expect(screen.getByText(/yesterday · 1h 30m so far/)).toBeTruthy();
  });
});
