import { render, screen } from "@testing-library/react";
import type { SteamMomentChapterDescriptor } from "@vyoh/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mainScrollRef } from "@/lib/scroll-container";

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
vi.mock("@/steam/_shared/steam-image", () => ({
  steamLibraryLogoUrl: (appid: number) => `https://test/logo/${appid}`,
  steamLibraryHeroLargeUrl: (appid: number) => `https://test/hero/${appid}`,
}));
vi.mock("@/steam/use-steam-game-recap", () => ({
  useSteamGameRecap: vi.fn(() => ({
    data: {
      shortDescription: null,
      dominantHex: null,
      subjectXPercent: null,
      subjectYPercent: null,
      hasLogo: false,
      assetTimestamp: null,
    },
  })),
}));

import { useAssetClaim } from "@/home/recap/use-asset-claim";
import { SteamMomentsAggregator } from "./steam-moments-aggregator";

function makeMoment(
  overrides: Partial<SteamMomentChapterDescriptor>
): SteamMomentChapterDescriptor {
  return {
    kind: "steam-moment",
    slug: "steam-moment-first-2050650",
    score: 1.0,
    appid: 2050650,
    name: "Resident Evil 4",
    daysSince: 3,
    momentType: "FIRST_TIME_GAME",
    firstTime: {
      windowPlayMinutes: 150,
      sessionCount: 3,
      firstSessionMinutes: 60,
      addedAt: "2026-05-27T18:00:00.000Z",
      firstPlayedAt: "2026-05-30T20:00:00.000Z",
    },
    cluster: null,
    ...overrides,
  } as SteamMomentChapterDescriptor;
}

beforeEach(() => {
  mainScrollRef.current = document.createElement("div");
});

afterEach(() => {
  vi.mocked(useAssetClaim).mockClear();
  mainScrollRef.current = null;
});

describe("SteamMomentsAggregator", () => {
  it("renders nothing when the moments list is empty", () => {
    const { container } = render(<SteamMomentsAggregator moments={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders one beat per moment inside a ChapterMultiBeat wrapper", () => {
    const moments = [
      makeMoment({ slug: "m-1", appid: 1, name: "Game A" }),
      makeMoment({ slug: "m-2", appid: 2, name: "Game B" }),
    ];
    const { container } = render(<SteamMomentsAggregator moments={moments} />);
    const wrap = container.querySelector("[data-chapter-multi-beat]");
    expect(wrap).toBeTruthy();
    expect(wrap?.getAttribute("data-chapter-beat-count")).toBe("2");
    const beats = container.querySelectorAll<HTMLElement>("[data-beat]");
    expect(beats.length).toBe(2);
    expect(beats[0]?.textContent ?? "").toContain("Game A");
    expect(beats[1]?.textContent ?? "").toContain("Game B");
  });

  it("renders a launch-drift moment as a beat", () => {
    const headline = {
      apiName: "corvus_end",
      displayName: "Corvus's End",
      unlockedAt: "2026-08-05T21:14:00.000Z",
      percentAtUnlock: 0.7,
      percentNow: 28.4,
    };
    const moments = [
      makeMoment({
        slug: "steam-moment-launch-drift-2001760",
        appid: 2001760,
        name: "Beast of Reincarnation",
        momentType: "LAUNCH_RARITY_DRIFT",
        firstTime: null,
        launchDrift: {
          releaseDate: "2026-08-03",
          observedFrom: "2026-08-04T05:30:00.000Z",
          observedTo: "2026-08-31T05:30:00.000Z",
          observationCount: 12,
          bracketedUnlockCount: 3,
          headline,
          curve: [0.7, 6.2, 18.9, 28.4],
          receipt: [headline],
        },
      }),
    ];
    const { container } = render(<SteamMomentsAggregator moments={moments} />);
    const beats = container.querySelectorAll<HTMLElement>("[data-beat]");
    expect(beats.length).toBe(1);
    expect(beats[0]?.textContent ?? "").toContain("Early on");
  });

  it("publishes the focal beat's library hero as the atmosphere claim (per-beat backdrop)", () => {
    const moments = [
      makeMoment({ slug: "m-1", appid: 1 }),
      makeMoment({ slug: "m-2", appid: 2 }),
    ];
    render(<SteamMomentsAggregator moments={moments} />);
    // FocalBeatAtmosphereClaim publishes the focal-beat game's library
    // hero. At initial render focal=0 → first moment (appid=1). Replaces
    // the earlier palette-only Path A claim — user feedback: with two
    // beats the empty-palette transition window read as "broken".
    expect(useAssetClaim).toHaveBeenCalled();
    const lastClaim = vi.mocked(useAssetClaim).mock.calls.at(-1)?.[1];
    expect(lastClaim?.image).toBe("https://test/hero/1");
    expect(lastClaim?.palette).toBeDefined();
  });

  it("renders the chapter masthead identity slot with 'Steam · this season' + 'Highlights' framing", () => {
    const { container } = render(
      <SteamMomentsAggregator moments={[makeMoment({ slug: "m-1" })]} />
    );
    expect(screen.getByText(/Steam.*this season/)).toBeTruthy();
    const masthead = container.querySelector("[data-chapter-masthead]");
    expect(masthead).toBeTruthy();
    expect(masthead?.querySelector("h2")?.textContent).toBe("Highlights");
    expect(screen.getByText("what stuck this season")).toBeTruthy();
  });

  it("formats the highlight count in the masthead eyebrow", () => {
    render(
      <SteamMomentsAggregator
        moments={[
          makeMoment({ slug: "m-1", appid: 1 }),
          makeMoment({ slug: "m-2", appid: 2 }),
          makeMoment({ slug: "m-3", appid: 3 }),
        ]}
      />
    );
    expect(screen.getByText("3 highlights")).toBeTruthy();
  });

  it("singularizes the count when only one moment is present", () => {
    render(<SteamMomentsAggregator moments={[makeMoment({ slug: "m-1" })]} />);
    expect(screen.getByText("1 highlight")).toBeTruthy();
  });

  it("links the masthead to the Steam landing route", () => {
    const { container } = render(
      <SteamMomentsAggregator moments={[makeMoment({ slug: "m-1" })]} />
    );
    const masthead = container.querySelector("[data-chapter-masthead]");
    const link = masthead?.querySelector("a");
    expect(link).toBeTruthy();
    expect(link?.getAttribute("to")).toBe("/steam");
  });
});
