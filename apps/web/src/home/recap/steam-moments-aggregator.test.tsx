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

  it("publishes a single palette-only atmosphere claim (no shared hero image)", () => {
    const moments = [
      makeMoment({ slug: "m-1", appid: 1 }),
      makeMoment({ slug: "m-2", appid: 2 }),
    ];
    render(<SteamMomentsAggregator moments={moments} />);
    // Aggregator publishes one claim regardless of moment count.
    expect(useAssetClaim).toHaveBeenCalledTimes(1);
    const claim = vi.mocked(useAssetClaim).mock.calls[0]?.[1];
    // Palette-only: no `image` key (the aggregator isn't "about" any one
    // game, so painting a hero would mislead). Palette is still
    // provided so the atmosphere layer has its blend source.
    expect(claim).toBeDefined();
    expect((claim as { image?: string }).image).toBeUndefined();
    expect(claim?.palette).toBeDefined();
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
