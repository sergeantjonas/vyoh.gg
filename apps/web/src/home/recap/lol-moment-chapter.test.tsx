import { mainScrollRef } from "@/lib/scroll-container";
import { render, screen } from "@testing-library/react";
import type { LolAccount } from "@vyoh/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lol/champions/use-champions", () => ({
  useChampionName: vi.fn(() => (alias: string) => alias),
}));
vi.mock("@/lol/_shared/patch/use-ddragon-version", () => ({
  useDDragonVersion: vi.fn(() => "26.9"),
}));
vi.mock("@/lol/_shared/assets/champion-icon", () => ({
  championHdSplashUrl: (alias: string, patch: string) =>
    `https://test/hd/${alias}/${patch}`,
  rankEmblemUrl: (tier: string, year: number) => `https://test/emblem/${tier}/${year}`,
}));
vi.mock("@/lol/_shared/use-ranked-emblem-year", () => ({
  useRankedEmblemYear: vi.fn(() => 2026),
}));
vi.mock("@/lol/_shared/assets/champion-theme", () => ({
  championTheme: (_alias: string) => ({
    dominantHex: "#f04444",
    blurhash: "test-hash",
  }),
}));
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

import { preloadLinkAsImage } from "@/home/recap/preload-link";
import { useAssetClaim } from "@/home/recap/use-asset-claim";
import { LolMomentChapter } from "./lol-moment-chapter";

const account: LolAccount = {
  slug: "vyoh",
  region: "euw1",
  gameName: "Vyoh",
  tagLine: "EUW",
};

const matchStats = {
  kills: 7,
  deaths: 4,
  assists: 11,
  win: true,
  durationSec: 1860,
  queueType: "Ranked Solo",
};

const baseProps = {
  account,
  championAlias: "Renekton",
  matchId: "EUW_42",
  daysSince: 3,
  slug: "lol-moment-off-meta-EUW_42",
  momentType: "OFF_META_PICK" as const,
  matchStats,
  rankUp: null,
  kdaOutlier: null,
  hiatusReturn: null,
  streak: null,
};

const rankUpDelta = {
  fromTier: "SILVER",
  fromRank: "I",
  fromLp: 96,
  toTier: "GOLD",
  toRank: "IV",
  toLp: 15,
};

const rankUpProps = {
  account,
  championAlias: "Ahri",
  matchId: "EUW_RU",
  daysSince: 2,
  slug: "lol-moment-rank-up-EUW_RU",
  momentType: "RANK_UP" as const,
  matchStats,
  rankUp: rankUpDelta,
  kdaOutlier: null,
  hiatusReturn: null,
  streak: null,
};

const kdaOutlierStats = {
  matchKda: 13.0,
  baselineKda: 2.5,
};

const kdaOutlierProps = {
  account,
  championAlias: "Ahri",
  matchId: "EUW_KDA",
  daysSince: 1,
  slug: "lol-moment-kda-outlier-EUW_KDA",
  momentType: "KDA_OUTLIER" as const,
  matchStats: {
    kills: 12,
    deaths: 2,
    assists: 14,
    win: true,
    durationSec: 1820,
    queueType: "Ranked Solo",
  },
  rankUp: null,
  kdaOutlier: kdaOutlierStats,
  hiatusReturn: null,
  streak: null,
};

const hiatusReturnProps = {
  account,
  championAlias: "Ahri",
  matchId: "EUW_BACK",
  daysSince: 2,
  slug: "lol-moment-hiatus-return-EUW_BACK",
  momentType: "RETURN_FROM_HIATUS" as const,
  matchStats,
  rankUp: null,
  kdaOutlier: null,
  hiatusReturn: { gapDays: 35 },
  streak: null,
};

const streakWinProps = {
  account,
  championAlias: "Ahri",
  matchId: "EUW_HOT",
  daysSince: 0,
  slug: "lol-moment-streak-w-EUW_HOT",
  momentType: "STREAK_5W" as const,
  matchStats,
  rankUp: null,
  kdaOutlier: null,
  hiatusReturn: null,
  streak: { result: "W" as const, length: 5 },
};

const streakLossProps = {
  account,
  championAlias: "Ahri",
  matchId: "EUW_COLD",
  daysSince: 0,
  slug: "lol-moment-streak-l-EUW_COLD",
  momentType: "STREAK_5L" as const,
  matchStats: { ...matchStats, win: false },
  rankUp: null,
  kdaOutlier: null,
  hiatusReturn: null,
  streak: { result: "L" as const, length: 6 },
};

beforeEach(() => {
  mainScrollRef.current = document.createElement("div");
});

afterEach(() => {
  vi.mocked(useAssetClaim).mockClear();
  vi.mocked(preloadLinkAsImage).mockClear();
  mainScrollRef.current = null;
});

describe("LolMomentChapter (OFF_META_PICK)", () => {
  it("renders the off-meta-pick eyebrow, champion masthead, and 'stepped off' prose", () => {
    render(<LolMomentChapter {...baseProps} />);
    expect(screen.getByText("Off-meta pick")).toBeTruthy();
    // Masthead is the H2; the off-meta champion name also appears in the
    // prose, so scope on the heading role rather than a bare text match.
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Renekton");
    // The "stepped off Ahri" prose is split across spans; the anchor name
    // appears once (in the prose), so a bare text match is fine here.
    expect(screen.getByText("Ahri")).toBeTruthy();
  });

  it("derives a human-readable when-line from daysSince", () => {
    render(<LolMomentChapter {...baseProps} daysSince={0} />);
    expect(screen.getByText("today")).toBeTruthy();
  });

  it("links the masthead to the match-detail route when matchId is present", () => {
    const { container } = render(<LolMomentChapter {...baseProps} />);
    const link = container.querySelector('a[to="/lol/$accountSlug/matches/$matchId"]');
    expect(link).toBeTruthy();
  });

  it("renders the masthead as plain text (no link) when matchId is null", () => {
    const { container } = render(<LolMomentChapter {...baseProps} matchId={null} />);
    expect(
      container.querySelector('a[to="/lol/$accountSlug/matches/$matchId"]')
    ).toBeNull();
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Renekton");
  });

  it("opens on the off-meta champion's HD splash directly (no anchor silhouette)", () => {
    render(<LolMomentChapter {...baseProps} />);
    // Chapter is ABOUT the off-meta champion; opening on Ahri for a 800ms
    // hold would read as a delay rather than a beat. The earlier R-6
    // silhouette-dissolve approach was dropped.
    const calls = vi.mocked(useAssetClaim).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const firstClaim = calls[0]?.[1];
    expect(firstClaim?.image).toBe("https://test/hd/Renekton/26.9");
  });

  it("exposes the chapter slug + label via data attributes for the caret discovery scan", () => {
    const { container } = render(<LolMomentChapter {...baseProps} />);
    const el = container.querySelector("[data-recap-chapter]");
    expect(el?.getAttribute("data-recap-chapter")).toBe("lol-moment-off-meta-EUW_42");
    expect(el?.getAttribute("data-chapter-label")).toContain("Off-meta");
  });

  it("injects a critical link[rel=preload] for the off-meta champion splash", () => {
    render(<LolMomentChapter {...baseProps} />);
    // Single hero asset → link-preload at mount, not IO-gated. The chapter
    // is its own preload-critical surface; same idempotent helper the
    // Ahri-anchor and first-Steam-subject chapters use.
    expect(preloadLinkAsImage).toHaveBeenCalledWith("https://test/hd/Renekton/26.9");
  });

  it("renders the W/L pill + KDA + duration when matchStats is provided", () => {
    render(<LolMomentChapter {...baseProps} />);
    expect(screen.getByText("Win")).toBeTruthy();
    expect(screen.getByText("7 / 4 / 11")).toBeTruthy();
    expect(screen.getByText("31m")).toBeTruthy();
    // Queue label sits in the eyebrow row.
    expect(screen.getByText("Ranked Solo")).toBeTruthy();
  });

  it("renders 'Loss' in rose when win=false", () => {
    render(
      <LolMomentChapter {...baseProps} matchStats={{ ...matchStats, win: false }} />
    );
    expect(screen.getByText("Loss")).toBeTruthy();
  });

  it("omits the match-stat strip entirely when matchStats is null", () => {
    render(<LolMomentChapter {...baseProps} matchStats={null} />);
    expect(screen.queryByText("Win")).toBeNull();
    expect(screen.queryByText("Loss")).toBeNull();
    expect(screen.queryByText("7 / 4 / 11")).toBeNull();
  });
});

describe("LolMomentChapter (RANK_UP)", () => {
  it("renders the rank-up eyebrow, destination-rank masthead, and 'climbed from … to …' prose", () => {
    render(<LolMomentChapter {...rankUpProps} />);
    expect(screen.getByText("Rank up")).toBeTruthy();
    // Masthead shows the destination tier+rank without the LP suffix.
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Gold IV");
    // Prose carries both endpoints + the championing champion. They split
    // across spans, so scope by the prose paragraph's textContent.
    const climbProse = screen.getAllByText(/Climbed from/i)[0]?.closest("p")?.textContent;
    expect(climbProse).toMatch(/Silver I/);
    expect(climbProse).toMatch(/Gold IV/);
    expect(climbProse).toMatch(/championed by\s*Ahri/);
  });

  it("renders the destination tier emblem inline with the masthead", () => {
    const { container } = render(<LolMomentChapter {...rankUpProps} />);
    const emblem = container.querySelector('img[src="https://test/emblem/GOLD/2026"]');
    expect(emblem).toBeTruthy();
    // Decorative — the masthead text already labels the tier, so the emblem
    // shouldn't announce itself to screen readers.
    expect(emblem?.getAttribute("alt")).toBe("");
  });

  it("does NOT render an emblem on OFF_META_PICK (text-only masthead)", () => {
    const { container } = render(<LolMomentChapter {...baseProps} />);
    expect(container.querySelector('img[src^="https://test/emblem/"]')).toBeNull();
  });

  it("formats apex tier masthead without a division suffix", () => {
    render(
      <LolMomentChapter
        {...rankUpProps}
        rankUp={{
          ...rankUpDelta,
          toTier: "MASTER",
          toRank: "I",
          toLp: 50,
        }}
      />
    );
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Master");
  });

  it("exposes a RANK_UP chapter-label data attribute", () => {
    const { container } = render(<LolMomentChapter {...rankUpProps} />);
    const el = container.querySelector("[data-recap-chapter]");
    expect(el?.getAttribute("data-chapter-label")).toContain("Rank up");
    expect(el?.getAttribute("data-chapter-label")).toContain("Gold IV");
  });

  it("falls back to the off-meta framing when rankUp is null (defensive — descriptor invariant)", () => {
    // The descriptor invariant is that momentType=RANK_UP always carries
    // rankUp. If the contract ever ships a null pair, the chapter should
    // degrade to off-meta copy rather than render a broken header.
    render(<LolMomentChapter {...rankUpProps} rankUp={null} />);
    expect(screen.queryByText("Rank up")).toBeNull();
    expect(screen.getByText("Off-meta pick")).toBeTruthy();
  });
});

describe("LolMomentChapter (KDA_OUTLIER)", () => {
  it("renders the standout eyebrow, champion masthead, and KDA + multiplier prose", () => {
    render(<LolMomentChapter {...kdaOutlierProps} />);
    expect(screen.getByText("Standout game")).toBeTruthy();
    // Masthead is the champion (the performance is the centerpiece, not
    // a rank), so the H2 is just the champion name.
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Ahri");
    // Prose combines KDA (rounded to 1 decimal) + multiplier vs baseline.
    const prose = screen.getAllByText(/Posted a/i)[0]?.closest("p")?.textContent;
    expect(prose).toMatch(/13\.0\s*KDA/);
    expect(prose).toMatch(/Ahri/);
    expect(prose).toMatch(/5\.2×\s*the 30-day baseline/);
  });

  it("does NOT render a leading emblem for KDA_OUTLIER (text-only masthead)", () => {
    const { container } = render(<LolMomentChapter {...kdaOutlierProps} />);
    expect(container.querySelector('img[src^="https://test/emblem/"]')).toBeNull();
  });

  it("exposes a Standout chapter-label data attribute", () => {
    const { container } = render(<LolMomentChapter {...kdaOutlierProps} />);
    const el = container.querySelector("[data-recap-chapter]");
    expect(el?.getAttribute("data-chapter-label")).toContain("Standout");
    expect(el?.getAttribute("data-chapter-label")).toContain("Ahri");
  });

  it("falls back to the off-meta framing when kdaOutlier is null (defensive)", () => {
    render(<LolMomentChapter {...kdaOutlierProps} kdaOutlier={null} />);
    expect(screen.queryByText("Standout game")).toBeNull();
    expect(screen.getByText("Off-meta pick")).toBeTruthy();
  });

  it("omits the multiplier clause when baseline is zero (degraded contract)", () => {
    render(
      <LolMomentChapter
        {...kdaOutlierProps}
        kdaOutlier={{ matchKda: 12.5, baselineKda: 0 }}
      />
    );
    const prose = screen.getAllByText(/Posted a/i)[0]?.closest("p")?.textContent;
    expect(prose).toMatch(/12\.5\s*KDA/);
    // No "Nx the 30-day baseline" tail when the multiplier is undefined.
    expect(prose).not.toMatch(/the 30-day baseline/);
  });
});

describe("LolMomentChapter (RETURN_FROM_HIATUS)", () => {
  it("renders the return eyebrow, champion masthead, and gap-away prose", () => {
    render(<LolMomentChapter {...hiatusReturnProps} />);
    expect(screen.getByText("Return")).toBeTruthy();
    // Masthead is the champion; the return moment centerpiece is "you're
    // back", with the champion as the visual subject.
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Ahri");
    const prose = screen.getAllByText(/away from ranked/i)[0]?.closest("p")?.textContent;
    // 35d → "A month" + "away from ranked, then back on Ahri."
    expect(prose).toMatch(/A month\s*away from ranked/);
    expect(prose).toMatch(/back on\s*Ahri/);
  });

  it.each([
    [14, "2 weeks"],
    [21, "3 weeks"],
    [40, "A month"],
    [55, "A month"],
    [60, "2 months"],
    [95, "3 months"],
    [180, "6 months"],
  ])("formats a %d-day gap as %s in the prose", (gap, label) => {
    render(<LolMomentChapter {...hiatusReturnProps} hiatusReturn={{ gapDays: gap }} />);
    const prose = screen.getAllByText(/away from ranked/i)[0]?.closest("p")?.textContent;
    expect(prose).toContain(label);
  });

  it("exposes a Return chapter-label data attribute", () => {
    const { container } = render(<LolMomentChapter {...hiatusReturnProps} />);
    const el = container.querySelector("[data-recap-chapter]");
    expect(el?.getAttribute("data-chapter-label")).toContain("Return");
    expect(el?.getAttribute("data-chapter-label")).toContain("Ahri");
  });

  it("falls back to the off-meta framing when hiatusReturn is null (defensive)", () => {
    render(<LolMomentChapter {...hiatusReturnProps} hiatusReturn={null} />);
    expect(screen.queryByText("Return")).toBeNull();
    expect(screen.getByText("Off-meta pick")).toBeTruthy();
  });
});

describe("LolMomentChapter (STREAK)", () => {
  it("renders the hot-streak eyebrow + 'N ranked wins in a row' prose for STREAK_5W", () => {
    render(<LolMomentChapter {...streakWinProps} />);
    expect(screen.getByText("Hot streak")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Ahri");
    const prose = screen
      .getAllByText(/ranked wins in a row/i)[0]
      ?.closest("p")?.textContent;
    expect(prose).toMatch(/5\s*ranked wins in a row/);
    expect(prose).toMatch(/last on\s*Ahri/);
  });

  it("renders the cold-streak eyebrow + 'N ranked losses straight' prose for STREAK_5L", () => {
    render(<LolMomentChapter {...streakLossProps} />);
    expect(screen.getByText("Cold streak")).toBeTruthy();
    const prose = screen
      .getAllByText(/ranked losses straight/i)[0]
      ?.closest("p")?.textContent;
    expect(prose).toMatch(/6\s*ranked losses straight/);
    expect(prose).toMatch(/last on\s*Ahri/);
  });

  it("exposes a Hot streak chapter-label data attribute", () => {
    const { container } = render(<LolMomentChapter {...streakWinProps} />);
    const el = container.querySelector("[data-recap-chapter]");
    expect(el?.getAttribute("data-chapter-label")).toContain("Hot streak");
  });

  it("exposes a Cold streak chapter-label data attribute", () => {
    const { container } = render(<LolMomentChapter {...streakLossProps} />);
    const el = container.querySelector("[data-recap-chapter]");
    expect(el?.getAttribute("data-chapter-label")).toContain("Cold streak");
  });

  it("falls back to off-meta framing when streak is null (defensive)", () => {
    render(<LolMomentChapter {...streakWinProps} streak={null} />);
    expect(screen.queryByText("Hot streak")).toBeNull();
    expect(screen.getByText("Off-meta pick")).toBeTruthy();
  });
});

describe("LolMomentChapter daysSince formatting", () => {
  // Boundary cases via small render scans — keeps the formatter in lockstep
  // with the chapter so a regression in the helper surfaces as a chapter
  // test failure, not a quiet copy drift.
  it.each([
    [0, "today"],
    [1, "yesterday"],
    [4, "4 days ago"],
    [10, "last week"],
    [20, "3 weeks ago"],
    [60, "2 months ago"],
  ])("renders daysSince=%d as %s", (days, expected) => {
    render(<LolMomentChapter {...baseProps} daysSince={days} />);
    expect(screen.getByText(expected)).toBeTruthy();
  });
});
