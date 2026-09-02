import { render, screen } from "@testing-library/react";
import { configureAxe } from "jest-axe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
    <a {...props}>{children}</a>
  ),
}));
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
vi.mock("motion/react", async () => {
  const actual = await vi.importActual<typeof import("motion/react")>("motion/react");
  return { ...actual, useReducedMotion: vi.fn(() => false) };
});
vi.mock("@/steam/_shared/steam-image", () => ({
  steamLibraryLogoUrl: (appid: number) => `https://test/logo/${appid}`,
}));
vi.mock("@/steam/use-steam-game-recap", () => ({
  useSteamGameRecap: vi.fn(),
}));

import { useSteamGameRecap } from "@/steam/use-steam-game-recap";
import { SteamMomentBeat } from "./steam-moment-beat";

function mockRecap(
  overrides: Partial<{
    shortDescription: string;
    dominantHex: string;
    subjectXPercent: number;
    subjectYPercent: number;
    hasLogo: boolean;
    assetTimestamp: number;
  }> = {}
) {
  vi.mocked(useSteamGameRecap).mockReturnValue({
    data: {
      shortDescription: null,
      dominantHex: null,
      subjectXPercent: null,
      subjectYPercent: null,
      hasLogo: false,
      assetTimestamp: null,
      ...overrides,
    },
  } as ReturnType<typeof useSteamGameRecap>);
}

const baseProps = {
  appid: 2050650,
  name: "Resident Evil 4",
  daysSince: 3,
  slug: "steam-moment-first-2050650",
  momentType: "FIRST_TIME_GAME" as const,
  firstTime: {
    windowPlayMinutes: 150,
    sessionCount: 3,
    firstSessionMinutes: 60,
    addedAt: "2026-05-27T18:00:00.000Z",
    firstPlayedAt: "2026-05-30T20:00:00.000Z",
  },
  cluster: null,
  launchDrift: null,
  nudged: true,
};

beforeEach(() => {
  mockRecap();
});

afterEach(() => {
  vi.mocked(useSteamGameRecap).mockReset();
});

describe("SteamMomentBeat (FIRST_TIME_GAME)", () => {
  it("renders the first-time eyebrow and game-name masthead", () => {
    render(<SteamMomentBeat {...baseProps} />);
    expect(screen.getByText("First time on")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Resident Evil 4");
  });

  it("derives a human-readable when-line from daysSince", () => {
    render(<SteamMomentBeat {...baseProps} daysSince={5} />);
    expect(screen.getByText("5 days ago")).toBeTruthy();
  });

  it("links the masthead to the Steam game-detail route", () => {
    const { container } = render(<SteamMomentBeat {...baseProps} />);
    const link = container.querySelector('a[to="/steam/library/$appid"]');
    expect(link).toBeTruthy();
  });

  it("renders the session-shape receipt (total + count + avg) when firstTime is provided", () => {
    render(<SteamMomentBeat {...baseProps} />);
    // baseProps: 150 min across 3 sessions → "3h · 3 sessions · avg 1h"
    // (formatPlaytime rounds 50min → "50m"). Assert the loadbearing labels
    // without coupling tightly to playtime formatter tuning.
    expect(screen.getByText(/3 sessions/i)).toBeTruthy();
    expect(screen.getByText(/^avg /i)).toBeTruthy();
  });

  it("renders the 'first sit-down' beat in the receipt when sessionCount > 1", () => {
    render(<SteamMomentBeat {...baseProps} />);
    // baseProps: firstSessionMinutes: 60 → "first sit-down 1h"
    expect(screen.getByText(/first sit-down/i)).toBeTruthy();
  });

  it("omits the 'first sit-down' beat when sessionCount is exactly one (collapses to total)", () => {
    render(
      <SteamMomentBeat
        {...baseProps}
        firstTime={{
          windowPlayMinutes: 120,
          sessionCount: 1,
          firstSessionMinutes: 120,
          addedAt: "2026-05-30T18:00:00.000Z",
          firstPlayedAt: "2026-05-30T19:00:00.000Z",
        }}
      />
    );
    expect(screen.queryByText(/first sit-down/i)).toBeNull();
  });

  it("prose branches on the added-vs-played gap: same-day reads as 'dove right in'", () => {
    render(
      <SteamMomentBeat
        {...baseProps}
        firstTime={{
          windowPlayMinutes: 150,
          sessionCount: 2,
          firstSessionMinutes: 90,
          addedAt: "2026-05-30T10:00:00.000Z",
          firstPlayedAt: "2026-05-30T19:00:00.000Z",
        }}
      />
    );
    expect(screen.getByText(/dove right in/i)).toBeTruthy();
  });

  it("prose branches on a 1–13 day gap: pairs added + first-launched dates", () => {
    render(
      <SteamMomentBeat
        {...baseProps}
        firstTime={{
          windowPlayMinutes: 150,
          sessionCount: 2,
          firstSessionMinutes: 60,
          addedAt: "2026-05-27T18:00:00.000Z",
          firstPlayedAt: "2026-05-30T20:00:00.000Z",
        }}
      />
    );
    expect(screen.getByText(/^Added/)).toBeTruthy();
    expect(screen.getByText(/first launched/i)).toBeTruthy();
  });

  it("prose branches on a 14+ day backlog gap: reads as 'sat in the library'", () => {
    render(
      <SteamMomentBeat
        {...baseProps}
        firstTime={{
          windowPlayMinutes: 200,
          sessionCount: 3,
          firstSessionMinutes: 60,
          addedAt: "2026-04-10T18:00:00.000Z",
          firstPlayedAt: "2026-05-30T20:00:00.000Z",
        }}
      />
    );
    expect(screen.getByText(/sat in the library/i)).toBeTruthy();
  });

  it("renders the singular '1 session' label and omits the avg when sessionCount is exactly one", () => {
    render(
      <SteamMomentBeat
        {...baseProps}
        firstTime={{
          windowPlayMinutes: 120,
          sessionCount: 1,
          firstSessionMinutes: 120,
          addedAt: "2026-05-30T18:00:00.000Z",
          firstPlayedAt: "2026-05-30T19:00:00.000Z",
        }}
      />
    );
    expect(screen.getByText("1 session")).toBeTruthy();
    // Avg is editorial duplication of the total when sessionCount=1, so we
    // suppress it.
    expect(screen.queryByText(/^avg /i)).toBeNull();
  });

  it("omits the playtime receipt entirely when firstTime is null (defensive — descriptor invariant)", () => {
    render(<SteamMomentBeat {...baseProps} firstTime={null} />);
    expect(screen.queryByText(/session/i)).toBeNull();
  });

  it("renders the tagline under the masthead when the recap query returns a shortDescription", () => {
    mockRecap({
      shortDescription:
        "A reimagining of the survival horror classic.\r\n\r\nLeon S. Kennedy, six years after Raccoon City…",
    });
    render(<SteamMomentBeat {...baseProps} />);
    // Only the first sentence is used; subsequent paragraphs / sentences
    // are dropped so the masthead doesn't drown under marketing copy.
    expect(
      screen.getByText("A reimagining of the survival horror classic.")
    ).toBeTruthy();
    expect(screen.queryByText(/Leon S\. Kennedy/)).toBeNull();
  });

  it("omits the tagline block when the recap query has no shortDescription", () => {
    // `mockRecap()` with no overrides leaves shortDescription as null —
    // mirrors the "recap loaded but the game has no marketing blurb"
    // case (rare but real for very old or unfinished titles).
    mockRecap();
    const { container } = render(<SteamMomentBeat {...baseProps} />);
    // Tagline is the only italic body under the masthead; assert it's gone
    // by looking for the prose-body class signature.
    const italicBodies = container.querySelectorAll("p.italic");
    expect(italicBodies.length).toBe(0);
  });

  // Atmosphere claim (dominantHex, subject anchor, hero image), critical
  // hero preload, and chapter-level data attributes moved to the Steam
  // moments aggregator (R-12.6). Steam moments aggregator uses palette-
  // only atmosphere — no per-game hero — so the per-beat atmosphere
  // wiring this section used to test is no longer applicable.
});

describe("SteamMomentBeat (ACHIEVEMENT_CLUSTER)", () => {
  const clusterProps = {
    ...baseProps,
    slug: "steam-moment-cluster-2050650",
    momentType: "ACHIEVEMENT_CLUSTER" as const,
    firstTime: null,
    cluster: {
      unlockCount: 6,
      spanHours: 3.5,
      capUnlockedAt: "2026-05-30T20:00:00.000Z",
      unlockNames: ["Survivor", "Hunter", "Marksman", "Tactician", "Veteran"],
    },
  };

  it("renders the cluster eyebrow + masthead", () => {
    render(<SteamMomentBeat {...clusterProps} />);
    expect(screen.getByText("Recent run on")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Resident Evil 4");
  });

  it("renders the cluster receipt with count + span + unlock names list", () => {
    render(<SteamMomentBeat {...clusterProps} />);
    // 6 unlocks → "6 unlocks", spanHours 3.5 → "across 3.5h"
    expect(screen.getByText(/6 unlocks/i)).toBeTruthy();
    expect(screen.getByText(/across 3\.5h/i)).toBeTruthy();
    // Unlock names list joins with separators; one of the names should render.
    expect(screen.getByText(/Survivor/)).toBeTruthy();
    expect(screen.getByText(/Marksman/)).toBeTruthy();
  });

  it("renders 'and N more' when the cluster has more unlocks than names carried on the descriptor", () => {
    render(
      <SteamMomentBeat
        {...clusterProps}
        cluster={{
          ...clusterProps.cluster,
          unlockCount: 12,
        }}
      />
    );
    // 12 unlocks − 5 names = 7 more
    expect(screen.getByText(/and 7 more/i)).toBeTruthy();
  });

  it("prose branches on span: ≤2h reads as 'back-to-back'", () => {
    render(
      <SteamMomentBeat
        {...clusterProps}
        cluster={{ ...clusterProps.cluster, spanHours: 1.5 }}
      />
    );
    expect(screen.getByText(/back-to-back/i)).toBeTruthy();
  });

  it("prose branches on span: 2–8h reads as 'made an afternoon of it'", () => {
    render(
      <SteamMomentBeat
        {...clusterProps}
        cluster={{ ...clusterProps.cluster, spanHours: 5.0 }}
      />
    );
    expect(screen.getByText(/made an afternoon of it/i)).toBeTruthy();
  });

  it("prose branches on span: >8h reads as 'binged it across the day'", () => {
    render(
      <SteamMomentBeat
        {...clusterProps}
        cluster={{ ...clusterProps.cluster, spanHours: 18.0 }}
      />
    );
    expect(screen.getByText(/binged it across the day/i)).toBeTruthy();
  });

  it("falls back to the cluster-shaped eyebrow even when cluster stats are null (defensive)", () => {
    render(<SteamMomentBeat {...clusterProps} cluster={null} />);
    expect(screen.getByText("Recent run on")).toBeTruthy();
    // Receipt block is gone; prose body renders the bare fallback.
    expect(screen.queryByText(/unlocks/i)).toBeNull();
  });
});

describe("SteamMomentBeat masthead logo", () => {
  // Steam game logo image is used as the masthead when the recap query
  // says `hasLogo: true` — same pattern as the heavy `SteamChapter`.
  // Falls back to the typographic H2 with the descriptor's name when no
  // logo is available.
  it("renders the publisher logo <img> as the masthead when recap.hasLogo is true", () => {
    mockRecap({ hasLogo: true, assetTimestamp: 99 });
    const { container } = render(<SteamMomentBeat {...baseProps} />);
    const logo = container.querySelector(
      'img[src="https://test/logo/2050650"]'
    ) as HTMLImageElement | null;
    expect(logo).toBeTruthy();
    // The logo carries the accessible label so SR users still hear the
    // game name (the eyebrow already states the moment type).
    expect(logo?.alt).toBe("Resident Evil 4");
    // No typographic masthead alongside.
    expect(screen.queryByRole("heading", { level: 2 })).toBeNull();
  });

  it("falls back to the typographic H2 masthead when recap.hasLogo is false", () => {
    mockRecap({ hasLogo: false });
    render(<SteamMomentBeat {...baseProps} />);
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Resident Evil 4");
  });

  it("falls back to the typographic H2 masthead when the recap query hasn't resolved yet", () => {
    // `useSteamGameRecap` is mocked to default-undefined data via mockRecap()
    // with no hasLogo override → hasLogo: false. Confirm the masthead is
    // still typographic so the chapter renders before recap loads.
    mockRecap();
    render(<SteamMomentBeat {...baseProps} />);
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Resident Evil 4");
  });
});

describe("SteamMomentBeat per-type leadingVisual (R-7h.2)", () => {
  it("renders a Sparkles lucide icon as the leadingVisual on FIRST_TIME_GAME", () => {
    const { container } = render(<SteamMomentBeat {...baseProps} />);
    expect(container.querySelector(".lucide-sparkles")).toBeTruthy();
  });

  it("renders an Award lucide icon as the leadingVisual on ACHIEVEMENT_CLUSTER", () => {
    const clusterProps = {
      ...baseProps,
      slug: "steam-moment-cluster-2050650",
      momentType: "ACHIEVEMENT_CLUSTER" as const,
      firstTime: null,
      cluster: {
        unlockCount: 6,
        spanHours: 3.5,
        capUnlockedAt: "2026-05-30T20:00:00.000Z",
        unlockNames: ["Survivor", "Hunter"],
      },
    };
    const { container } = render(<SteamMomentBeat {...clusterProps} />);
    expect(container.querySelector(".lucide-award")).toBeTruthy();
  });
});

// color-contrast needs real computed styles; aria-hidden-focus is a Radix
// false positive under happy-dom. Same configuration as accessibility.test.tsx.
const axe = configureAxe({
  rules: {
    "color-contrast": { enabled: false },
    "aria-hidden-focus": { enabled: false },
  },
});

describe("SteamMomentBeat (LAUNCH_RARITY_DRIFT)", () => {
  const headline = {
    apiName: "corvus_end",
    displayName: "Corvus's End",
    unlockedAt: "2026-08-05T21:14:00.000Z",
    percentAtUnlock: 0.7,
    percentNow: 28.4,
  };
  const driftProps = {
    ...baseProps,
    appid: 2001760,
    name: "Beast of Reincarnation",
    slug: "steam-moment-launch-drift-2001760",
    momentType: "LAUNCH_RARITY_DRIFT" as const,
    firstTime: null,
    cluster: null,
    launchDrift: {
      releaseDate: "2026-08-03",
      observedFrom: "2026-08-04T05:30:00.000Z",
      observedTo: "2026-08-31T05:30:00.000Z",
      observationCount: 12,
      bracketedUnlockCount: 7,
      headline,
      curve: [0.7, 2.1, 6.2, 9.8, 13.4, 16.1, 18.9, 21.7, 24.0, 25.8, 27.2, 28.4],
      receipt: [
        headline,
        {
          apiName: "bestie",
          displayName: "Bestie",
          unlockedAt: "2026-08-05T22:02:00.000Z",
          percentAtUnlock: 1.4,
          percentNow: 34.3,
        },
        {
          apiName: "munitions_master",
          displayName: "Munitions Master",
          unlockedAt: "2026-08-16T18:25:00.000Z",
          percentAtUnlock: 3.4,
          percentNow: 5.7,
        },
      ],
    },
  };

  it("renders the drift eyebrow + masthead", () => {
    render(<SteamMomentBeat {...driftProps} />);
    expect(screen.getByText("Early on")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(
      "Beast of Reincarnation"
    );
  });

  it("states the headline's rarity when earned against today's", () => {
    const { container } = render(<SteamMomentBeat {...driftProps} />);
    // formatRarityPercentEditorial keeps the decimal below 10% and rounds
    // above it, so 28.4 renders as "28%".
    expect(container.textContent).toContain("when you earned it");
    expect(container.textContent).toContain("0.7%");
    expect(container.textContent).toContain("28%");
  });

  it("renders a sub-resolution origin as <0.1% rather than 0.0%", () => {
    const props = {
      ...driftProps,
      launchDrift: {
        ...driftProps.launchDrift,
        headline: { ...headline, percentAtUnlock: 0 },
        receipt: [
          { ...headline, percentAtUnlock: 0 },
          ...driftProps.launchDrift.receipt.slice(1),
        ],
      },
    };
    const { container } = render(<SteamMomentBeat {...props} />);
    // Assert on the receipt's endpoint row specifically — the prose body
    // states the same value, so a container-wide check would stay green if
    // only the row lost the formatter.
    const endpoints = container.querySelector("span.text-2xl.tabular-nums");
    expect(endpoints?.textContent).toContain("<0.1%");
    expect(container.textContent).not.toContain("0.0%");
  });

  it("lists every receipt row in the proof line", () => {
    const { container } = render(<SteamMomentBeat {...driftProps} />);
    const proof = container.querySelector("p.italic");
    expect(proof?.textContent).toContain("Corvus's End");
    expect(proof?.textContent).toContain("Bestie");
    expect(proof?.textContent).toContain("Munitions Master");
    expect(proof?.textContent).toContain("·");
  });

  it("reports the readings and the span they cover", () => {
    const { container } = render(<SteamMomentBeat {...driftProps} />);
    expect(container.textContent).toContain("12 readings over 27 days");
  });

  it("appends the earned-early remainder only when the receipt is truncated", () => {
    const truncated = render(<SteamMomentBeat {...driftProps} />);
    expect(truncated.container.textContent).toContain("and 4 more earned early");
    truncated.unmount();

    const whole = render(
      <SteamMomentBeat
        {...driftProps}
        launchDrift={{ ...driftProps.launchDrift, bracketedUnlockCount: 3 }}
      />
    );
    expect(whole.container.textContent).not.toContain("more earned early");
  });

  it("labels the curve for screen readers", () => {
    const { container } = render(<SteamMomentBeat {...driftProps} />);
    const curve = container.querySelector('svg[data-slot="sparkline"]');
    expect(curve?.getAttribute("role")).toBe("img");
    expect(curve?.getAttribute("aria-label")).toContain("Corvus's End");
  });

  it("renders a TrendingUp lucide icon as the leadingVisual", () => {
    const { container } = render(<SteamMomentBeat {...driftProps} />);
    expect(container.querySelector(".lucide-trending-up")).toBeTruthy();
  });

  it("links the masthead to the game route", () => {
    const { container } = render(<SteamMomentBeat {...driftProps} />);
    expect(container.querySelector('a[to="/steam/library/$appid"]')).toBeTruthy();
  });

  it("falls back to a bare sentence and no receipt when stats are absent", () => {
    const { container } = render(<SteamMomentBeat {...driftProps} launchDrift={null} />);
    expect(container.textContent).toContain("Got there before the crowd did.");
    expect(container.querySelector('svg[data-slot="sparkline"]')).toBeNull();
  });

  it("applies the LAUNCH_RARITY_DRIFT eyebrow accent", () => {
    const { container } = render(<SteamMomentBeat {...driftProps} />);
    const eyebrow = container.querySelector("p.uppercase span:not([aria-hidden])");
    expect(eyebrow?.className).toContain("text-indigo-300");
  });

  it("has no axe violations", async () => {
    const { container } = render(<SteamMomentBeat {...driftProps} />);
    const results = await axe(container);
    expect(results.violations).toHaveLength(0);
  });
});

describe("SteamMomentBeat per-type accent (R-7h.1)", () => {
  // Per-momentType typographic accent — FIRST_TIME_GAME picks teal-300,
  // ACHIEVEMENT_CLUSTER picks fuchsia-300. Atmosphere backdrop stays game-
  // derived; this is the chapter's per-type colour signature.
  it("applies FIRST_TIME_GAME eyebrow with text-teal-300", () => {
    const { container } = render(<SteamMomentBeat {...baseProps} />);
    const eyebrow = container.querySelector("p.uppercase span:not([aria-hidden])");
    expect(eyebrow?.className).toContain("text-teal-300");
  });

  it("applies ACHIEVEMENT_CLUSTER eyebrow with text-fuchsia-300", () => {
    const clusterProps = {
      ...baseProps,
      slug: "steam-moment-cluster-2050650",
      momentType: "ACHIEVEMENT_CLUSTER" as const,
      firstTime: null,
      cluster: {
        unlockCount: 6,
        spanHours: 3.5,
        capUnlockedAt: "2026-05-30T20:00:00.000Z",
        unlockNames: ["Survivor", "Hunter"],
      },
    };
    const { container } = render(<SteamMomentBeat {...clusterProps} />);
    const eyebrow = container.querySelector("p.uppercase span:not([aria-hidden])");
    expect(eyebrow?.className).toContain("text-fuchsia-300");
  });
});
