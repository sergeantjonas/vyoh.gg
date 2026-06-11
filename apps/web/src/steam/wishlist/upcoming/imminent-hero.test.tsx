import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { render, screen } from "@testing-library/react";
import type { SteamWishlistHeroMeta, SteamWishlistItem } from "@vyoh/shared";
import { configureAxe } from "jest-axe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DayRelease } from "@/steam/wishlist/upcoming/bucketing";
import { ImminentHero } from "@/steam/wishlist/upcoming/imminent-hero";

const { mockUseHeroMeta, mockUseBackdrop } = vi.hoisted(() => ({
  mockUseHeroMeta: vi.fn(),
  mockUseBackdrop: vi.fn(),
}));
vi.mock("@/steam/wishlist/upcoming/use-wishlist-hero-meta", () => ({
  useWishlistHeroMeta: mockUseHeroMeta,
}));
vi.mock("@/steam/profile-backdrop", () => ({
  useSteamGameBackdrop: mockUseBackdrop,
}));
// Force the in-view cascade on and render motion children plainly (no
// IntersectionObserver in happy-dom) — mirrors the recap chapter tests.
vi.mock("motion/react", async () => {
  const actual = await vi.importActual<typeof import("motion/react")>("motion/react");
  return {
    ...actual,
    useInView: vi.fn(() => true),
    useReducedMotion: vi.fn(() => false),
  };
});

const axe = configureAxe({
  rules: {
    "color-contrast": { enabled: false },
    "aria-hidden-focus": { enabled: false },
  },
});

function item(overrides: Partial<SteamWishlistItem> = {}): SteamWishlistItem {
  return {
    appid: 1904610,
    name: "Beast of Reincarnation",
    dateAdded: 1_700_000_000,
    priority: 0,
    storeUrl: "https://store.steampowered.com/app/1904610",
    releaseDate: 1_785_776_400,
    comingSoon: true,
    ...overrides,
  };
}

function release(overrides: Partial<DayRelease> = {}): DayRelease {
  return {
    item: item(),
    date: { year: 2026, month: 7, day: 3 },
    daysUntil: 53,
    isPast: false,
    ...overrides,
  };
}

function meta(overrides: Partial<SteamWishlistHeroMeta> = {}): SteamWishlistHeroMeta {
  return {
    appid: 1904610,
    dominantHex: "#8b1e1e",
    shortDescription: "A bleak hunt through a decaying world.",
    steamDeckCompat: 3,
    platformWindows: true,
    platformMac: false,
    platformLinux: false,
    gameRating: {
      type: "ESRB",
      rating: "M",
      descriptors: ["Violence"],
      requiredAge: 17,
      useAgeGate: false,
      imageUrl: null,
    },
    assetTimestamp: 1_776_125_684,
    ...overrides,
  };
}

function renderHero(rel: DayRelease = release()) {
  return render(
    <TooltipPrimitive.Provider>
      <ImminentHero release={rel} />
    </TooltipPrimitive.Provider>
  );
}

beforeEach(() => {
  mockUseHeroMeta.mockReturnValue({ data: meta() });
  mockUseBackdrop.mockReturnValue(undefined);
});

afterEach(() => {
  mockUseHeroMeta.mockReset();
  mockUseBackdrop.mockReset();
  document.body.innerHTML = "";
});

describe("ImminentHero", () => {
  it("renders the masthead as an external link to the store page", () => {
    renderHero();
    const link = screen.getByRole("link", { name: "Beast of Reincarnation" });
    expect(link.getAttribute("href")).toBe("https://store.steampowered.com/app/1904610");
  });

  it("frames the days-until count as the headline beat", () => {
    renderHero(release({ daysUntil: 53 }));
    // CountUp renders its final value immediately in the test env.
    expect(screen.getByText("53")).toBeTruthy();
    expect(screen.getByText(/days/)).toBeTruthy();
  });

  it("collapses tomorrow and today to a word instead of counting to 1 or 0", () => {
    renderHero(release({ daysUntil: 1 }));
    expect(screen.getByText("Out tomorrow")).toBeTruthy();
    document.body.innerHTML = "";
    renderHero(release({ daysUntil: 0 }));
    expect(screen.getByText("Out today")).toBeTruthy();
  });

  it("renders the enriched chrome (platforms, ESRB, blurb) when meta resolves", () => {
    renderHero();
    expect(screen.getByLabelText(/Windows: supported/)).toBeTruthy();
    expect(screen.getByLabelText(/ESRB M rating/)).toBeTruthy();
    expect(screen.getByText("A bleak hunt through a decaying world.")).toBeTruthy();
  });

  it("stays legible before meta loads — name and days-until without enriched chrome", () => {
    mockUseHeroMeta.mockReturnValue({ data: undefined });
    renderHero();
    expect(screen.getByRole("link", { name: "Beast of Reincarnation" })).toBeTruthy();
    expect(screen.getByText("53")).toBeTruthy();
    expect(screen.queryByLabelText(/ESRB/)).toBeNull();
    expect(screen.queryByText("A bleak hunt through a decaying world.")).toBeNull();
  });

  it("leases the page backdrop to the game's art with its cache-bust timestamp", () => {
    renderHero();
    expect(mockUseBackdrop).toHaveBeenCalledWith({
      appid: 1904610,
      assetTimestamp: 1_776_125_684,
    });
  });

  it("has no axe violations", async () => {
    const { container } = renderHero();
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});
