import { render, screen } from "@testing-library/react";
import type { LolAccount } from "@vyoh/shared";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lol/champions/use-champions", () => ({
  useChampionName: vi.fn(() => (alias: string) => alias),
}));
vi.mock("@/lol/_shared/assets/champion-icon", () => ({
  rankEmblemUrl: (tier: string, year: number) => `https://test/emblem/${tier}/${year}`,
}));
vi.mock("@/lol/_shared/use-ranked-emblem-year", () => ({
  useRankedEmblemYear: vi.fn(() => 2026),
}));
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

import { LolMomentBeat } from "./lol-moment-beat";

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
  marathon: null,
  nudged: true,
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
  marathon: null,
  nudged: true,
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
  marathon: null,
  nudged: true,
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
  marathon: null,
  nudged: true,
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
  marathon: null,
  nudged: true,
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
  marathon: null,
  nudged: true,
};

const marathonProps = {
  account,
  championAlias: "Ahri",
  matchId: "EUW_MAR_CAP",
  daysSince: 0,
  slug: "lol-moment-marathon-EUW_MAR_CAP",
  momentType: "MARATHON" as const,
  matchStats,
  rankUp: null,
  kdaOutlier: null,
  hiatusReturn: null,
  streak: null,
  marathon: { matchCount: 7, spanHours: 4.5 },
  nudged: true,
};

describe("LolMomentBeat (OFF_META_PICK)", () => {
  it("renders the off-meta-pick eyebrow, champion masthead, and 'stepped off' prose", () => {
    render(<LolMomentBeat {...baseProps} />);
    expect(screen.getByText("Off-meta pick")).toBeTruthy();
    // Masthead is the H2; the off-meta champion name also appears in the
    // prose, so scope on the heading role rather than a bare text match.
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Renekton");
    // The "stepped off Ahri" prose is split across spans; the anchor name
    // appears once (in the prose), so a bare text match is fine here.
    expect(screen.getByText("Ahri")).toBeTruthy();
  });

  it("derives a human-readable when-line from daysSince", () => {
    render(<LolMomentBeat {...baseProps} daysSince={0} />);
    expect(screen.getByText("today")).toBeTruthy();
  });

  it("links the masthead to the match-detail route when matchId is present", () => {
    const { container } = render(<LolMomentBeat {...baseProps} />);
    const link = container.querySelector('a[to="/lol/$accountSlug/matches/$matchId"]');
    expect(link).toBeTruthy();
  });

  it("renders the masthead as plain text (no link) when matchId is null", () => {
    const { container } = render(<LolMomentBeat {...baseProps} matchId={null} />);
    expect(
      container.querySelector('a[to="/lol/$accountSlug/matches/$matchId"]')
    ).toBeNull();
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Renekton");
  });

  // Atmosphere claim + chapter-level data attributes + splash preload all
  // moved to the LoL moments aggregator (R-12.5). LolMomentBeat is now the
  // beat content only — no chapter wrapper, no atmosphere publication, no
  // critical preload. Aggregator tests own those assertions.

  it("renders the W/L pill + KDA + duration when matchStats is provided", () => {
    render(<LolMomentBeat {...baseProps} />);
    expect(screen.getByText("Win")).toBeTruthy();
    expect(screen.getByText("7 / 4 / 11")).toBeTruthy();
    expect(screen.getByText("31m")).toBeTruthy();
    // Queue label sits in the eyebrow row.
    expect(screen.getByText("Ranked Solo")).toBeTruthy();
  });

  it("renders 'Loss' in rose when win=false", () => {
    render(<LolMomentBeat {...baseProps} matchStats={{ ...matchStats, win: false }} />);
    expect(screen.getByText("Loss")).toBeTruthy();
  });

  it("omits the match-stat strip entirely when matchStats is null", () => {
    render(<LolMomentBeat {...baseProps} matchStats={null} />);
    expect(screen.queryByText("Win")).toBeNull();
    expect(screen.queryByText("Loss")).toBeNull();
    expect(screen.queryByText("7 / 4 / 11")).toBeNull();
  });
});

describe("LolMomentBeat (RANK_UP)", () => {
  it("renders the rank-up eyebrow, destination-rank masthead, and 'climbed from … to …' prose", () => {
    render(<LolMomentBeat {...rankUpProps} />);
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
    const { container } = render(<LolMomentBeat {...rankUpProps} />);
    const emblem = container.querySelector('img[src="https://test/emblem/GOLD/2026"]');
    expect(emblem).toBeTruthy();
    // Decorative — the masthead text already labels the tier, so the emblem
    // shouldn't announce itself to screen readers.
    expect(emblem?.getAttribute("alt")).toBe("");
  });

  it("does NOT render an emblem on OFF_META_PICK (text-only masthead)", () => {
    const { container } = render(<LolMomentBeat {...baseProps} />);
    expect(container.querySelector('img[src^="https://test/emblem/"]')).toBeNull();
  });

  it("formats apex tier masthead without a division suffix", () => {
    render(
      <LolMomentBeat
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

  it("falls back to the off-meta framing when rankUp is null (defensive — descriptor invariant)", () => {
    // The descriptor invariant is that momentType=RANK_UP always carries
    // rankUp. If the contract ever ships a null pair, the chapter should
    // degrade to off-meta copy rather than render a broken header.
    render(<LolMomentBeat {...rankUpProps} rankUp={null} />);
    expect(screen.queryByText("Rank up")).toBeNull();
    expect(screen.getByText("Off-meta pick")).toBeTruthy();
  });
});

describe("LolMomentBeat (KDA_OUTLIER)", () => {
  it("renders the standout eyebrow, champion masthead, and KDA + multiplier prose", () => {
    render(<LolMomentBeat {...kdaOutlierProps} />);
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
    const { container } = render(<LolMomentBeat {...kdaOutlierProps} />);
    expect(container.querySelector('img[src^="https://test/emblem/"]')).toBeNull();
  });

  it("falls back to the off-meta framing when kdaOutlier is null (defensive)", () => {
    render(<LolMomentBeat {...kdaOutlierProps} kdaOutlier={null} />);
    expect(screen.queryByText("Standout game")).toBeNull();
    expect(screen.getByText("Off-meta pick")).toBeTruthy();
  });

  it("omits the multiplier clause when baseline is zero (degraded contract)", () => {
    render(
      <LolMomentBeat
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

describe("LolMomentBeat (RETURN_FROM_HIATUS)", () => {
  it("renders the return eyebrow, champion masthead, and gap-away prose", () => {
    render(<LolMomentBeat {...hiatusReturnProps} />);
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
    render(<LolMomentBeat {...hiatusReturnProps} hiatusReturn={{ gapDays: gap }} />);
    const prose = screen.getAllByText(/away from ranked/i)[0]?.closest("p")?.textContent;
    expect(prose).toContain(label);
  });

  it("falls back to the off-meta framing when hiatusReturn is null (defensive)", () => {
    render(<LolMomentBeat {...hiatusReturnProps} hiatusReturn={null} />);
    expect(screen.queryByText("Return")).toBeNull();
    expect(screen.getByText("Off-meta pick")).toBeTruthy();
  });
});

describe("LolMomentBeat (STREAK)", () => {
  it("renders the hot-streak eyebrow + 'N ranked wins in a row' prose for STREAK_5W", () => {
    render(<LolMomentBeat {...streakWinProps} />);
    expect(screen.getByText("Hot streak")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Ahri");
    const prose = screen
      .getAllByText(/ranked wins in a row/i)[0]
      ?.closest("p")?.textContent;
    expect(prose).toMatch(/5\s*ranked wins in a row/);
    expect(prose).toMatch(/last on\s*Ahri/);
  });

  it("renders the cold-streak eyebrow + 'N ranked losses straight' prose for STREAK_5L", () => {
    render(<LolMomentBeat {...streakLossProps} />);
    expect(screen.getByText("Cold streak")).toBeTruthy();
    const prose = screen
      .getAllByText(/ranked losses straight/i)[0]
      ?.closest("p")?.textContent;
    expect(prose).toMatch(/6\s*ranked losses straight/);
    expect(prose).toMatch(/last on\s*Ahri/);
  });

  it("falls back to off-meta framing when streak is null (defensive)", () => {
    render(<LolMomentBeat {...streakWinProps} streak={null} />);
    expect(screen.queryByText("Hot streak")).toBeNull();
    expect(screen.getByText("Off-meta pick")).toBeTruthy();
  });
});

describe("LolMomentBeat (MARATHON)", () => {
  it("renders the marathon eyebrow, champion masthead, and 'N games in one sitting' prose", () => {
    render(<LolMomentBeat {...marathonProps} />);
    expect(screen.getByText("Marathon")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Ahri");
    const prose = screen
      .getAllByText(/games in one sitting/i)[0]
      ?.closest("p")?.textContent;
    expect(prose).toMatch(/7\s*ranked games in one sitting/);
    expect(prose).toMatch(/capped on\s*Ahri/);
  });

  it("falls back to off-meta framing when marathon is null (defensive)", () => {
    render(<LolMomentBeat {...marathonProps} marathon={null} />);
    expect(screen.queryByText("Marathon")).toBeNull();
    expect(screen.getByText("Off-meta pick")).toBeTruthy();
  });
});

describe("LolMomentBeat daysSince formatting", () => {
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
    render(<LolMomentBeat {...baseProps} daysSince={days} />);
    expect(screen.getByText(expected)).toBeTruthy();
  });
});

describe("LolMomentBeat per-type receipt (R-7h.3)", () => {
  // Each sequence/standout type leads its receipt strip with the type's
  // load-bearing number (count, gap, KDA), not the bare W/L + K/D/A strip
  // designed for single-match moments. The source match's K/D/A rides
  // along as the second-register substat — editorial proof, not lede.

  it("OFF_META_PICK keeps the default W/L + K/D/A + duration receipt", () => {
    render(<LolMomentBeat {...baseProps} />);
    expect(screen.getByText("Win")).toBeTruthy();
    expect(screen.getByText("7 / 4 / 11")).toBeTruthy();
    expect(screen.getByText("31m")).toBeTruthy();
  });

  it("RANK_UP keeps the default W/L + K/D/A + duration receipt", () => {
    render(<LolMomentBeat {...rankUpProps} />);
    expect(screen.getByText("Win")).toBeTruthy();
    expect(screen.getByText("7 / 4 / 11")).toBeTruthy();
  });

  it("KDA_OUTLIER leads with matchKda as headline + multiplier substat", () => {
    render(<LolMomentBeat {...kdaOutlierProps} />);
    // matchKda 13.0 → "13.0" appears in both prose AND receipt headline,
    // so assert count instead of singular presence. "KDA" label + "5.2×
    // baseline" substat are receipt-only.
    expect(screen.getAllByText("13.0").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("KDA")).toBeTruthy();
    expect(screen.getByText(/5\.2× baseline/)).toBeTruthy();
    // No W/L pill — superseded by the headline KDA register.
    expect(screen.queryByText("Win")).toBeNull();
  });

  it("STREAK_5W leads with length + 'in a row' + substat", () => {
    render(<LolMomentBeat {...streakWinProps} />);
    // length 5 appears in prose ("5 ranked wins…") AND in receipt headline.
    expect(screen.getAllByText("5").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("in a row")).toBeTruthy();
    // Substat shows compact W · K/D/A.
    expect(screen.getByText(/W · 7\/4\/11/)).toBeTruthy();
  });

  it("STREAK_5L leads with length + 'straight' + substat", () => {
    render(<LolMomentBeat {...streakLossProps} />);
    expect(screen.getAllByText("6").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("straight")).toBeTruthy();
    expect(screen.getByText(/L · 7\/4\/11/)).toBeTruthy();
  });

  it("MARATHON leads with matchCount + spanHours label", () => {
    render(<LolMomentBeat {...marathonProps} />);
    // matchCount 7 appears in prose ("7 ranked games…") AND headline.
    expect(screen.getAllByText("7").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/games across 4\.5h/)).toBeTruthy();
  });

  it("RETURN_FROM_HIATUS leads with gap label + 'quiet'", () => {
    render(<LolMomentBeat {...hiatusReturnProps} />);
    // gapDays 35 → formatHiatusGap produces "5 weeks" (35/7) or "A month"
    // (30-59). Just assert "quiet" landed; gap label format is covered by
    // the existing daysSince + gap-formatting tests.
    expect(screen.getByText("quiet")).toBeTruthy();
  });

  it("omits the receipt entirely when matchStats is null on a default-receipt type", () => {
    // OFF_META_PICK with no matchStats → no receipt block.
    render(<LolMomentBeat {...baseProps} matchStats={null} />);
    expect(screen.queryByText("Win")).toBeNull();
    expect(screen.queryByText("7 / 4 / 11")).toBeNull();
  });

  it("custom-shape receipts still render when matchStats is null (the substat just drops)", () => {
    // KDA_OUTLIER without matchStats still has kdaOutlier → renders the
    // headline + label, but the substat row is gone.
    render(<LolMomentBeat {...kdaOutlierProps} matchStats={null} />);
    expect(screen.getAllByText("13.0").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("KDA")).toBeTruthy();
  });
});

describe("LolMomentBeat per-type leadingVisual (R-7h.2)", () => {
  // Each non-text-only momentType gets a recognisable inline visual paired
  // with the masthead — at-a-glance silhouette before the prose lands.
  // We assert by lucide's emitted className signature (`lucide-{name}`) or
  // by the pip-row's coloured-dot signature for streaks.
  it("renders the destination tier emblem on RANK_UP (pre-R-7h.2; unchanged)", () => {
    const { container } = render(<LolMomentBeat {...rankUpProps} />);
    expect(container.querySelector("img[alt='']")).toBeTruthy();
  });

  it("renders a Trophy lucide icon as the leadingVisual on KDA_OUTLIER", () => {
    const { container } = render(<LolMomentBeat {...kdaOutlierProps} />);
    expect(container.querySelector(".lucide-trophy")).toBeTruthy();
  });

  it("renders an Hourglass lucide icon as the leadingVisual on RETURN_FROM_HIATUS", () => {
    const { container } = render(<LolMomentBeat {...hiatusReturnProps} />);
    expect(container.querySelector(".lucide-hourglass")).toBeTruthy();
  });

  it("renders a Clock lucide icon as the leadingVisual on MARATHON", () => {
    const { container } = render(<LolMomentBeat {...marathonProps} />);
    expect(container.querySelector(".lucide-clock")).toBeTruthy();
  });

  it("renders an emerald pip row as the leadingVisual on STREAK_5W", () => {
    const { container } = render(<LolMomentBeat {...streakWinProps} />);
    const pips = container.querySelectorAll(".bg-emerald-300.rounded-full");
    // streakWinProps.streak.length = 5
    expect(pips.length).toBe(5);
    expect(container.querySelector(".bg-rose-300.rounded-full")).toBeNull();
  });

  it("renders a rose pip row as the leadingVisual on STREAK_5L", () => {
    const { container } = render(<LolMomentBeat {...streakLossProps} />);
    const pips = container.querySelectorAll(".bg-rose-300.rounded-full");
    // streakLossProps.streak.length = 6
    expect(pips.length).toBe(6);
    expect(container.querySelector(".bg-emerald-300.rounded-full")).toBeNull();
  });

  it("caps the pip row at 7 dots for very long streaks (prose still carries the true count)", () => {
    const longStreakProps = {
      ...streakWinProps,
      streak: { result: "W" as const, length: 12 },
    };
    const { container } = render(<LolMomentBeat {...longStreakProps} />);
    const pips = container.querySelectorAll(".bg-emerald-300.rounded-full");
    expect(pips.length).toBe(7);
  });

  it("renders no leadingVisual on OFF_META_PICK (the splash IS the visual)", () => {
    const { container } = render(<LolMomentBeat {...baseProps} />);
    expect(container.querySelector(".lucide-trophy")).toBeNull();
    expect(container.querySelector(".lucide-clock")).toBeNull();
    expect(container.querySelector(".lucide-hourglass")).toBeNull();
    expect(container.querySelector(".bg-emerald-300.rounded-full")).toBeNull();
    expect(container.querySelector(".bg-rose-300.rounded-full")).toBeNull();
  });
});

describe("LolMomentBeat per-type accent (R-7h.1)", () => {
  // Per-momentType typographic accent — eyebrow + Accent spans pick up a
  // tailwind text-* class from `momentAccentClass`. The atmosphere backdrop
  // stays champion-derived; this lever is the chapter's per-type colour
  // signature. We assert the eyebrow span carries the expected class, which
  // implies the inline Accent spans do too (both pull from the same source).
  it.each([
    ["OFF_META_PICK" as const, baseProps, "text-sky-300"],
    ["RANK_UP" as const, rankUpProps, "text-amber-300"],
    ["KDA_OUTLIER" as const, kdaOutlierProps, "text-yellow-200"],
    ["RETURN_FROM_HIATUS" as const, hiatusReturnProps, "text-violet-300"],
    ["STREAK_5W" as const, streakWinProps, "text-emerald-300"],
    ["STREAK_5L" as const, streakLossProps, "text-rose-300"],
    ["MARATHON" as const, marathonProps, "text-orange-300"],
  ])("applies %s eyebrow with class %s", (_label, props, expectedClass) => {
    const { container } = render(<LolMomentBeat {...props} />);
    // The eyebrow text matches the chapter's first uppercase-tracked span;
    // find it by class signature and assert the accent class is part of it.
    const eyebrow = container.querySelector("p.uppercase span:not([aria-hidden])");
    expect(eyebrow?.className).toContain(expectedClass);
  });
});
