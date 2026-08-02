import { useSteamPlatformMix } from "@/steam/use-platform-mix";
import { render, screen } from "@testing-library/react";
import type {
  GenreFingerprint,
  SteamPlatformMix,
  SteamPortrait,
  SteamPortraitAnti,
} from "@vyoh/shared";
import { configureAxe } from "jest-axe";
import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PortraitSection } from "./portrait-section";
import { useSteamPortrait } from "./use-portrait";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: { children: ReactNode }) => <a {...props}>{children}</a>,
}));

vi.mock("./use-portrait", () => ({ useSteamPortrait: vi.fn() }));
vi.mock("@/steam/use-platform-mix", () => ({ useSteamPlatformMix: vi.fn() }));

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

// Measured 2026-08-02: eleven games the owner opened once, seven with a lone
// achievement against them, and a 2012 last-launch at the bottom of the shelf.
const ANTI: SteamPortraitAnti = {
  tasted: {
    count: 11,
    totalMinutes: 265,
    medianMinutes: 22,
    quickest: [
      { appid: 1113560, name: "NieR Replicant ver.1.22474487139...", minutes: 1 },
      { appid: 25720, name: "Blades of Time", minutes: 3 },
      { appid: 637650, name: "FINAL FANTASY XV WINDOWS EDITION", minutes: 5 },
      { appid: 8190, name: "Just Cause 2", minutes: 15 },
      { appid: 311340, name: "METAL GEAR SOLID V: GROUND ZEROES", minutes: 20 },
    ],
    fingerprint: {
      genres: [
        { tag: "Action", minutes: 44, share: 0.21, gameCount: 5 },
        { tag: "Action RPG", minutes: 20, share: 0.1, gameCount: 2 },
      ],
      distributedMinutes: 210,
      gamesCounted: 9,
      gamesWithoutGenre: 2,
    },
  },
  singleAchievement: {
    games: [
      { appid: 582010, name: "Monster Hunter: World", minutes: 1_240 },
      { appid: 379720, name: "DOOM", minutes: 410 },
    ],
    withAnyUnlock: 54,
    withSchema: 157,
  },
  coldest: {
    appid: 17410,
    name: "Mirror's Edge",
    minutes: 297,
    lastPlayed: "2012-07-18T00:00:00.000Z",
  },
};

function portrait(overrides: Partial<SteamPortrait> = {}): SteamPortrait {
  return {
    lifetime: LIFETIME,
    anti: ANTI,
    recent: null,
    posture: {
      ownedCount: 186,
      meaningfulCount: 55,
      tastedCount: 11,
      ghostCount: 120,
      totalMinutes: 143_100,
      meaningfulMinutes: 142_814,
    },
    completion: {
      cohortCount: 34,
      finishedCount: 18,
      perfectCount: 17,
      medianCompletion: 0.95,
    },
    lastSyncedAt: "2026-08-02T00:00:00.000Z",
    ...overrides,
  };
}

// The owner's live split: one platform, and a chunk of lifetime playtime that
// predates Steam reporting per-OS minutes at all.
const WINDOWS_ONLY: SteamPlatformMix = {
  totalMinutes: 113_184,
  windowsMinutes: 113_184,
  macMinutes: 0,
  linuxMinutes: 0,
  deckMinutes: 0,
  dominantPlatform: "windows",
  lastSyncedAt: "2026-08-02T00:00:00.000Z",
};

function mockPlatformMix(data: SteamPlatformMix | undefined = WINDOWS_ONLY): void {
  vi.mocked(useSteamPlatformMix).mockReturnValue({
    data,
    isPending: false,
    isError: data === undefined,
  } as unknown as ReturnType<typeof useSteamPlatformMix>);
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

beforeEach(() => {
  mockPlatformMix();
});

afterEach(() => {
  vi.mocked(useSteamPortrait).mockReset();
  vi.mocked(useSteamPlatformMix).mockReset();
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

describe("CompletionistCard", () => {
  it("states the selectiveness and the thoroughness in one claim", () => {
    mockHook({ data: portrait(), isPending: false, isError: false });
    renderSection();

    expect(
      screen.getByText("34 of 186 owned games reach 10 hours; 17 of those are at 100%.")
    ).toBeTruthy();
    expect(screen.getByText(/Median completion across the 34 is 95%/)).toBeTruthy();
    expect(screen.getByText(/18 past 80% · 17 at 100% · 95% median/)).toBeTruthy();
  });

  it("declines to score a library where nothing has passed the hour floor", () => {
    mockHook({
      data: portrait({
        completion: {
          cohortCount: 0,
          finishedCount: 0,
          perfectCount: 0,
          medianCompletion: 0,
        },
      }),
      isPending: false,
      isError: false,
    });
    renderSection();
    expect(
      screen.getByText("No game with achievements has passed 10 hours yet.")
    ).toBeTruthy();
  });
});

describe("PlatformIdentityCard", () => {
  it("reads a single-platform library as a statement rather than a share", () => {
    mockHook({ data: portrait(), isPending: false, isError: false });
    renderSection();

    expect(screen.getByText("Windows, exclusively.")).toBeTruthy();
    // Per-OS minutes sit below lifetime playtime on an old library, so the
    // card says which total its share is a share of.
    expect(
      screen.getByText(
        /All 1,886h of tracked per-OS playtime, on one machine\. Steam attributes 79% of your lifetime playtime to a platform at all\./
      )
    ).toBeTruthy();
  });

  it("names the other platforms when there are any", () => {
    mockPlatformMix({
      ...WINDOWS_ONLY,
      totalMinutes: 100,
      windowsMinutes: 83,
      deckMinutes: 17,
    });
    mockHook({ data: portrait(), isPending: false, isError: false });
    renderSection();

    expect(screen.getByText("Windows carries 83% of tracked playtime.")).toBeTruthy();
    expect(screen.getByText(/Also tracked: Steam Deck 17%\./)).toBeTruthy();
  });

  it("omits the coverage note when per-OS minutes account for nearly everything", () => {
    mockPlatformMix({ ...WINDOWS_ONLY, totalMinutes: 143_000, windowsMinutes: 143_000 });
    mockHook({ data: portrait(), isPending: false, isError: false });
    renderSection();

    expect(screen.queryByText(/Steam attributes/)).toBeNull();
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
