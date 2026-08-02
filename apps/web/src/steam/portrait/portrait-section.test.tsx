import { render, screen } from "@testing-library/react";
import type { GenreFingerprint, SteamPortrait } from "@vyoh/shared";
import { configureAxe } from "jest-axe";
import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PortraitSection } from "./portrait-section";
import { useSteamPortrait } from "./use-portrait";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: { children: ReactNode }) => <a {...props}>{children}</a>,
}));

vi.mock("./use-portrait", () => ({ useSteamPortrait: vi.fn() }));

const axe = configureAxe({ rules: { "color-contrast": { enabled: false } } });

// The owner's live shape as of 2026-08-02, rounded: a lifetime anchored hard
// in Souls-likes, and a recency window with almost nothing in it.
const LIFETIME: GenreFingerprint = {
  genres: [
    { tag: "Souls-like", minutes: 42_180, share: 0.298, gameCount: 15 },
    { tag: "Action RPG", minutes: 32_220, share: 0.228, gameCount: 13 },
    { tag: "Third-Person Shooter", minutes: 9_180, share: 0.065, gameCount: 10 },
    { tag: "Roguelite", minutes: 8_700, share: 0.061, gameCount: 1 },
  ],
  distributedMinutes: 141_360,
  gamesCounted: 54,
  gamesWithoutGenre: 1,
};

function portrait(overrides: Partial<SteamPortrait> = {}): SteamPortrait {
  return {
    lifetime: LIFETIME,
    recent: null,
    posture: {
      ownedCount: 186,
      meaningfulCount: 55,
      tastedCount: 11,
      ghostCount: 120,
      totalMinutes: 143_100,
      meaningfulMinutes: 142_814,
    },
    lastSyncedAt: "2026-08-02T00:00:00.000Z",
    ...overrides,
  };
}

function mockHook(value: {
  data: SteamPortrait | undefined;
  isPending: boolean;
  isError: boolean;
}): void {
  vi.mocked(useSteamPortrait).mockReturnValue(
    value as unknown as ReturnType<typeof useSteamPortrait>
  );
}

function renderSection() {
  return render(
    <MotionConfig reducedMotion="always">
      <PortraitSection />
    </MotionConfig>
  );
}

afterEach(() => {
  vi.mocked(useSteamPortrait).mockReset();
});

describe("PortraitSection", () => {
  it("discloses that the genres are inferred rather than published", () => {
    mockHook({ data: portrait(), isPending: false, isError: false });
    renderSection();
    expect(screen.getByText("Genres derived from community tags")).toBeTruthy();
  });

  it("has no axe violations", async () => {
    mockHook({ data: portrait(), isPending: false, isError: false });
    const { container } = renderSection();
    expect((await axe(container)).violations).toEqual([]);
  });

  it("renders a loading verdict for every card while the query is pending", () => {
    mockHook({ data: undefined, isPending: true, isError: false });
    renderSection();
    expect(screen.getByText("Reading the genre fingerprint…")).toBeTruthy();
    expect(screen.getByText("Reading the recent window…")).toBeTruthy();
    expect(screen.getByText("Counting the shelf…")).toBeTruthy();
  });

  it("renders unavailable verdicts on error", () => {
    mockHook({ data: undefined, isPending: false, isError: true });
    renderSection();
    expect(
      screen.getByText("The genre fingerprint is unavailable right now.")
    ).toBeTruthy();
    expect(screen.getByText("Library posture is unavailable right now.")).toBeTruthy();
  });
});

describe("GenreAnchorCard", () => {
  it("names only the genres carried by enough games, and shows the counts", () => {
    mockHook({ data: portrait(), isPending: false, isError: false });
    renderSection();

    // Roguelite is ranked fourth and rests on one game, so it is not named.
    expect(
      screen.getByText(
        "59% of your 2,356h sit in Souls-like, Action RPG and Third-Person Shooter."
      )
    ).toBeTruthy();
    expect(screen.getByText("Souls-like alone is 15 games and 703h.")).toBeTruthy();
    expect(screen.queryByText(/Roguelite/)).toBeNull();
    // The evidence row carries the carrier count next to every named genre.
    expect(screen.getByText(/30% · 15 games/)).toBeTruthy();
    expect(screen.getByText(/7% · 10 games/)).toBeTruthy();
  });

  it("falls back to an empty state when nothing played carries a genre", () => {
    mockHook({
      data: portrait({
        lifetime: {
          genres: [],
          distributedMinutes: 0,
          gamesCounted: 0,
          gamesWithoutGenre: 4,
        },
      }),
      isPending: false,
      isError: false,
    });
    renderSection();
    expect(screen.getByText("No played game carries a genre tag yet.")).toBeTruthy();
  });
});

describe("RecentDriftCard", () => {
  it("says there is no window at all before a second snapshot exists", () => {
    mockHook({ data: portrait({ recent: null }), isPending: false, isError: false });
    renderSection();
    expect(screen.getByText("No window to measure yet.")).toBeTruthy();
  });

  it("refuses to rank a window where every genre rests on one game", () => {
    mockHook({
      data: portrait({
        recent: {
          window: {
            days: 80,
            since: "2026-05-14T00:00:00.000Z",
            until: "2026-08-02T00:00:00.000Z",
          },
          fingerprint: {
            genres: [
              { tag: "Souls-like", minutes: 300, share: 0.173, gameCount: 1 },
              { tag: "Stealth", minutes: 300, share: 0.173, gameCount: 1 },
            ],
            distributedMinutes: 1_740,
            gamesCounted: 3,
            gamesWithoutGenre: 0,
          },
        },
      }),
      isPending: false,
      isError: false,
    });
    renderSection();

    expect(screen.getByText("Not enough recent play to call a drift.")).toBeTruthy();
    expect(
      screen.getByText(
        "3 games and 29h in the last 80 days — every genre in that rests on a single title."
      )
    ).toBeTruthy();
  });

  it("calls out a drift when the recent anchor differs from the lifetime one", () => {
    mockHook({
      data: portrait({
        recent: {
          window: {
            days: 90,
            since: "2026-05-04T00:00:00.000Z",
            until: "2026-08-02T00:00:00.000Z",
          },
          fingerprint: {
            genres: [
              { tag: "Roguelike Deckbuilder", minutes: 1_200, share: 0.6, gameCount: 4 },
              { tag: "Souls-like", minutes: 800, share: 0.4, gameCount: 3 },
            ],
            distributedMinutes: 2_000,
            gamesCounted: 7,
            gamesWithoutGenre: 0,
          },
        },
      }),
      isPending: false,
      isError: false,
    });
    renderSection();

    expect(
      screen.getByText(
        "Lifetime Souls-like; lately Roguelike Deckbuilder and Souls-like."
      )
    ).toBeTruthy();
  });

  it("says the anchor held when lifetime and recent agree", () => {
    mockHook({
      data: portrait({
        recent: {
          window: {
            days: 90,
            since: "2026-05-04T00:00:00.000Z",
            until: "2026-08-02T00:00:00.000Z",
          },
          fingerprint: {
            genres: [{ tag: "Souls-like", minutes: 2_000, share: 1, gameCount: 5 }],
            distributedMinutes: 2_000,
            gamesCounted: 5,
            gamesWithoutGenre: 0,
          },
        },
      }),
      isPending: false,
      isError: false,
    });
    renderSection();
    expect(screen.getByText("Still Souls-like.")).toBeTruthy();
  });
});

describe("LibraryPostureCard", () => {
  it("reports the cohort against the shelf it came out of", () => {
    mockHook({ data: portrait(), isPending: false, isError: false });
    renderSection();

    expect(
      screen.getByText("55 of 186 owned games have had more than an hour.")
    ).toBeTruthy();
    expect(
      screen.getByText(
        "Those 55 hold 99.8% of your 2,385h. 120 have never been launched at all."
      )
    ).toBeTruthy();
  });

  it("links into the full library", () => {
    mockHook({ data: portrait(), isPending: false, isError: false });
    renderSection();
    expect(screen.getByText("See the full library →").getAttribute("to")).toBe(
      "/steam/library"
    );
  });

  it("falls back to a first-poll empty state when nothing is owned", () => {
    mockHook({
      data: portrait({
        posture: {
          ownedCount: 0,
          meaningfulCount: 0,
          tastedCount: 0,
          ghostCount: 0,
          totalMinutes: 0,
          meaningfulMinutes: 0,
        },
      }),
      isPending: false,
      isError: false,
    });
    renderSection();
    expect(screen.getByText(/Library hasn't synced yet/)).toBeTruthy();
  });
});
