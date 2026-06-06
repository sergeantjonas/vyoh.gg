import { mainScrollRef } from "@/lib/scroll-container";
import { useChampionRecap } from "@/lol/champions/use-champion-recap";
import { useChampionName } from "@/lol/champions/use-champions";
import { render, screen } from "@testing-library/react";
import { type LolAccount, type MatchSummary, deriveChampionRecap } from "@vyoh/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lol/champions/use-champion-recap", () => ({
  useChampionRecap: vi.fn(),
}));
vi.mock("@/lol/champions/use-champions", () => ({
  useChampionName: vi.fn(() => (alias: string) => alias),
}));
vi.mock("@/lol/_shared/patch/use-ddragon-version", () => ({
  useDDragonVersion: vi.fn(() => "26.9"),
}));
vi.mock("@/lol/_shared/assets/champion-icon", () => ({
  championBackdropSplashUrl: (alias: string, patch: string) =>
    `https://test/img/${alias}/${patch}`,
  // RoleIcon (rendered per recent-runs row) calls roleIconUrl() — stubbed
  // out here so it returns a stable URL without hitting the image proxy
  // resolver in the test environment.
  roleIconUrl: (slug: string) => `https://test/role/${slug}.svg`,
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
// ChapterReveal in production uses motion's whileInView (IntersectionObserver),
// which doesn't fire reliably in happy-dom. The mock renders children plainly
// so band content is in the DOM and assertable.
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

/**
 * Tests still author fixtures as MatchSummary[] (familiar shape) and the
 * helper runs them through the real shared deriver before handing the recap
 * to the mocked hook. Keeps every test honest about what data path produced
 * the chapter state under assertion — if the deriver changes, the chapter
 * tests change with it.
 */
function setMatches(matches: MatchSummary[]) {
  const recap = deriveChampionRecap("Ahri", matches, new Date("2026-06-01T12:00:00Z"));
  vi.mocked(useChampionRecap).mockReturnValue({
    data: recap,
    isPending: false,
  } as unknown as ReturnType<typeof useChampionRecap>);
}

beforeEach(() => {
  mainScrollRef.current = document.createElement("div");
});

afterEach(() => {
  vi.mocked(useChampionRecap).mockReset();
  vi.mocked(useAssetClaim).mockClear();
  mainScrollRef.current = null;
});

describe("AhriChapter", () => {
  it("renders opener/detail/stats bands (closer removed since CTA moved to title-as-link)", () => {
    setMatches([matchFixture({ matchId: "EUW_1" })]);
    const { container } = render(<AhriChapter account={account} />);
    expect(container.querySelector("[data-band='opener']")).toBeTruthy();
    expect(container.querySelector("[data-band='detail']")).toBeTruthy();
    expect(container.querySelector("[data-band='stats']")).toBeTruthy();
    // Closer band intentionally absent on Ahri — the masthead is the
    // entry point to the deep-stats page (title-as-link pattern).
    expect(container.querySelector("[data-band='closer']")).toBeNull();
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
    const { container } = render(<AhriChapter account={account} />);
    // 2 Ahri matches countable, 1W/1L. Win-rate chip in the stats band
    // displays 50%; the verdict prose also includes the value, so target
    // the stats band specifically.
    const stats = container.querySelector("[data-band='stats']");
    expect(stats?.textContent).toContain("50%");
    // Recent strip shows both Ahri rows (remake excluded).
    const rows = container.querySelectorAll("[data-band='detail'] li");
    expect(rows.length).toBe(2);
  });

  it("renders em-dash placeholders in every stat chip when no Ahri matches exist", () => {
    setMatches([
      matchFixture({ matchId: "EUW_1", champion: "Yasuo" }),
      matchFixture({ matchId: "EUW_2", champion: "Garen" }),
    ]);
    const { container } = render(<AhriChapter account={account} />);
    // Each of the three peak chips holds an em-dash zero-state.
    const stats = container.querySelector("[data-band='stats']");
    const dashes = stats?.querySelectorAll(":scope *");
    const dashText = Array.from(dashes ?? []).filter(
      (el) => el.textContent?.trim() === "—"
    );
    expect(dashText.length).toBe(3);
    // Verdict prose carries the empty-state copy.
    expect(container.textContent).toContain("No tracked Ahri games yet.");
  });

  it("renders up to 5 recent Ahri matches in the detail strip, newest first", () => {
    const matches = Array.from({ length: 8 }, (_, i) =>
      matchFixture({
        matchId: `EUW_${i}`,
        champion: "Ahri",
        playedAt: new Date(2026, 4, 20 + i, 20, 0, 0).toISOString(),
      })
    );
    setMatches(matches);
    const { container } = render(<AhriChapter account={account} />);
    const rows = container.querySelectorAll("[data-band='detail'] li");
    expect(rows.length).toBe(5);
  });

  it("renders the eyebrow as '{gameName}'s {displayName}' (subject-led voice)", () => {
    vi.mocked(useChampionName).mockReturnValue(() => "Ahri");
    setMatches([matchFixture({ matchId: "EUW_1" })]);
    render(<AhriChapter account={account} />);
    expect(screen.getByText("Vyoh's Ahri")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Ahri" })).toBeTruthy();
  });

  it("renders the champion title subtext under the masthead", () => {
    vi.mocked(useChampionName).mockReturnValue(() => "Ahri");
    setMatches([matchFixture({ matchId: "EUW_1" })]);
    render(<AhriChapter account={account} />);
    // Editorial subtext sits below the headline. The masthead-tier reveal
    // pairs the headline and the title; the title is hardcoded for this
    // first per-champion chapter.
    expect(screen.getByText("the Nine-Tailed Fox")).toBeTruthy();
  });

  it("recent-run rows carry the hover-band class so the pointer position is visible", () => {
    setMatches([matchFixture({ matchId: "EUW_1" })]);
    const { container } = render(<AhriChapter account={account} />);
    const detailLinks = container.querySelectorAll("[data-band='detail'] li a");
    // Each recent-run row links into the match detail; the row carries a
    // `hover:bg-*` class so users can tell which row their pointer is on
    // (the original color-only hover wasn't visible against the splash).
    for (const link of detailLinks) {
      expect(link.className).toMatch(/hover:bg-/);
    }
  });

  it("renders the signature-game card linking into the corresponding match detail", () => {
    // Prior tests in this file pin useChampionName to a "Ahri"-returning
    // stub to assert the masthead reads "Ahri". That state leaks across
    // tests; pin identity here so `championName("Sylas")` returns "Sylas"
    // and the opponent assertion below reflects the real render path
    // (now that we filter opponent names through useChampionName to
    // surface "Aurelion Sol" instead of the raw "AurelionSol" alias).
    vi.mocked(useChampionName).mockReturnValue((alias: string) => alias);
    setMatches([
      matchFixture({
        matchId: "EUW_BEST",
        champion: "Ahri",
        kills: 17,
        deaths: 2,
        assists: 9,
        win: true,
        laneOpponent: {
          puuid: "p",
          championName: "Sylas",
          gameName: "x",
          tagLine: "y",
        },
      }),
    ]);
    const { container } = render(<AhriChapter account={account} />);
    const detail = container.querySelector("[data-band='detail']");
    expect(detail?.textContent).toContain("Signature game");
    expect(detail?.textContent).toContain("17 / 2 / 9");
    expect(detail?.textContent).toContain("Sylas");
    // First detail-band link is the signature card → match detail route.
    // The mock Link forwards `to` verbatim as an attribute; `params` is an
    // object that stringifies to "[object Object]" which is the right
    // signal that it was forwarded too.
    const sigLink = detail?.querySelector("a");
    expect(sigLink?.getAttribute("to")).toBe("/lol/$accountSlug/matches/$matchId");
  });

  it("renders the active skin name inline with the eyebrow when a non-Base skin is active", () => {
    // The default rotation mock is single-entry "Base" — flip it for this
    // test only via the array-swap pattern used elsewhere in the file.
    const rotation: { name: string; imageUrl?: string }[] = [{ name: "K/DA" }];
    (AHRI_SKIN_ROTATION as unknown as { name: string; imageUrl?: string }[]).splice(
      0,
      AHRI_SKIN_ROTATION.length,
      ...rotation
    );
    setMatches([matchFixture({ matchId: "EUW_1" })]);
    const { container } = render(<AhriChapter account={account} />);
    expect(container.textContent).toContain("K/DA");
    (AHRI_SKIN_ROTATION as unknown as { name: string; imageUrl?: string }[]).splice(
      0,
      AHRI_SKIN_ROTATION.length,
      { name: "Base" }
    );
  });

  it("masthead links to the champion deep route for the account slug", () => {
    setMatches([]);
    const { container } = render(<AhriChapter account={account} />);
    // Post-R-14 the masthead lives sticky in `ChapterMultiBeat`'s
    // identity slot (not inside beat 0), so the chapter title-as-link is
    // queried via `[data-chapter-masthead]`. The slot wrapper is
    // outside the beat bodies so it persists across the horizontal beat
    // slide.
    const masthead = container.querySelector("[data-chapter-masthead]");
    const link = masthead?.querySelector("a");
    expect(link).toBeTruthy();
    expect(link?.getAttribute("to")).toBe("/lol/$accountSlug/champions/$championKey");
    expect(link?.querySelector("h2")?.textContent).toContain("Ahri");
  });

  describe("multi-beat layout", () => {
    it("renders the multi-beat chapter wrapper with three beats", () => {
      setMatches([matchFixture({ matchId: "EUW_1" })]);
      const { container } = render(<AhriChapter account={account} />);
      const multiBeat = container.querySelector("[data-chapter-multi-beat]");
      expect(multiBeat).toBeTruthy();
      // Ahri runs three beats (content-leaner than Steam's four); per
      // the recap arc note, reaching for a fourth here would be filler.
      expect(multiBeat?.getAttribute("data-chapter-beat-count")).toBe("3");
    });

    it("renders three 1/3-width beats in the horizontal track", () => {
      setMatches([matchFixture({ matchId: "EUW_1" })]);
      const { container } = render(<AhriChapter account={account} />);
      const beats = container.querySelectorAll<HTMLElement>("[data-beat]");
      expect(beats.length).toBe(3);
      // Each beat occupies 1/3 of the track. Inline-styled because
      // Tailwind arbitrary values can't interpolate beatCount.
      for (const beat of beats) {
        expect(beat.style.width).toBe(`${100 / 3}%`);
        expect(beat.className).toContain("shrink-0");
      }
    });

    it("pins the chapter stage so the masthead persists during scroll", () => {
      setMatches([matchFixture({ matchId: "EUW_1" })]);
      const { container } = render(<AhriChapter account={account} />);
      const stage = container.querySelector("[data-chapter-stage]");
      expect(stage).toBeTruthy();
      expect(stage?.className).toContain("sticky");
      expect(stage?.className).toContain("top-0");
      const header = container.querySelector("header[data-chapter-masthead]");
      expect(header).toBeTruthy();
    });

    it("renders a single chapter-level identity mark (not per-beat)", () => {
      setMatches([matchFixture({ matchId: "EUW_1" })]);
      const { container } = render(<AhriChapter account={account} />);
      // The masthead lives sticky at the chapter group level — exactly
      // one mark, not duplicated inside each beat. Per-beat
      // identity re-mounts are exactly what `ChapterMultiBeat`'s
      // identity slot exists to avoid.
      const marks = container.querySelectorAll("[data-chapter-masthead]");
      expect(marks.length).toBe(1);
      expect(marks[0]?.querySelector("h2")?.textContent).toContain("Ahri");
    });

    it("partitions bands across beats: opener → 0, detail → 1, stats → 2", () => {
      setMatches([
        matchFixture({
          matchId: "EUW_SIG",
          champion: "Ahri",
          kills: 17,
          deaths: 2,
          assists: 9,
        }),
      ]);
      const { container } = render(<AhriChapter account={account} />);
      const beatOf = (selector: string): string | null =>
        container
          .querySelector(selector)
          ?.closest("[data-beat]")
          ?.getAttribute("data-beat") ?? null;
      expect(beatOf("[data-band='opener']")).toBe("0");
      expect(beatOf("[data-band='detail']")).toBe("1");
      expect(beatOf("[data-band='stats']")).toBe("2");
      // No closer band — masthead is the deep-stats CTA via the identity
      // slot (title-as-link pattern).
      expect(container.querySelector("[data-band='closer']")).toBeNull();
    });
  });

  describe("beat-2 peaks caption", () => {
    it("renders the peak-kills / peak-damage / lane-phase receipts in beat 2", () => {
      // `hasTimeline: true` is what gates avgGoldDiffAt15 inclusion in the
      // deriver (otherwise zero-gold-diff timelineless games would bias the
      // mean down). Set on both fixtures so the lane-phase fact renders.
      setMatches([
        matchFixture({
          matchId: "EUW_A",
          champion: "Ahri",
          kills: 12,
          deaths: 1,
          assists: 8,
          damageShare: 0.4,
          firstBloodKill: true,
          teamGoldDiffAt15: 800,
          hasTimeline: true,
        }),
        matchFixture({
          matchId: "EUW_B",
          champion: "Ahri",
          kills: 6,
          deaths: 3,
          assists: 5,
          damageShare: 0.3,
          firstBloodKill: false,
          teamGoldDiffAt15: 400,
          hasTimeline: true,
        }),
      ]);
      const { container } = render(<AhriChapter account={account} />);
      // beat 2 holds the stats band; the peaks caption sits in beat 2's
      // detail band immediately below the primary chips.
      const beat2 = container.querySelector("[data-beat='2']");
      expect(beat2).toBeTruthy();
      const text = beat2?.textContent ?? "";
      // highestKills = 12 → "Up to 12 kills"
      expect(text).toContain("Up to");
      expect(text).toContain("12 kills");
      // highestDamageShare = 0.4 → "40%"
      expect(text).toContain("40%");
      expect(text).toContain("best damage share");
      // aboveFiveKillsRate = 2/2 = 100% (both games above 5 kills)
      expect(text).toContain("5+ kills in");
      // firstBloodRate = 1/2 = 50%
      expect(text).toContain("first blood");
      // avgGoldDiffAt15 = (800 + 400)/2 = +600g lead at 15
      expect(text).toContain("+600g");
      expect(text).toContain("lead at 15");
    });

    it("suppresses peak facts whose source values are effectively zero", () => {
      setMatches([
        // No first blood, no damage share, low avg gold diff (sub-50g).
        matchFixture({
          matchId: "EUW_QUIET",
          champion: "Ahri",
          kills: 3,
          deaths: 2,
          assists: 7,
          damageShare: 0,
          firstBloodKill: false,
          teamGoldDiffAt15: 20,
        }),
      ]);
      const { container } = render(<AhriChapter account={account} />);
      const text = container.textContent ?? "";
      // Highest kills is still 3, so "Up to 3 kills" should render.
      expect(text).toContain("Up to");
      // But "best damage share" suppresses (highestDamageShare = 0).
      expect(text).not.toContain("best damage share");
      // First blood suppresses (rate = 0).
      expect(text).not.toContain("first blood");
      // Lane-phase suppresses (|avg| < 50g threshold).
      expect(text).not.toContain("lead at 15");
    });

    it("renders the streak eyebrow above the peaks caption when a streak is active", () => {
      // Two consecutive wins on Ahri → streak {type:'win', count: 2}
      setMatches([
        matchFixture({
          matchId: "EUW_W1",
          champion: "Ahri",
          win: true,
          playedAt: new Date("2026-05-30T10:00:00Z").toISOString(),
        }),
        matchFixture({
          matchId: "EUW_W2",
          champion: "Ahri",
          win: true,
          playedAt: new Date("2026-05-29T10:00:00Z").toISOString(),
        }),
      ]);
      const { container } = render(<AhriChapter account={account} />);
      const beat2 = container.querySelector("[data-beat='2']");
      // Streak eyebrow renders as "W{N} streak" — case is uppercase via
      // tracking-[0.22em] but happy-dom doesn't apply text-transform, so
      // assert on the lowercase source text.
      expect(beat2?.textContent ?? "").toContain("W2 streak");
    });

    it("suppresses the streak eyebrow when no streak exists (single-result history)", () => {
      // One game → streak null (deriver returns null when count < 2).
      setMatches([matchFixture({ matchId: "EUW_1", champion: "Ahri", win: true })]);
      const { container } = render(<AhriChapter account={account} />);
      const beat2 = container.querySelector("[data-beat='2']");
      expect(beat2?.textContent ?? "").not.toContain("streak");
    });
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
