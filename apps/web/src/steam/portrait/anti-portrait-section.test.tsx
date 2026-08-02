import { render, screen } from "@testing-library/react";
import type { GenreFingerprint, SteamPortrait, SteamPortraitAnti } from "@vyoh/shared";
import { configureAxe } from "jest-axe";
import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AntiPortraitSection } from "./anti-portrait-section";
import { useSteamPortrait } from "./use-portrait";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: { children: ReactNode }) => <a {...props}>{children}</a>,
}));

vi.mock("./use-portrait", () => ({ useSteamPortrait: vi.fn() }));

const axe = configureAxe({ rules: { "color-contrast": { enabled: false } } });

// The owner's live shape as of 2026-08-02: eleven games opened and dropped,
// and two JRPGs neither of which survived the hour.
const LIFETIME: GenreFingerprint = {
  genres: [
    { tag: "Souls-like", minutes: 42_180, share: 0.298, gameCount: 15 },
    { tag: "Action RPG", minutes: 32_220, share: 0.228, gameCount: 13 },
    { tag: "FPS", minutes: 7_500, share: 0.053, gameCount: 10 },
  ],
  distributedMinutes: 141_360,
  gamesCounted: 54,
  gamesWithoutGenre: 1,
};

const ANTI: SteamPortraitAnti = {
  tasted: {
    count: 11,
    totalMinutes: 265,
    medianMinutes: 22,
    quickest: [
      { appid: 1113560, name: "NieR Replicant", minutes: 1 },
      { appid: 25720, name: "Blades of Time", minutes: 3 },
      { appid: 637650, name: "FINAL FANTASY XV", minutes: 5 },
    ],
    fingerprint: {
      genres: [
        { tag: "FPS", minutes: 40, share: 0.2, gameCount: 3 },
        { tag: "Action RPG", minutes: 35, share: 0.17, gameCount: 3 },
        { tag: "JRPG", minutes: 6, share: 0.03, gameCount: 2 },
      ],
      distributedMinutes: 200,
      gamesCounted: 9,
      gamesWithoutGenre: 2,
    },
  },
  singleAchievement: { games: [], withAnyUnlock: 50, withSchema: 152 },
  coldest: null,
};

function portrait(anti: SteamPortraitAnti = ANTI): SteamPortrait {
  return {
    lifetime: LIFETIME,
    anti,
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
      <AntiPortraitSection />
    </MotionConfig>
  );
}

function ready(anti?: SteamPortraitAnti) {
  mockHook({ data: portrait(anti), isPending: false, isError: false });
  return renderSection();
}

afterEach(() => {
  vi.mocked(useSteamPortrait).mockReset();
});

describe("AntiPortraitSection", () => {
  it("names itself as the half Steam withholds", () => {
    ready();
    expect(screen.getByRole("heading", { name: "Anti-Portrait" })).toBeTruthy();
    expect(screen.getByText("The half Steam doesn't show you")).toBeTruthy();
  });

  it("has no axe violations", async () => {
    const { container } = ready();
    expect((await axe(container)).violations).toEqual([]);
  });

  it("renders a loading verdict for every card while the query is pending", () => {
    mockHook({ data: undefined, isPending: true, isError: false });
    renderSection();
    expect(screen.getByText("Counting the half-tries…")).toBeTruthy();
    expect(screen.getByText("Finding the shortest sittings…")).toBeTruthy();
    expect(screen.getByText("Reading what didn't stick…")).toBeTruthy();
  });

  it("renders an unavailable verdict for every card on error", () => {
    mockHook({ data: undefined, isPending: false, isError: true });
    renderSection();
    expect(screen.getByText("The tasted tier is unavailable right now.")).toBeTruthy();
    expect(
      screen.getByText("The shortest sittings are unavailable right now.")
    ).toBeTruthy();
    expect(screen.getByText("The bounce rates are unavailable right now.")).toBeTruthy();
  });
});

describe("TastedTierCard", () => {
  it("states the count, the absurd total and the median sitting", () => {
    ready();
    expect(
      screen.getByText("11 games opened and given up on, for 4h 25m between them.")
    ).toBeTruthy();
    expect(
      screen.getByText(
        "The median one lasted 22 minutes. 120 more were never opened at all."
      )
    ).toBeTruthy();
  });

  it("says nothing was abandoned rather than rendering a zero", () => {
    ready({ ...ANTI, tasted: { ...ANTI.tasted, count: 0 } });
    expect(
      screen.getByText(
        "Nothing was opened and abandoned — every launched game got an hour."
      )
    ).toBeTruthy();
  });
});

describe("QuickestAbandonsCard", () => {
  it("leads with the shortest sitting and lists the rest", () => {
    ready();
    expect(screen.getByText("NieR Replicant lasted 1 minute.")).toBeTruthy();
    expect(screen.getByText("Blades of Time").getAttribute("to")).toBe(
      "/steam/library/$appid"
    );
    // The leader is the verdict, so it must not also appear in the list below.
    expect(screen.queryByText("NieR Replicant", { selector: "a" })).toBeNull();
  });

  it("discloses that a launch is not the same as playing", () => {
    ready();
    expect(
      screen.getByText(
        "Steam counts a launch the moment the window opens, so some of these are a menu and a change of mind."
      )
    ).toBeTruthy();
  });

  it("falls back to an empty verdict when nothing was abandoned", () => {
    ready({ ...ANTI, tasted: { ...ANTI.tasted, quickest: [] } });
    expect(
      screen.getByText("No game was opened and dropped inside the hour.")
    ).toBeTruthy();
  });
});

describe("BounceGenresCard", () => {
  it("leads with the worst rate rather than the biggest count", () => {
    ready();
    // FPS carries more abandons (3) but 3 of 13 is not a wall; 2 of 2 is.
    expect(
      screen.getByText("You've opened 2 JRPG games and given up on both.")
    ).toBeTruthy();
    expect(screen.getByText("2/2")).toBeTruthy();
    expect(screen.getByText("3/16")).toBeTruthy();
  });

  it("counts the population behind the rates rather than showing one of them", () => {
    ready();
    // The indicator is a count in every sibling card; a leading rate of 100%
    // in that slot reads as a total rather than as one genre's share.
    expect(screen.getByText("9 games")).toBeTruthy();
  });

  it("says so when no genre has enough games to carry a rate", () => {
    ready({
      ...ANTI,
      tasted: {
        ...ANTI.tasted,
        fingerprint: {
          genres: [{ tag: "Roguelite", minutes: 10, share: 1, gameCount: 1 }],
          distributedMinutes: 10,
          gamesCounted: 1,
          gamesWithoutGenre: 0,
        },
      },
    });
    expect(
      screen.getByText(
        "Nothing abandoned carries a genre the rest of the library shares."
      )
    ).toBeTruthy();
  });
});
