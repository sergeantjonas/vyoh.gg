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

import { preloadLinkAsImage } from "@/home/recap/preload-link";
import { useAssetClaim } from "@/home/recap/use-asset-claim";
import { SteamMomentChapter } from "./steam-moment-chapter";

const baseProps = {
  appid: 2050650,
  name: "Resident Evil 4",
  daysSince: 3,
  slug: "steam-moment-first-2050650",
  momentType: "FIRST_TIME_GAME" as const,
  firstTime: { windowPlayMinutes: 150 },
};

beforeEach(() => {
  mainScrollRef.current = document.createElement("div");
});

afterEach(() => {
  vi.mocked(useAssetClaim).mockClear();
  vi.mocked(preloadLinkAsImage).mockClear();
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

  it("renders the in-window playtime receipt when firstTime is provided", () => {
    render(<SteamMomentChapter {...baseProps} />);
    // The exact format ("2h 30m" vs "150m") comes from `formatPlaytime`; we
    // just assert the surrounding "in the books" tag landed so the receipt
    // strip is present without coupling to formatter tuning.
    expect(screen.getByText(/in the books/i)).toBeTruthy();
  });

  it("omits the playtime receipt when firstTime is null (defensive — descriptor invariant)", () => {
    render(<SteamMomentChapter {...baseProps} firstTime={null} />);
    expect(screen.queryByText(/in the books/i)).toBeNull();
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
