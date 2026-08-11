import { render, screen } from "@testing-library/react";
import type { SteamUpcoming, SteamUpcomingItem } from "@vyoh/shared";
import { configureAxe } from "jest-axe";
import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UpcomingChip } from "./upcoming-chip";
import { useSteamUpcoming } from "./use-upcoming";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: { children: ReactNode }) => <a {...props}>{children}</a>,
}));

vi.mock("./use-upcoming", () => ({
  useSteamUpcoming: vi.fn(),
}));

type HookReturn = {
  data: SteamUpcoming | undefined;
  isPending: boolean;
  isError: boolean;
};

function mockHook(value: HookReturn): void {
  vi.mocked(useSteamUpcoming).mockReturnValue(
    value as unknown as ReturnType<typeof useSteamUpcoming>
  );
}

function resolved(items: SteamUpcomingItem[]): HookReturn {
  return {
    data: { steamId: "x", items, fetchedAt: 0 },
    isPending: false,
    isError: false,
  };
}

function makeItem(overrides: Partial<SteamUpcomingItem> = {}): SteamUpcomingItem {
  return {
    appid: 1,
    name: "Test Game",
    dateAdded: 1_577_836_800, // 2020-01-01
    source: "wishlist",
    storeUrl: "https://store.steampowered.com/app/1",
    releaseDate: null,
    comingSoon: true,
    ...overrides,
  };
}

/** A release `days` out from the faked now, at noon UTC to dodge any day-shift. */
function inDays(days: number): number {
  return Math.floor(Date.UTC(2026, 0, 15 + days, 12) / 1_000);
}

function renderChip() {
  return render(
    <MotionConfig reducedMotion="always">
      <UpcomingChip />
    </MotionConfig>
  );
}

// color-contrast needs real computed styles; aria-hidden-focus is a Radix false
// positive under happy-dom. Same configuration as the other Steam scans.
const axe = configureAxe({
  rules: {
    "color-contrast": { enabled: false },
    "aria-hidden-focus": { enabled: false },
  },
});

// Fake only Date so the chip's `useMemo(() => new Date())` reads a fixed today;
// leave rAF/timers real for Motion.
function withFixedToday(run: () => void): void {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-01-15T12:00:00Z"));
  try {
    run();
  } finally {
    vi.useRealTimers();
  }
}

afterEach(() => {
  vi.mocked(useSteamUpcoming).mockReset();
  document.body.innerHTML = "";
});

describe("UpcomingChip", () => {
  it("renders the loading state while pending", () => {
    mockHook({ data: undefined, isPending: true, isError: false });
    renderChip();
    expect(screen.getByText("Loading upcoming releases…")).toBeTruthy();
  });

  it("renders an unavailable verdict on error", () => {
    mockHook({ data: undefined, isPending: false, isError: true });
    renderChip();
    expect(screen.getByText("Upcoming releases are unavailable right now.")).toBeTruthy();
  });

  it("renders the empty verdict when nothing unreleased is tracked", () => {
    mockHook(resolved([]));
    renderChip();
    expect(screen.getByText("Nothing unreleased is being tracked.")).toBeTruthy();
  });

  it("leads with the nearest dated release", () => {
    withFixedToday(() => {
      mockHook(
        resolved([
          makeItem({ appid: 10, name: "Soon", releaseDate: inDays(9) }),
          makeItem({ appid: 11, name: "Later", releaseDate: inDays(54) }),
        ])
      );
      renderChip();
      expect(screen.getByText("Next up: Soon, in 9 days.")).toBeTruthy();
    });
  });

  // The reported bug's own case: the nearest release is one the wishlist cannot
  // hold, because buying it is what removed it. The card both names it and says
  // what it is — a purchase already made, not a want.
  it("names a pre-ordered release and frames it as already bought", () => {
    withFixedToday(() => {
      mockHook(
        resolved([
          makeItem({ appid: 10, name: "Wishlisted", releaseDate: inDays(15) }),
          makeItem({
            appid: 11,
            name: "Pre-ordered",
            source: "owned",
            releaseDate: inDays(5),
          }),
        ])
      );
      renderChip();
      expect(screen.getByText("Already yours: Pre-ordered, in 5 days.")).toBeTruthy();
    });
  });

  it("counts the whole tracked set, both provenances", () => {
    withFixedToday(() => {
      mockHook(
        resolved([
          makeItem({ appid: 10, name: "A", releaseDate: inDays(9) }),
          makeItem({ appid: 11, name: "B", source: "owned", releaseDate: inDays(20) }),
          makeItem({ appid: 12, name: "C" }),
        ])
      );
      renderChip();
      expect(screen.getByText("3 releases")).toBeTruthy();
    });
  });

  it("falls back to the longest-waiting TBA title when nothing is dated", () => {
    withFixedToday(() => {
      mockHook(
        resolved([
          makeItem({ appid: 20, name: "Newer TBA", dateAdded: 1_700_000_000 }),
          makeItem({ appid: 21, name: "Oldest TBA", dateAdded: 1_400_000_000 }),
        ])
      );
      renderChip();
      expect(screen.getByText("Still waiting on Oldest TBA.")).toBeTruthy();
    });
  });

  // Every tier of the picker needs a date inside 90 days or a TBA title. A set of
  // nothing but far coarse dates satisfies neither, and the card still has to say
  // something true.
  it("states the empty horizon when the set has a count but no fact", () => {
    withFixedToday(() => {
      // Dec 31 is the year-precision placeholder shape, so this is neither
      // day-precise nor TBA.
      mockHook(
        resolved([
          makeItem({
            appid: 30,
            name: "Someday",
            releaseDate: Math.floor(Date.UTC(2027, 11, 31, 0) / 1_000),
          }),
        ])
      );
      renderChip();
      expect(screen.getByText("Nothing lands in the next 90 days.")).toBeTruthy();
      expect(screen.getByText("1 release")).toBeTruthy();
    });
  });

  it("sends both its links to the timeline route", () => {
    withFixedToday(() => {
      mockHook(resolved([makeItem({ appid: 10, name: "Soon", releaseDate: inDays(9) })]));
      const { container } = renderChip();
      const targets = [...container.querySelectorAll("a")].map((a) =>
        a.getAttribute("to")
      );

      expect(targets.length).toBe(2);
      expect(new Set(targets)).toEqual(new Set(["/steam/upcoming"]));
    });
  });

  it("has no axe violations", async () => {
    let container!: HTMLElement;
    withFixedToday(() => {
      mockHook(resolved([makeItem({ appid: 10, name: "Soon", releaseDate: inDays(9) })]));
      container = renderChip().container;
    });
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});
