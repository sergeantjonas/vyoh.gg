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
  championBackdropSplashUrl: (alias: string, patch: string) =>
    `https://test/img/${alias}/${patch}`,
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

import { useAssetClaim } from "@/home/recap/use-asset-claim";
import { useAssetPreload } from "@/home/recap/use-asset-preload";
import { LolMomentChapter } from "./lol-moment-chapter";

const account: LolAccount = {
  slug: "vyoh",
  region: "euw1",
  gameName: "Vyoh",
  tagLine: "EUW",
};

const baseProps = {
  account,
  championAlias: "Renekton",
  matchId: "EUW_42",
  daysSince: 3,
  slug: "lol-moment-off-meta-EUW_42",
};

beforeEach(() => {
  mainScrollRef.current = document.createElement("div");
});

afterEach(() => {
  vi.mocked(useAssetClaim).mockClear();
  vi.mocked(useAssetPreload).mockClear();
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

  it("starts on the anchor (Ahri) splash before the silhouette dissolve fires", () => {
    render(<LolMomentChapter {...baseProps} />);
    // First claim call: image is the anchor splash, not the off-meta one.
    // useChapterNudge stays false in happy-dom (no IO firing), so revealed
    // never flips and the anchor remains the active backdrop.
    const calls = vi.mocked(useAssetClaim).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const firstClaim = calls[0]?.[1];
    expect(firstClaim?.image).toBe("https://test/img/Ahri/26.9");
  });

  it("exposes the chapter slug + label via data attributes for the caret discovery scan", () => {
    const { container } = render(<LolMomentChapter {...baseProps} />);
    const el = container.querySelector("[data-recap-chapter]");
    expect(el?.getAttribute("data-recap-chapter")).toBe("lol-moment-off-meta-EUW_42");
    expect(el?.getAttribute("data-chapter-label")).toContain("Off-meta");
  });

  it("preloads the off-meta champion splash via useAssetPreload (lazy by default)", () => {
    render(<LolMomentChapter {...baseProps} />);
    const calls = vi.mocked(useAssetPreload).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const urls = calls[0]?.[1];
    expect(urls).toContain("https://test/img/Renekton/26.9");
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
