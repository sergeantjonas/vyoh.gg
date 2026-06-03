import { mainScrollRef } from "@/lib/scroll-container";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
    <a {...props}>{children}</a>
  ),
}));
vi.mock("@/home/recap/use-asset-claim", () => ({ useAssetClaim: vi.fn() }));
vi.mock("@/home/recap/preload-link", () => ({
  preloadLinkAsImage: vi.fn(() => () => {}),
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
  steamLibraryHeroLargeUrl: (appid: number) => `https://test/hero/${appid}`,
}));
vi.mock("@/steam/use-steam-game-recap", () => ({
  useSteamGameRecap: vi.fn(),
}));

import { preloadLinkAsImage } from "@/home/recap/preload-link";
import { useAssetClaim } from "@/home/recap/use-asset-claim";
import { useSteamGameRecap } from "@/steam/use-steam-game-recap";
import { SteamMomentChapter } from "./steam-moment-chapter";

function mockRecap(
  overrides: Partial<{
    shortDescription: string;
    dominantHex: string;
    subjectXPercent: number;
    subjectYPercent: number;
  }> = {}
) {
  vi.mocked(useSteamGameRecap).mockReturnValue({
    data: {
      shortDescription: null,
      dominantHex: null,
      subjectXPercent: null,
      subjectYPercent: null,
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
};

beforeEach(() => {
  mainScrollRef.current = document.createElement("div");
  mockRecap();
});

afterEach(() => {
  vi.mocked(useAssetClaim).mockClear();
  vi.mocked(preloadLinkAsImage).mockClear();
  vi.mocked(useSteamGameRecap).mockReset();
  mainScrollRef.current = null;
});

describe("SteamMomentChapter (FIRST_TIME_GAME)", () => {
  it("renders the first-time eyebrow and game-name masthead", () => {
    render(<SteamMomentChapter {...baseProps} />);
    expect(screen.getByText("First time on")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Resident Evil 4");
  });

  it("derives a human-readable when-line from daysSince", () => {
    render(<SteamMomentChapter {...baseProps} daysSince={5} />);
    expect(screen.getByText("5 days ago")).toBeTruthy();
  });

  it("links the masthead to the Steam game-detail route", () => {
    const { container } = render(<SteamMomentChapter {...baseProps} />);
    const link = container.querySelector('a[to="/steam/game/$appid"]');
    expect(link).toBeTruthy();
  });

  it("renders the session-shape receipt (total + count + avg) when firstTime is provided", () => {
    render(<SteamMomentChapter {...baseProps} />);
    // baseProps: 150 min across 3 sessions → "3h · 3 sessions · avg 1h"
    // (formatPlaytime rounds 50min → "50m"). Assert the loadbearing labels
    // without coupling tightly to playtime formatter tuning.
    expect(screen.getByText(/3 sessions/i)).toBeTruthy();
    expect(screen.getByText(/^avg /i)).toBeTruthy();
  });

  it("renders the 'first sit-down' beat in the receipt when sessionCount > 1", () => {
    render(<SteamMomentChapter {...baseProps} />);
    // baseProps: firstSessionMinutes: 60 → "first sit-down 1h"
    expect(screen.getByText(/first sit-down/i)).toBeTruthy();
  });

  it("omits the 'first sit-down' beat when sessionCount is exactly one (collapses to total)", () => {
    render(
      <SteamMomentChapter
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
      <SteamMomentChapter
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
      <SteamMomentChapter
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
      <SteamMomentChapter
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
      <SteamMomentChapter
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
    render(<SteamMomentChapter {...baseProps} firstTime={null} />);
    expect(screen.queryByText(/session/i)).toBeNull();
  });

  it("renders the tagline under the masthead when the recap query returns a shortDescription", () => {
    mockRecap({
      shortDescription:
        "A reimagining of the survival horror classic.\r\n\r\nLeon S. Kennedy, six years after Raccoon City…",
    });
    render(<SteamMomentChapter {...baseProps} />);
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
    const { container } = render(<SteamMomentChapter {...baseProps} />);
    // Tagline is the only italic body under the masthead; assert it's gone
    // by looking for the prose-body class signature.
    const italicBodies = container.querySelectorAll("p.italic");
    expect(italicBodies.length).toBe(0);
  });

  it("threads the recap's dominantHex into the atmosphere claim when available", () => {
    mockRecap({ dominantHex: "#3aa57e" });
    render(<SteamMomentChapter {...baseProps} />);
    const call = vi.mocked(useAssetClaim).mock.calls[0];
    expect(call?.[1]?.accentHex).toBe("#3aa57e");
  });

  it("threads the recap's subject anchor into the atmosphere claim", () => {
    mockRecap({ subjectXPercent: 62, subjectYPercent: 41 });
    render(<SteamMomentChapter {...baseProps} />);
    const call = vi.mocked(useAssetClaim).mock.calls[0];
    expect(call?.[1]?.subjectXPercent).toBe(62);
    expect(call?.[1]?.subjectYPercent).toBe(41);
  });

  it("exposes the chapter slug + label via data attributes for the caret discovery scan", () => {
    const { container } = render(<SteamMomentChapter {...baseProps} />);
    const root = container.querySelector("[data-recap-chapter]");
    expect(root?.getAttribute("data-recap-chapter")).toBe("steam-moment-first-2050650");
    expect(root?.getAttribute("data-chapter-label")).toBe("First time");
  });

  it("injects a critical link[rel=preload] for the library hero asset", () => {
    render(<SteamMomentChapter {...baseProps} />);
    expect(preloadLinkAsImage).toHaveBeenCalledWith("https://test/hero/2050650");
  });

  it("publishes the hero asset as an atmosphere claim", () => {
    render(<SteamMomentChapter {...baseProps} />);
    const call = vi.mocked(useAssetClaim).mock.calls[0];
    expect(call?.[1]?.image).toBe("https://test/hero/2050650");
  });
});

describe("SteamMomentChapter (ACHIEVEMENT_CLUSTER placeholder)", () => {
  it("falls back to the cluster-shaped eyebrow until R-7g lands the cluster detector", () => {
    render(
      <SteamMomentChapter
        {...baseProps}
        slug="steam-moment-cluster-2050650"
        momentType="ACHIEVEMENT_CLUSTER"
        firstTime={null}
      />
    );
    expect(screen.getByText("Recent run on")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Resident Evil 4");
  });
});
