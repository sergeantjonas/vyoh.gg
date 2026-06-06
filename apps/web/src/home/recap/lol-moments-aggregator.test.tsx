import { render, screen } from "@testing-library/react";
import type { LolAccount, LolMomentChapterDescriptor } from "@vyoh/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mainScrollRef } from "@/lib/scroll-container";

vi.mock("@/lol/champions/use-champions", () => ({
  useChampionName: vi.fn(() => (alias: string) => alias),
}));
vi.mock("@/lol/_shared/patch/use-ddragon-version", () => ({
  useDDragonVersion: vi.fn(() => "26.9"),
}));
vi.mock("@/lol/_shared/assets/champion-icon", () => ({
  championBackdropSplashUrl: (alias: string, patch: string) =>
    `https://test/backdrop/${alias}/${patch}`,
  rankEmblemUrl: (tier: string, year: number) => `https://test/emblem/${tier}/${year}`,
}));
vi.mock("@/lol/_shared/assets/champion-theme", () => ({
  championTheme: (_alias: string) => ({
    dominantHex: "#f04444",
    blurhash: "test-hash",
  }),
}));
vi.mock("@/lol/_shared/use-ranked-emblem-year", () => ({
  useRankedEmblemYear: vi.fn(() => 2026),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
    <a {...props}>{children}</a>
  ),
}));
vi.mock("@/home/recap/use-asset-claim", () => ({ useAssetClaim: vi.fn() }));
vi.mock("@/home/recap/use-asset-preload", () => ({ useAssetPreload: vi.fn() }));
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
import { LolMomentsAggregator } from "./lol-moments-aggregator";

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

function makeMoment(
  overrides: Partial<LolMomentChapterDescriptor>
): LolMomentChapterDescriptor {
  return {
    kind: "lol-moment",
    slug: "lol-moment-off-meta-EUW_X",
    score: 1.0,
    daysSince: 3,
    championAlias: "Renekton",
    matchId: "EUW_X",
    momentType: "OFF_META_PICK",
    matchStats,
    rankUp: null,
    kdaOutlier: null,
    hiatusReturn: null,
    streak: null,
    marathon: null,
    offMeta: true,
    ...overrides,
  } as LolMomentChapterDescriptor;
}

beforeEach(() => {
  mainScrollRef.current = document.createElement("div");
});

afterEach(() => {
  vi.mocked(useAssetClaim).mockClear();
  vi.mocked(preloadLinkAsImage).mockClear();
  mainScrollRef.current = null;
});

describe("LolMomentsAggregator", () => {
  it("renders nothing when the moments list is empty", () => {
    const { container } = render(<LolMomentsAggregator moments={[]} account={account} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders one beat per moment inside a ChapterMultiBeat wrapper", () => {
    const moments = [
      makeMoment({ slug: "m-1", championAlias: "Renekton", matchId: "EUW_1" }),
      makeMoment({
        slug: "m-2",
        championAlias: "Ahri",
        momentType: "RANK_UP",
        matchId: "EUW_2",
        rankUp: {
          fromTier: "SILVER",
          fromRank: "I",
          fromLp: 96,
          toTier: "GOLD",
          toRank: "IV",
          toLp: 15,
        },
      }),
    ];
    const { container } = render(
      <LolMomentsAggregator moments={moments} account={account} />
    );
    const wrap = container.querySelector("[data-chapter-multi-beat]");
    expect(wrap).toBeTruthy();
    expect(wrap?.getAttribute("data-chapter-beat-count")).toBe("2");
    const beats = container.querySelectorAll<HTMLElement>("[data-beat]");
    expect(beats.length).toBe(2);
    // Beat-0 carries the OFF_META eyebrow; beat-1 the RANK_UP eyebrow.
    expect(beats[0]?.textContent ?? "").toContain("Off-meta pick");
    expect(beats[1]?.textContent ?? "").toContain("Rank up");
  });

  it("publishes a single atmosphere claim using the anchor Ahri backdrop splash", () => {
    const moments = [
      makeMoment({ slug: "m-1", championAlias: "Renekton" }),
      makeMoment({ slug: "m-2", championAlias: "Lux", matchId: "EUW_LUX" }),
    ];
    render(<LolMomentsAggregator moments={moments} account={account} />);
    // Aggregator publishes one claim, regardless of how many moments it
    // holds — Path A (shared atmosphere) per the R-12 plan.
    expect(useAssetClaim).toHaveBeenCalledTimes(1);
    const claim = vi.mocked(useAssetClaim).mock.calls[0]?.[1];
    expect(claim?.image).toBe("https://test/backdrop/Ahri/26.9");
    expect(claim?.accentHex).toBe("#f04444");
  });

  it("preloads the anchor splash URL eagerly", () => {
    render(
      <LolMomentsAggregator moments={[makeMoment({ slug: "m-1" })]} account={account} />
    );
    expect(preloadLinkAsImage).toHaveBeenCalledWith("https://test/backdrop/Ahri/26.9");
  });

  it("renders the chapter masthead identity slot with subject-led voice", () => {
    const { container } = render(
      <LolMomentsAggregator moments={[makeMoment({ slug: "m-1" })]} account={account} />
    );
    // Subject-led eyebrow + masthead "Moments" pattern — mirrors the Ahri
    // chapter's identity treatment. The page now carries multiple H2s
    // (masthead + per-beat moment title), so scope queries to the
    // masthead identity wrapper.
    expect(screen.getByText("Vyoh's LoL year")).toBeTruthy();
    const masthead = container.querySelector("[data-chapter-masthead]");
    expect(masthead).toBeTruthy();
    expect(masthead?.querySelector("h2")?.textContent).toBe("Moments");
    expect(screen.getByText("where the routine cracked")).toBeTruthy();
  });

  it("formats the standout count in the masthead eyebrow", () => {
    render(
      <LolMomentsAggregator
        moments={[
          makeMoment({ slug: "m-1" }),
          makeMoment({ slug: "m-2", matchId: "EUW_2" }),
          makeMoment({ slug: "m-3", matchId: "EUW_3" }),
        ]}
        account={account}
      />
    );
    expect(screen.getByText("3 standouts")).toBeTruthy();
  });

  it("singularizes the standout count when only one moment is present", () => {
    render(
      <LolMomentsAggregator moments={[makeMoment({ slug: "m-1" })]} account={account} />
    );
    expect(screen.getByText("1 standout")).toBeTruthy();
  });

  it("links the masthead to the LoL account landing route", () => {
    const { container } = render(
      <LolMomentsAggregator moments={[makeMoment({ slug: "m-1" })]} account={account} />
    );
    const masthead = container.querySelector("[data-chapter-masthead]");
    const link = masthead?.querySelector("a");
    expect(link).toBeTruthy();
    expect(link?.getAttribute("to")).toBe("/lol/$accountSlug");
  });

  it("filters out moments missing a championAlias before partitioning beats", () => {
    // The descriptor union allows nullable championAlias on lol-moment;
    // routes/index.tsx already filters at the call seam, but the
    // aggregator's beat-render also guards so a stale upstream descriptor
    // doesn't crash a beat. Render with one valid + one stripped — only
    // the valid one renders content; the stripped beat returns null.
    const moments = [
      makeMoment({ slug: "m-1", championAlias: "Renekton" }),
      makeMoment({ slug: "m-2", championAlias: null as unknown as string }),
    ];
    const { container } = render(
      <LolMomentsAggregator moments={moments} account={account} />
    );
    // Both beats still mount structurally (beat-count = 2), but only
    // beat-0 has content text. Beat-1's body is null.
    const beats = container.querySelectorAll<HTMLElement>("[data-beat]");
    expect(beats.length).toBe(2);
    expect(beats[0]?.textContent ?? "").toContain("Off-meta pick");
    expect(beats[1]?.querySelector("h2")).toBeNull();
  });
});
