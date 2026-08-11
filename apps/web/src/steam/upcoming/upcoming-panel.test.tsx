import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { render, screen } from "@testing-library/react";
import type { SteamUpcoming, SteamUpcomingItem } from "@vyoh/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UpcomingPanel } from "./upcoming-panel";

const { mockUseUpcoming } = vi.hoisted(() => ({ mockUseUpcoming: vi.fn() }));
vi.mock("@/steam/use-upcoming", () => ({ useSteamUpcoming: mockUseUpcoming }));
// Stub the hero — its backdrop lease + meta fetch are exercised in
// imminent-hero.test.tsx; here we only assert the panel wires it in.
vi.mock("@/steam/upcoming/imminent-hero", () => ({
  ImminentHero: ({ release }: { release: { item: { name: string | null } } }) => (
    <div data-testid="imminent-hero">{release.item.name}</div>
  ),
}));

function item(overrides: Partial<SteamUpcomingItem>): SteamUpcomingItem {
  return {
    appid: 1,
    name: "Game 1",
    dateAdded: 1_700_000_000,
    source: "wishlist",
    storeUrl: "https://store.steampowered.com/app/1",
    releaseDate: null,
    comingSoon: true,
    ...overrides,
  };
}

function upcoming(items: SteamUpcomingItem[]): SteamUpcoming {
  return { steamId: "1", items, fetchedAt: 1_700_000_000 };
}

function renderPanel() {
  return render(
    <TooltipPrimitive.Provider>
      <UpcomingPanel />
    </TooltipPrimitive.Provider>
  );
}

afterEach(() => {
  mockUseUpcoming.mockReset();
  document.body.innerHTML = "";
});

describe("UpcomingPanel", () => {
  it("renders the calendar/band skeleton while pending", () => {
    mockUseUpcoming.mockReturnValue({ data: undefined, isPending: true, isError: false });
    const { container } = renderPanel();
    expect(container.querySelector(".animate-shimmer")).toBeTruthy();
  });

  it("renders an error message on failure", () => {
    mockUseUpcoming.mockReturnValue({ data: undefined, isPending: false, isError: true });
    renderPanel();
    expect(screen.getByText(/unavailable right now/)).toBeTruthy();
  });

  it("shows the empty state when nothing is upcoming", () => {
    // Only already-released titles → every bucket is empty.
    mockUseUpcoming.mockReturnValue({
      data: upcoming([item({ comingSoon: false, releaseDate: 1_600_000_000 })]),
      isPending: false,
      isError: false,
    });
    renderPanel();
    expect(screen.getByText("Nothing on the horizon")).toBeTruthy();
  });

  it("leads with the imminent hero when a day-precise release is near", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T12:00:00Z"));
    mockUseUpcoming.mockReturnValue({
      data: upcoming([
        item({
          appid: 7,
          name: "Near Game",
          comingSoon: true,
          // Jun 25, 2026 — ~10 days out, day-precise (not a quarter/year placeholder).
          releaseDate: Math.floor(Date.UTC(2026, 5, 25, 12, 0, 0) / 1000),
        }),
      ]),
      isPending: false,
      isError: false,
    });
    renderPanel();
    expect(screen.getByTestId("imminent-hero").textContent).toBe("Near Game");
    vi.useRealTimers();
  });

  it("renders bands without a calendar when there are no day-precise releases", () => {
    mockUseUpcoming.mockReturnValue({
      data: upcoming([item({ appid: 1, releaseDate: null })]), // TBA only
      isPending: false,
      isError: false,
    });
    renderPanel();
    expect(screen.getByRole("heading", { name: "Still TBA" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Game 1" })).toBeTruthy();
    // Sparse-state gate: no calendar means no month-nav controls.
    expect(screen.queryByLabelText("Previous month")).toBeNull();
  });
});
