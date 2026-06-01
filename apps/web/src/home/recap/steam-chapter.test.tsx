import { render, screen } from "@testing-library/react";
import type {
  SteamAchievement,
  SteamGameAchievements,
  SteamGameRecap,
  SteamOwnedGame,
  SteamScreenshotEntry,
} from "@vyoh/shared";
import { deriveSteamGameRecap } from "@vyoh/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/steam/use-steam-game-recap", () => ({
  useSteamGameRecap: vi.fn(),
}));
vi.mock("@/steam/_shared/steam-image", () => ({
  steamAchievementIconUrl: (appid: number, apiName: string) =>
    `https://test/ach/${appid}/${apiName}.jpg`,
  steamLibraryHeroUrl: (appid: number) => `https://test/hero/${appid}.webp`,
  steamPageBackgroundUrl: (appid: number) => `https://test/bg/${appid}.webp`,
}));
vi.mock("@/home/recap/use-asset-claim", () => ({
  useAssetClaim: vi.fn(),
}));
// ChapterReveal uses motion's whileInView in production (IntersectionObserver);
// the mock renders children plainly so band content is in the DOM and assertable.
vi.mock("@/home/recap/chapter-reveal", async () => {
  const React = await vi.importActual<typeof import("react")>("react");
  return {
    ChapterReveal: ({
      children,
      className,
    }: {
      children: React.ReactNode;
      className?: string;
    }) => React.createElement("div", { className }, children),
  };
});
vi.mock("@/home/landing-config", () => ({
  STEAM_FEATURED_APPID: 367520,
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
    <a {...props}>{children}</a>
  ),
}));
vi.mock("motion/react", async () => {
  const actual = await vi.importActual<typeof import("motion/react")>("motion/react");
  return {
    ...actual,
    useReducedMotion: vi.fn(() => false),
  };
});

import { useSteamGameRecap } from "@/steam/use-steam-game-recap";
import { SteamChapter } from "./steam-chapter";

const NOW = new Date("2026-06-01T12:00:00Z");

function makeOwnedGame(overrides: Partial<SteamOwnedGame> = {}): SteamOwnedGame {
  return {
    appid: 367520,
    name: "Hollow Knight",
    playtimeForeverMinutes: 2800,
    playtime2WeeksMinutes: 360,
    assetUrlFormat: "https://example.test/${FILENAME}",
    assetTimestamp: 12345,
    libraryCapsulePath: "lib_cap.jpg",
    libraryCapsule2xPath: "lib_cap_2x.jpg",
    libraryHeroPath: "lib_hero.jpg",
    libraryHero2xPath: "lib_hero_2x.jpg",
    headerPath: "header.jpg",
    heroCapsulePath: "hero_cap.jpg",
    logoPath: "logo.png",
    appType: 0,
    tagIds: [],
    rtimeLastPlayedAt: "2026-05-30T20:00:00Z",
    shortDescription: "Forge your own path in Hollow Knight! An epic action-adventure.",
    steamDeckCompat: 3,
    platformWindows: true,
    platformMac: true,
    platformLinux: true,
    platformVr: false,
    reviewSummary: null,
    gameRating: null,
    publisherNames: ["Team Cherry"],
    developerNames: ["Team Cherry"],
    franchiseNames: [],
    subjectXPercent: 50,
    subjectYPercent: 50,
    flipHero: false,
    dominantHex: "#1a1a2e",
    microtrailerWebm: null,
    microtrailerMp4: null,
    microtrailerPoster: null,
    microtrailerName: null,
    trailers: null,
    recentPlaytimeMinutes: [],
    ...overrides,
  };
}

function makeAchievement(overrides: Partial<SteamAchievement>): SteamAchievement {
  return {
    apiName: overrides.apiName ?? "ACH_DEFAULT",
    displayName: overrides.displayName ?? "Default Achievement",
    description: overrides.description ?? "",
    hidden: overrides.hidden ?? false,
    unlockedAt: overrides.unlockedAt ?? null,
    globalPercent: overrides.globalPercent ?? null,
  };
}

function makeAchievements(achievements: SteamAchievement[]): SteamGameAchievements {
  return {
    appid: 367520,
    achievements,
    lastSchemaCheckedAt: "2026-05-31T00:00:00Z",
    lastUnlocksCheckedAt: "2026-05-31T00:00:00Z",
    lastRarityCheckedAt: "2026-05-31T00:00:00Z",
  };
}

const SCREENSHOTS: SteamScreenshotEntry[] = [
  { filename: "steam/apps/367520/ss_a.jpg", ordinal: 0 },
  { filename: "steam/apps/367520/ss_b.jpg", ordinal: 1 },
];

/**
 * Tests author fixtures via the real shared deriver — same as
 * ahri-chapter.test.tsx — so changes to the deriver flow through to chapter
 * behavior under test instead of being silently masked by a hand-rolled
 * recap shape.
 */
function recapFromFixtures(
  ownedGame: SteamOwnedGame | null,
  achievements: SteamAchievement[] = [],
  screenshots: SteamScreenshotEntry[] = SCREENSHOTS,
  now: Date = NOW
): SteamGameRecap {
  return deriveSteamGameRecap(
    367520,
    ownedGame,
    makeAchievements(achievements),
    screenshots,
    now
  );
}

beforeEach(() => {
  // Default success state — individual tests override as needed.
  vi.mocked(useSteamGameRecap).mockReturnValue({
    data: recapFromFixtures(makeOwnedGame()),
    isPending: false,
    isError: false,
  } as unknown as ReturnType<typeof useSteamGameRecap>);
  // Date math in formatRelative / contextClause relies on Date.now(), so
  // pin the clock for deterministic relative-time labels.
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("SteamChapter", () => {
  it("renders the masthead with the game name and tagline", () => {
    render(<SteamChapter />);
    expect(screen.getByRole("heading", { level: 2 }).textContent).toContain(
      "Hollow Knight"
    );
    expect(screen.getByText(/Forge your own path in Hollow Knight!/)).toBeTruthy();
  });

  it("renders the bucket-aware eyebrow kicker", () => {
    // Default fixture has lastPlayedAt 2d ago — bucket is 'current'.
    render(<SteamChapter />);
    expect(screen.getByText("Playing lately")).toBeTruthy();
  });

  it("flips the eyebrow when the game is in the 'year' bucket", () => {
    vi.mocked(useSteamGameRecap).mockReturnValue({
      data: recapFromFixtures(
        makeOwnedGame({ rtimeLastPlayedAt: "2025-01-01T00:00:00Z" })
      ),
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useSteamGameRecap>);
    render(<SteamChapter />);
    expect(screen.getByText("Earlier this year")).toBeTruthy();
  });

  it("renders the standout unlock receipt when one exists", () => {
    const standout = makeAchievement({
      apiName: "RARE",
      displayName: "Hollow Knight",
      unlockedAt: "2026-05-25T00:00:00Z",
      globalPercent: 1.8,
    });
    vi.mocked(useSteamGameRecap).mockReturnValue({
      data: recapFromFixtures(makeOwnedGame(), [standout]),
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useSteamGameRecap>);
    render(<SteamChapter />);
    expect(screen.getByText("Rarest milestone")).toBeTruthy();
    expect(screen.getByText("1.8% have it")).toBeTruthy();
  });

  it("renders recent unlocks as a strip below the standout", () => {
    const achievements = Array.from({ length: 3 }, (_, i) =>
      makeAchievement({
        apiName: `A_${i}`,
        displayName: `Achievement ${i}`,
        unlockedAt: `2026-05-${String(20 + i).padStart(2, "0")}T00:00:00Z`,
        globalPercent: 50 - i * 10,
      })
    );
    vi.mocked(useSteamGameRecap).mockReturnValue({
      data: recapFromFixtures(makeOwnedGame(), achievements),
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useSteamGameRecap>);
    render(<SteamChapter />);
    expect(screen.getByText("Recent unlocks")).toBeTruthy();
    // Achievement 2 has the rarest globalPercent so it ALSO becomes the
    // standout — that's by design; use getAllByText for the duplicate.
    expect(screen.getByText("Achievement 0")).toBeTruthy();
    expect(screen.getByText("Achievement 1")).toBeTruthy();
    expect(screen.getAllByText("Achievement 2").length).toBeGreaterThanOrEqual(1);
  });

  it("renders the three peak chips", () => {
    render(<SteamChapter />);
    expect(screen.getByText("Completion")).toBeTruthy();
    expect(screen.getByText("Two weeks")).toBeTruthy();
    expect(screen.getByText(/Unlocks|Rarest unlock/)).toBeTruthy();
  });

  it("renders a screenshot strip with up to 4 thumbnails", () => {
    const screenshots: SteamScreenshotEntry[] = Array.from({ length: 6 }, (_, i) => ({
      filename: `steam/apps/367520/ss_${i}.jpg`,
      ordinal: i,
    }));
    vi.mocked(useSteamGameRecap).mockReturnValue({
      data: recapFromFixtures(makeOwnedGame(), [], screenshots),
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useSteamGameRecap>);
    const { container } = render(<SteamChapter />);
    const links = container.querySelectorAll('a[href*="ss_"]');
    expect(links).toHaveLength(4);
  });

  it("renders a CTA linking to the game-detail page", () => {
    render(<SteamChapter />);
    const cta = screen.getByText(/View Hollow Knight/);
    expect(cta).toBeTruthy();
  });

  it("renders verdict prose under the masthead", () => {
    render(<SteamChapter />);
    // Both 'Engrossed' and 'Currently in' are valid depending on fixture
    // shape; the default fixture has 360min/2weeks → 'Currently in'.
    expect(screen.getByText(/Currently in/)).toBeTruthy();
  });

  it("hides the standout block when there are no unlocks", () => {
    render(<SteamChapter />);
    expect(screen.queryByText("Rarest milestone")).toBeNull();
    expect(screen.queryByText("Latest milestone")).toBeNull();
  });
});
