import { seedViewer } from "@/auth/mock-viewer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

// The upcoming surfaces now read the curation overlay to mark hidden games, so
// they need a QueryClient. Seeded as a visitor: these specs are about bucketing
// and layout, and the marker's own behaviour is covered in hidden-mark.test.tsx.
function withQueryClient(node: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  seedViewer(client);
  return <QueryClientProvider client={client}>{node}</QueryClientProvider>;
}
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { fireEvent, render, screen } from "@testing-library/react";
import type { SteamUpcomingItem } from "@vyoh/shared";
import { configureAxe } from "jest-axe";
import { afterEach, describe, expect, it } from "vitest";
import type { DayRelease } from "./bucketing";
import { ReleaseCalendar } from "./release-calendar";

const axe = configureAxe({ rules: { "color-contrast": { enabled: false } } });

function item(appid: number): SteamUpcomingItem {
  return {
    appid,
    name: `Game ${appid}`,
    dateAdded: 1_700_000_000,
    source: "wishlist",
    storeUrl: `https://store.steampowered.com/app/${appid}`,
    releaseDate: 1_700_000_000,
    comingSoon: true,
  };
}

function rel(
  appid: number,
  year: number,
  month: number,
  day: number,
  daysUntil: number,
  isPast = false
): DayRelease {
  return { item: item(appid), date: { year, month, day }, daysUntil, isPast };
}

// Midday Brussels on Jun 15, 2026. Default window (Jun + Jul) holds the future
// releases below, so the calendar anchors on June.
const NOW = new Date("2026-06-15T10:00:00Z");

// 3 launches on Jun 24 (busy day + a ≥3 week), a past ghost on Jun 5, one in July.
const RELEASES: DayRelease[] = [
  rel(1, 2026, 5, 24, 9),
  rel(2, 2026, 5, 24, 9),
  rel(3, 2026, 5, 24, 9),
  rel(4, 2026, 5, 5, -10, true),
  rel(5, 2026, 6, 10, 25),
];

function renderCalendar(releases = RELEASES) {
  return render(
    withQueryClient(
      <TooltipPrimitive.Provider>
        <ReleaseCalendar dayReleases={releases} now={NOW} />
      </TooltipPrimitive.Provider>
    )
  );
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("ReleaseCalendar", () => {
  it("renders the anchored two-month window with launch-count mastheads", () => {
    renderCalendar();
    expect(screen.getByRole("heading", { name: "June" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "July" })).toBeTruthy();
    expect(screen.getByText(/4 launches/)).toBeTruthy(); // June: 3 + ghost
    expect(screen.getByText(/1 launch$/)).toBeTruthy(); // July
  });

  it("renders an external capsule link per release", () => {
    renderCalendar();
    const link = screen.getByLabelText("Game 1 on Steam");
    expect(link.getAttribute("href")).toBe("https://store.steampowered.com/app/1");
    expect(link.getAttribute("target")).toBe("_blank");
  });

  it("marks a 3-release day busy and shows the per-week overload chip", () => {
    const { container } = renderCalendar();
    expect(container.querySelector("[data-busy]")).toBeTruthy();
    expect(screen.getByText("3 this week")).toBeTruthy();
  });

  it("marks today and ghosts a past-but-wishlisted release", () => {
    const { container } = renderCalendar();
    expect(container.querySelector("[data-today]")).toBeTruthy();
    expect(screen.getByLabelText("Game 4 on Steam").hasAttribute("data-ghost")).toBe(
      true
    );
  });

  // Mixed provenance is the point of the surface: without a mark, a pre-order and
  // a wishlisted title are indistinguishable tiles.
  it("marks a pre-ordered release and leaves a wishlisted one unmarked", () => {
    const preOrdered: DayRelease = {
      ...rel(9, 2026, 5, 20, 5),
      item: { ...item(9), source: "owned" },
    };
    renderCalendar([rel(1, 2026, 5, 24, 9), preOrdered]);
    expect(screen.getByLabelText("Game 9 on Steam — pre-ordered")).toBeTruthy();
    expect(screen.getByLabelText("Game 1 on Steam")).toBeTruthy();
    expect(screen.getAllByText("Pre-ordered")).toHaveLength(1);
  });

  it("pages the window forward with the next-month control", () => {
    renderCalendar();
    expect(screen.queryByRole("heading", { name: "August" })).toBeNull();
    fireEvent.click(screen.getByLabelText("Next month"));
    expect(screen.getByRole("heading", { name: "August" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "June" })).toBeNull();
  });

  it("has no axe violations", async () => {
    const { container } = renderCalendar();
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});
