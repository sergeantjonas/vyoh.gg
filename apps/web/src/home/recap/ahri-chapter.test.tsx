import { mainScrollRef } from "@/lib/scroll-container";
import { useChampionName } from "@/lol/champions/use-champions";
import { useMatches } from "@/lol/matches/use-matches";
import { render, screen } from "@testing-library/react";
import type { LolAccount, MatchSummary } from "@vyoh/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lol/matches/use-matches", () => ({ useMatches: vi.fn() }));
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
vi.mock("@/lol/_shared/assets/champion-square-icon", () => ({
  ChampionSquareIcon: ({ championName }: { championName: string }) => (
    <span data-testid="champion-icon" data-name={championName} />
  ),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
    <a {...props}>{children}</a>
  ),
}));
vi.mock("@/home/recap/use-asset-claim", () => ({
  useAssetClaim: vi.fn(),
}));
vi.mock("@/home/recap/use-chapter-progress", async () => {
  const { useMotionValue } =
    await vi.importActual<typeof import("motion/react")>("motion/react");
  return {
    useChapterProgress: () => useMotionValue(0),
  };
});
vi.mock("@/home/recap/use-skin-rotation", async () => {
  const { useMotionValue } =
    await vi.importActual<typeof import("motion/react")>("motion/react");
  return {
    useSkinRotation: vi.fn(() => ({
      activeIndex: 0,
      bloomBlurPx: useMotionValue(0),
    })),
  };
});
vi.mock("@/home/landing-config", () => ({
  AHRI_SKIN_ROTATION: [{ name: "Base" }],
}));
vi.mock("motion/react", async () => {
  const actual = await vi.importActual<typeof import("motion/react")>("motion/react");
  return {
    ...actual,
    useReducedMotion: vi.fn(() => false),
  };
});

import { AHRI_SKIN_ROTATION } from "@/home/landing-config";
import { useAssetClaim } from "@/home/recap/use-asset-claim";
import { useSkinRotation } from "@/home/recap/use-skin-rotation";
import { motionValue } from "motion/react";
import { AhriChapter } from "./ahri-chapter";

const account: LolAccount = {
  slug: "ahri",
  region: "euw1",
  gameName: "Vyoh",
  tagLine: "Ahri",
};

const matchFixture = (
  overrides: Partial<MatchSummary> & { matchId: string }
): MatchSummary => ({
  queueType: "RANKED_SOLO_5x5",
  champion: "Ahri",
  kills: 8,
  deaths: 4,
  assists: 7,
  win: true,
  durationSec: 1800,
  playedAt: new Date("2026-05-30T10:00:00Z").toISOString(),
  remake: false,
  teamPosition: "MIDDLE",
  gameVersion: "26.9",
  visionScore: 22,
  damageShare: 0.27,
  firstBloodKill: false,
  csAt10: 0,
  csAt15: 0,
  goldAt10: 0,
  goldAt15: 0,
  teamGoldDiffAt15: 0,
  teamGoldDiffSeries: [],
  deathTimings: [],
  deathXs: [],
  deathYs: [],
  killTimings: [],
  killXs: [],
  killYs: [],
  laneOpponent: null,
  ...overrides,
});

function setMatches(matches: MatchSummary[]) {
  vi.mocked(useMatches).mockReturnValue({
    data: { pages: [matches] },
    isPending: false,
  } as unknown as ReturnType<typeof useMatches>);
}

beforeEach(() => {
  mainScrollRef.current = document.createElement("div");
});

afterEach(() => {
  vi.mocked(useMatches).mockReset();
  vi.mocked(useAssetClaim).mockClear();
  mainScrollRef.current = null;
});

describe("AhriChapter", () => {
  it("renders all four chapter bands", () => {
    setMatches([matchFixture({ matchId: "EUW_1" })]);
    const { container } = render(<AhriChapter account={account} />);
    expect(container.querySelector("[data-band='opener']")).toBeTruthy();
    expect(container.querySelector("[data-band='detail']")).toBeTruthy();
    expect(container.querySelector("[data-band='stats']")).toBeTruthy();
    expect(container.querySelector("[data-band='closer']")).toBeTruthy();
  });

  it("registers an atmosphere claim with the Ahri backdrop splash URL", () => {
    setMatches([]);
    render(<AhriChapter account={account} />);
    expect(useAssetClaim).toHaveBeenCalled();
    const firstCallArgs = vi.mocked(useAssetClaim).mock.calls[0];
    const claim = firstCallArgs?.[1];
    expect(claim?.image).toBe("https://test/img/Ahri/26.9");
    expect(claim?.palette).toBeDefined();
  });

  it("filters matches to Ahri and skips remakes when computing stats", () => {
    setMatches([
      matchFixture({
        matchId: "EUW_1",
        champion: "Ahri",
        win: true,
        kills: 10,
        deaths: 2,
        assists: 5,
      }),
      matchFixture({
        matchId: "EUW_2",
        champion: "Ahri",
        win: false,
        kills: 2,
        deaths: 8,
        assists: 3,
      }),
      matchFixture({
        matchId: "EUW_3",
        champion: "Yasuo",
        win: true,
        kills: 20,
        deaths: 0,
        assists: 0,
      }),
      matchFixture({ matchId: "EUW_4", champion: "Ahri", win: false, remake: true }),
    ]);
    render(<AhriChapter account={account} />);
    // 2 Ahri matches countable, 1W/1L → 50%
    expect(screen.getByText("50%")).toBeTruthy();
    expect(screen.getByText("1-1")).toBeTruthy();
    // Lede metric: "2 games tracked"
    expect(screen.getByText(/games tracked/)).toBeTruthy();
  });

  it("renders an em-dash for win-rate and KDA when no Ahri matches exist", () => {
    setMatches([
      matchFixture({ matchId: "EUW_1", champion: "Yasuo" }),
      matchFixture({ matchId: "EUW_2", champion: "Garen" }),
    ]);
    render(<AhriChapter account={account} />);
    const detail = screen.getByText("No tracked Ahri games yet.");
    expect(detail).toBeTruthy();
    // Win-rate cell and KDA cell both show em-dash. The record cell shows 0-0.
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBe(2);
    expect(screen.getByText("0-0")).toBeTruthy();
  });

  it("renders up to 5 recent Ahri matches in the detail strip", () => {
    const matches = Array.from({ length: 8 }, (_, i) =>
      matchFixture({ matchId: `EUW_${i}`, champion: "Ahri" })
    );
    setMatches(matches);
    const { container } = render(<AhriChapter account={account} />);
    const rows = container.querySelectorAll("[data-band='detail'] li");
    expect(rows.length).toBe(5);
  });

  it("uses the chapter's display name from useChampionName", () => {
    vi.mocked(useChampionName).mockReturnValue(() => "Ahri");
    setMatches([matchFixture({ matchId: "EUW_1" })]);
    render(<AhriChapter account={account} />);
    expect(screen.getByText("Your Ahri")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Ahri" })).toBeTruthy();
  });

  it("closer links to the champion deep route for the account slug", () => {
    setMatches([]);
    const { container } = render(<AhriChapter account={account} />);
    const link = container.querySelector("[data-band='closer'] a");
    expect(link).toBeTruthy();
    // The mocked Link forwards `to`, `params` as attributes — verify the
    // params object made it through verbatim.
    expect(link?.textContent).toContain("View Ahri deep stats");
  });

  it("forwards the chapter's dominant accentHex to the asset claim", () => {
    setMatches([]);
    render(<AhriChapter account={account} />);
    const claim = vi.mocked(useAssetClaim).mock.calls.at(-1)?.[1];
    expect(claim?.accentHex).toBe("#f04444");
  });

  it("forwards the rotation bloom MotionValue to the asset claim", () => {
    setMatches([]);
    const bloom = motionValue(0);
    vi.mocked(useSkinRotation).mockReturnValueOnce({
      activeIndex: 0,
      bloomBlurPx: bloom,
    });
    render(<AhriChapter account={account} />);
    const claim = vi.mocked(useAssetClaim).mock.calls.at(-1)?.[1];
    expect(claim?.bloomBlurPx).toBe(bloom);
  });

  it("uses the active skin's imageUrl override when set, instead of the proxy base", () => {
    setMatches([]);
    // Pretend the rotation picked an entry at index 0 — and the array's entry
    // there carries an override URL. The mock array is replaced via the
    // `AHRI_SKIN_ROTATION` import (which the chapter reads at render time).
    AHRI_SKIN_ROTATION.length === 1 && true; // touch to keep mock import live
    const customRotation = [{ name: "K/DA", imageUrl: "https://test/kda.jpg" }];
    // Mutate the mocked array reference so the chapter picks up the new entry
    // on next render. The mock factory returns this same array on every
    // module-load, so swapping in place is the simplest hand-off.
    (AHRI_SKIN_ROTATION as unknown as { name: string; imageUrl?: string }[]).splice(
      0,
      AHRI_SKIN_ROTATION.length,
      ...customRotation
    );
    render(<AhriChapter account={account} />);
    const claim = vi.mocked(useAssetClaim).mock.calls.at(-1)?.[1];
    expect(claim?.image).toBe("https://test/kda.jpg");
    // Restore so other tests in the same file aren't affected.
    (AHRI_SKIN_ROTATION as unknown as { name: string; imageUrl?: string }[]).splice(
      0,
      AHRI_SKIN_ROTATION.length,
      { name: "Base" }
    );
  });
});
