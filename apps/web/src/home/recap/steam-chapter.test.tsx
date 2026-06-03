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
  steamLibraryHeroLargeUrl: (appid: number) => `https://test/hero-large/${appid}.webp`,
  steamLibraryLogoUrl: (appid: number) => `https://test/logo/${appid}.webp`,
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
    releaseDate: null,
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
  it("renders the masthead with the logo + tagline when a logo exists", () => {
    const { container } = render(<SteamChapter />);
    // Logo path: the official Steam logo replaces the typographic <h2>;
    // game name moves to the img's alt attribute as the accessible label.
    // Two img tags carry alt="Hollow Knight" (masthead + identity strip);
    // scope to the opener band for the masthead-specific assertion.
    const opener = container.querySelector("[data-band='opener']") as HTMLElement;
    const logo = opener.querySelector("img[alt='Hollow Knight']") as HTMLImageElement;
    expect(logo).toBeTruthy();
    expect(logo.src).toContain("/logo/367520");
    expect(screen.getByText(/Forge your own path in Hollow Knight!/)).toBeTruthy();
    // Typographic fallback should NOT render alongside the logo.
    expect(screen.queryByRole("heading", { level: 2 })).toBeNull();
  });

  it("falls back to the typographic masthead when the game has no logo", () => {
    vi.mocked(useSteamGameRecap).mockReturnValue({
      data: recapFromFixtures(makeOwnedGame({ logoPath: null })),
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useSteamGameRecap>);
    render(<SteamChapter />);
    expect(screen.getByRole("heading", { level: 2 }).textContent).toContain(
      "Hollow Knight"
    );
    expect(screen.queryByAltText("Hollow Knight")).toBeNull();
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

  it("renders the release-date chip when the recap carries one", () => {
    vi.mocked(useSteamGameRecap).mockReturnValue({
      data: recapFromFixtures(makeOwnedGame({ releaseDate: "2014-11-25" })),
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useSteamGameRecap>);
    render(<SteamChapter />);
    expect(screen.getByText("Released 2014")).toBeTruthy();
  });

  it("omits the release-date chip when the enrichment row has no date", () => {
    // Default fixture has releaseDate: null; assert the chip never renders
    // (matches against the shared helper's "Released" prefix so the bucket
    // eyebrow's "Currently in" doesn't false-positive).
    render(<SteamChapter />);
    expect(screen.queryByText(/^Released /)).toBeNull();
  });

  it("renders the standout unlock receipt when one exists", () => {
    const standout = makeAchievement({
      apiName: "RARE",
      displayName: "Hollow Knight",
      description: "Defeat the Hollow Knight without taking damage.",
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
    // Non-hidden achievements expose their description for editorial weight.
    expect(
      screen.getByText("Defeat the Hollow Knight without taking damage.")
    ).toBeTruthy();
  });

  it("masks the description for hidden achievements (visitor spoiler safety)", () => {
    const standout = makeAchievement({
      apiName: "STORY",
      displayName: "Pursuer",
      description: "Defeat the final boss in under 4 hours.",
      hidden: true,
      unlockedAt: "2026-05-25T00:00:00Z",
      globalPercent: 2.5,
    });
    vi.mocked(useSteamGameRecap).mockReturnValue({
      data: recapFromFixtures(makeOwnedGame(), [standout]),
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useSteamGameRecap>);
    render(<SteamChapter />);
    // Display name + meta still render (Steam's own client reveals these
    // post-unlock); only the description is held back. "Pursuer" appears
    // in both the standout block and the recent-unlocks strip — at least
    // one is enough.
    expect(screen.getAllByText("Pursuer").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("Defeat the final boss in under 4 hours.")).toBeNull();
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

  it("renders all screenshots in the strip (horizontal scroll handles overflow)", () => {
    const screenshots: SteamScreenshotEntry[] = Array.from({ length: 8 }, (_, i) => ({
      filename: `steam/apps/367520/ss_${i}.jpg`,
      ordinal: i,
    }));
    vi.mocked(useSteamGameRecap).mockReturnValue({
      data: recapFromFixtures(makeOwnedGame(), [], screenshots),
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useSteamGameRecap>);
    render(<SteamChapter />);
    // No cap — strip renders every screenshot; overflow-x-auto handles
    // visual containment within the multi-beat closer (beat 3). The strip
    // lives inside beat 3 which starts inactive (aria-hidden) in tests
    // since the default beat index is 0; `{ hidden: true }` opts the query
    // into hidden subtrees so we can assert DOM presence regardless of
    // active-beat state. The visual gating is covered by chapter-beats
    // tests; this assertion is about content count, not visibility.
    const triggers = screen.getAllByRole("button", {
      name: /Open screenshot/,
      hidden: true,
    });
    expect(triggers).toHaveLength(8);
  });

  it("masthead links to the game-detail page (title-as-link)", () => {
    const { container } = render(<SteamChapter />);
    // The masthead (logo img or h2 fallback) is wrapped in a Link in
    // the opener band. The accessible name comes from the logo's alt
    // attribute (or the h2 text), so the link is queryable by name.
    const opener = container.querySelector("[data-band='opener']");
    const link = opener?.querySelector("a");
    expect(link).toBeTruthy();
    expect(link?.getAttribute("to")).toBe("/steam/game/$appid");
    // Logo image lives inside the link in the default fixture (hasLogo).
    expect(link?.querySelector("img[alt='Hollow Knight']")).toBeTruthy();
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

  it("renders as a 4-beat stacked-section chapter (R-13 final architecture)", () => {
    const { container } = render(<SteamChapter />);
    const group = container.querySelector("[data-chapter-group]");
    expect(group).toBeTruthy();
    const beats = container.querySelectorAll("[data-beat]");
    expect(beats.length).toBe(4);
    // Each beat is its own scroll-snap section, not an absolutely-stacked
    // overlay inside a sticky pin.
    for (const beat of beats) {
      expect(beat.tagName).toBe("SECTION");
      expect(beat.className).toContain("scroll-snap-align:start");
      expect(beat.className).toContain("scroll-snap-stop:always");
    }
  });

  it("renders a single chapter-level identity mark (not per-beat)", () => {
    const { container } = render(<SteamChapter />);
    // The identity now lives sticky at the chapter group level, so there's
    // exactly one mark element regardless of beat count. Per-beat overlay
    // re-mounts are gone — the identity is the chapter's constant under
    // which beat content swaps.
    const marks = container.querySelectorAll("[data-chapter-identity-mark]");
    expect(marks.length).toBe(1);
    const logo = marks[0]?.querySelector("img");
    expect(logo).toBeTruthy();
    expect(logo?.getAttribute("alt")).toBe("Hollow Knight");
  });

  it("identity mark falls back to game name in tracking-wide caps when no logo", () => {
    vi.mocked(useSteamGameRecap).mockReturnValue({
      data: recapFromFixtures(makeOwnedGame({ logoPath: null })),
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useSteamGameRecap>);
    const { container } = render(<SteamChapter />);
    const marks = container.querySelectorAll("[data-chapter-identity-mark]");
    expect(marks.length).toBe(1);
    // No logo → text fallback (no img, just the game name).
    expect(marks[0]?.querySelector("img")).toBeNull();
    expect(marks[0]?.textContent).toContain("Hollow Knight");
  });

  it("partitions bands across beats — opener in beat 0, detail in beat 1, stats in beat 2, closer in beat 3", () => {
    // Default fixture has unlocks (standout + recent), screenshots, and
    // peak-chip data — so all four band types render and can be located.
    const standout = makeAchievement({
      apiName: "RARE",
      displayName: "Hollow Knight",
      description: "Defeat the Hollow Knight without taking damage.",
      unlockedAt: "2026-05-25T00:00:00Z",
      globalPercent: 1.8,
    });
    vi.mocked(useSteamGameRecap).mockReturnValue({
      data: recapFromFixtures(makeOwnedGame(), [standout]),
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useSteamGameRecap>);
    const { container } = render(<SteamChapter />);
    const beatOf = (selector: string): string | null =>
      container
        .querySelector(selector)
        ?.closest("[data-beat]")
        ?.getAttribute("data-beat") ?? null;
    expect(beatOf("[data-band='opener']")).toBe("0");
    expect(beatOf("[data-band='detail']")).toBe("1");
    expect(beatOf("[data-band='stats']")).toBe("2");
    expect(beatOf("[data-band='closer']")).toBe("3");
  });
});
