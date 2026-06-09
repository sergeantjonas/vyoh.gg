import { render, screen } from "@testing-library/react";
import type { LolAccount } from "@vyoh/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mainScrollRef } from "@/lib/scroll-container";

vi.mock("@/lol/_shared/assets/champion-icon", () => ({
  rankEmblemUrl: (tier: string, year: number) => `https://test/emblem/${tier}/${year}`,
}));
vi.mock("@/lol/_shared/assets/summoner-icon", () => ({
  profileIconUrl: (id: number) => `https://test/pic/${id}`,
}));
vi.mock("@/lol/_shared/patch/use-ddragon-version", () => ({
  useDDragonVersion: vi.fn(() => "26.9"),
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

// Strip data hooks — return empty/pending so each strip renders its
// placeholder shape; the test focuses on chapter-level concerns (beat
// count, masthead identity, atmosphere claim) not strip data.
vi.mock("@/home/use-home-lifetime-totals", () => ({
  useHomeLifetimeTotals: vi.fn(() => ({ data: undefined })),
}));
vi.mock("@/home/use-home-today", () => ({
  useHomeToday: vi.fn(() => ({ data: undefined })),
}));
vi.mock("@/home/use-home-chronotype", () => ({
  useHomeChronotype: vi.fn(() => ({ isPending: true, data: undefined })),
}));
vi.mock("@/home/use-home-day-split", () => ({
  useHomeDaySplit: vi.fn(() => ({ isPending: true, data: undefined })),
}));
vi.mock("@/home/use-home-session-lengths", () => ({
  useHomeSessionLengths: vi.fn(() => ({ isPending: true, data: undefined })),
}));
vi.mock("@/lol/matches/use-live-match", () => ({
  useLiveGame: vi.fn(() => ({ data: null })),
}));
vi.mock("@/steam/use-player-state", () => ({
  useSteamPlayerState: vi.fn(() => ({ data: undefined })),
}));
vi.mock("@/steam/use-owned-games", () => ({
  useSteamOwnedGames: vi.fn(() => ({ data: undefined })),
}));
vi.mock("@/lol/profile/use-rank-history", () => ({
  useRankHistory: vi.fn(() => ({ data: undefined })),
}));
vi.mock("@/home/use-primary-account", () => ({
  usePrimaryAccount: vi.fn(),
}));
vi.mock("@/steam/use-steam-summary", () => ({
  useSteamSummary: vi.fn(() => ({ data: undefined })),
}));

import { useAssetClaim } from "@/home/recap/use-asset-claim";
import { usePrimaryAccount } from "@/home/use-primary-account";
import { useSteamSummary } from "@/steam/use-steam-summary";
import { ConclusionChapter } from "./conclusion-chapter";

const account: LolAccount = {
  slug: "vyoh",
  region: "euw1",
  gameName: "Vyoh",
  tagLine: "EUW",
  profileIconId: 4567,
  summary: {
    rank: { tier: "EMERALD", rank: "I", leaguePoints: 17, wins: 80, losses: 70 },
  },
} as unknown as LolAccount;

beforeEach(() => {
  mainScrollRef.current = document.createElement("div");
  vi.mocked(usePrimaryAccount).mockReturnValue({
    account,
    isPending: false,
  } as unknown as ReturnType<typeof usePrimaryAccount>);
  vi.mocked(useSteamSummary).mockReturnValue({
    data: { personaName: "vyoh", avatarUrl: "https://test/steam-avatar.png" },
  } as ReturnType<typeof useSteamSummary>);
});

afterEach(() => {
  vi.mocked(useAssetClaim).mockClear();
  vi.mocked(usePrimaryAccount).mockReset();
  vi.mocked(useSteamSummary).mockReset();
  mainScrollRef.current = null;
});

describe("ConclusionChapter", () => {
  it("renders four beats inside a ChapterMultiBeat wrapper", () => {
    const { container } = render(<ConclusionChapter />);
    const wrap = container.querySelector("[data-chapter-multi-beat]");
    expect(wrap).toBeTruthy();
    expect(wrap?.getAttribute("data-chapter-beat-count")).toBe("4");
    const beats = container.querySelectorAll<HTMLElement>("[data-beat]");
    expect(beats.length).toBe(4);
  });

  it("renders the owner-as-subject masthead with name, rank, and Steam persona", () => {
    const { container } = render(<ConclusionChapter />);
    const masthead = container.querySelector("[data-chapter-masthead]");
    expect(masthead).toBeTruthy();
    expect(screen.getByText("Vyoh's portrait")).toBeTruthy();
    // Inline rank label — formatRank produces e.g. "Emerald I · 17 LP".
    expect(screen.getByText(/Emerald/i)).toBeTruthy();
    // Dual-platform identity: Steam persona surfaced in the eyebrow.
    expect(screen.getByText("vyoh on Steam")).toBeTruthy();
    // Owner name + "the player" italic — pattern parity with Ahri's
    // "the Nine-Tailed Fox" subject-title treatment.
    expect(masthead?.querySelector("h2")?.textContent).toContain("Vyoh");
    expect(screen.getByText("the player")).toBeTruthy();
  });

  it("publishes a palette-only atmosphere claim with the warm-amber accent", () => {
    render(<ConclusionChapter />);
    expect(useAssetClaim).toHaveBeenCalled();
    const lastClaim = vi.mocked(useAssetClaim).mock.calls.at(-1)?.[1];
    // Conclusion is palette-only — no `image` (no splash backdrop), but
    // ships an explicit warm-amber accent so the eyebrow's `var(--accent)`
    // glyph doesn't fall through to the muted slate default that read
    // as low-contrast purple during R-15.1 review.
    expect(lastClaim?.image).toBeUndefined();
    expect(lastClaim?.palette).toBeDefined();
    expect(lastClaim?.accentHex).toBe("#f0c878");
  });

  it("carries the -mb-6 sticky-pin fix on the outer wrapper", () => {
    const { container } = render(<ConclusionChapter />);
    // The route wraps the page in a `mx-auto max-w-4xl p-6` shell whose
    // 24px bottom padding leaves CSS sticky to disengage in the last
    // 24px of scroll, producing the visible content scroll-up at chapter
    // exit (caught during R-15.1 review). The `-mb-6` negative margin
    // pulls the section into the wrapper's padding region so sticky
    // stays pinned all the way to the page's natural end.
    const outer = container.querySelector('[data-recap-chapter="conclusion"]');
    expect(outer).toBeTruthy();
    expect(outer?.classList.contains("-mb-6")).toBe(true);
  });

  it("renders nothing in the masthead when the primary account is unavailable", () => {
    vi.mocked(usePrimaryAccount).mockReturnValueOnce({
      account: null,
      accounts: [],
    } as unknown as ReturnType<typeof usePrimaryAccount>);
    const { container } = render(<ConclusionChapter />);
    // The chapter shell still renders — the masthead identity slot
    // returns null when account is missing, but multi-beat keeps its
    // structural shape so prefetch/layout don't churn while data
    // arrives.
    const masthead = container.querySelector("[data-chapter-masthead]");
    expect(masthead?.querySelector("h2")).toBeNull();
    expect(container.querySelector("[data-chapter-multi-beat]")).toBeTruthy();
  });
});
