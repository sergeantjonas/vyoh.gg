import { render, screen } from "@testing-library/react";
import type { SteamLibrarySummary, SteamOwnedGames } from "@vyoh/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SteamStatBand } from "./steam-stat-band";

const libMock = vi.fn();
const ownedMock = vi.fn();

vi.mock("@/steam/use-library-summary", () => ({
  useSteamLibrarySummary: () => ({ data: libMock() }),
}));
vi.mock("@/steam/use-owned-games", () => ({
  useSteamOwnedGames: () => ({ data: ownedMock() }),
}));

function lib(overrides: Partial<SteamLibrarySummary> = {}): SteamLibrarySummary {
  return {
    ownedCount: 175,
    everLaunchedCount: 72,
    untouchedCount: 103,
    lastSyncedAt: "2026-05-30T00:00:00.000Z",
    ...overrides,
  };
}

function owned(): SteamOwnedGames {
  // Anchor 2 hours before the fixed `now` so "Recently played · 2h ago" is
  // deterministic without depending on Date.now() at test time.
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60_000).toISOString();
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60_000).toISOString();
  return {
    steamId: "76561198020053778",
    games: [
      // Most-played, sort-DESC head. Was played most recently too — the band
      // should *skip* this one for the Recently Played cell and pick Balatro.
      {
        appid: 1,
        name: "ELDEN RING NIGHTREIGN",
        assetTimestamp: 99,
        playtimeForeverMinutes: 26040, // 434h
        playtime2WeeksMinutes: 480,
        rtimeLastPlayedAt: twoHoursAgo,
      },
      // Long-owned, dormant — no recent activity, never the recently-played
      // pick.
      {
        appid: 2,
        name: "ELDEN RING",
        assetTimestamp: 88,
        playtimeForeverMinutes: 22680, // 378h
        playtime2WeeksMinutes: 0,
        rtimeLastPlayedAt: null,
      },
      // The distinct-recent pick: played a few days ago, not the top game.
      {
        appid: 4,
        name: "Balatro",
        assetTimestamp: 77,
        playtimeForeverMinutes: 480,
        playtime2WeeksMinutes: 120,
        rtimeLastPlayedAt: twoDaysAgo,
      },
    ],
    fetchedAt: "2026-05-30T00:00:00.000Z",
  } as unknown as SteamOwnedGames;
}

beforeEach(() => {
  libMock.mockReturnValue(lib());
  ownedMock.mockReturnValue(owned());
});

describe("SteamStatBand", () => {
  it("renders the recently-played game distinct from the most-played one", () => {
    const { container } = render(<SteamStatBand />);
    // Balatro is the *second*-most-recent game — picked because the
    // most-recent one (Nightreign) is already the most-played cell.
    const balatroLogo = container.querySelector('img[alt="Balatro"]');
    expect(balatroLogo).toBeTruthy();
    expect(balatroLogo?.getAttribute("src")).toContain("/logo/");
    // Sub-stat row + uppercase label row.
    expect(screen.getByText("2d ago")).toBeTruthy();
    expect(screen.getByText("Recently played")).toBeTruthy();
  });

  it("falls back to the only-played game when no distinct alternative exists", () => {
    const oneHourAgo = new Date(Date.now() - 60 * 60_000).toISOString();
    ownedMock.mockReturnValue({
      steamId: "76561198020053778",
      games: [
        {
          appid: 1,
          name: "ELDEN RING NIGHTREIGN",
          assetTimestamp: 99,
          playtimeForeverMinutes: 26040,
          playtime2WeeksMinutes: 480,
          rtimeLastPlayedAt: oneHourAgo,
        },
      ],
      fetchedAt: "2026-05-30T00:00:00.000Z",
    });
    const { container } = render(<SteamStatBand />);
    // Same game in both game cells — acceptable when there's no second
    // distinct title to surface.
    expect(container.querySelectorAll('img[alt="ELDEN RING NIGHTREIGN"]').length).toBe(2);
    expect(screen.getByText("1h ago")).toBeTruthy();
  });

  it("falls back to an em-dash when nothing has ever been played", () => {
    ownedMock.mockReturnValue({
      steamId: "76561198020053778",
      games: [
        {
          appid: 1,
          name: "ELDEN RING NIGHTREIGN",
          assetTimestamp: 99,
          playtimeForeverMinutes: 0,
          playtime2WeeksMinutes: 0,
          rtimeLastPlayedAt: null,
        },
      ],
      fetchedAt: "2026-05-30T00:00:00.000Z",
    });
    render(<SteamStatBand />);
    expect(screen.getByText("Recently played")).toBeTruthy();
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("renders total playtime with the past-2-weeks rollup sub-line", () => {
    render(<SteamStatBand />);
    // (26040 + 22680 + 480) / 60 = 820h total.
    expect(screen.getByText("820h")).toBeTruthy();
    expect(screen.getByText("Total playtime")).toBeTruthy();
    // (480 + 0 + 120) / 60 = 10h in the fortnight.
    expect(screen.getByText(/\+10h past 2 weeks/)).toBeTruthy();
  });

  it("hides the past-2-weeks sub-line when nothing was played in the fortnight", () => {
    ownedMock.mockReturnValue({
      steamId: "76561198020053778",
      games: [
        {
          appid: 2,
          name: "ELDEN RING",
          assetTimestamp: 88,
          playtimeForeverMinutes: 22680,
          playtime2WeeksMinutes: 0,
          rtimeLastPlayedAt: null,
        },
      ],
      fetchedAt: "2026-05-30T00:00:00.000Z",
    });
    render(<SteamStatBand />);
    expect(screen.queryByText(/past 2 weeks/)).toBeNull();
  });

  it("shows the most-played game as a wordmark logo with hours in the sub-stat row", () => {
    const { container } = render(<SteamStatBand />);
    // The game wordmark logo (alt = name), routed through the logo proxy.
    const logo = container.querySelector('img[alt="ELDEN RING NIGHTREIGN"]');
    expect(logo).toBeTruthy();
    expect(logo?.getAttribute("src")).toContain("/logo/");
    // Sub-stat row + uppercase label row.
    expect(screen.getByText("434h")).toBeTruthy();
    expect(screen.getByText("Most played")).toBeTruthy();
  });

  it("renders the library-played split as a count, bar, and percentage", () => {
    render(<SteamStatBand />);
    // everLaunched 72 / owned 175 → "72 / 175 played", 41%, 103 backlog.
    expect(screen.getByText("72 / 175")).toBeTruthy();
    expect(screen.getByText(/41% · 103 in backlog/)).toBeTruthy();
  });

  it("renders em-dash placeholders before data resolves", () => {
    libMock.mockReturnValue(undefined);
    ownedMock.mockReturnValue(undefined);
    render(<SteamStatBand />);
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });
});
