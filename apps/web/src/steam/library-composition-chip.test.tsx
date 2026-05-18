import { render, screen } from "@testing-library/react";
import type { SteamLibrarySummary } from "@vyoh/shared";
import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LibraryCompositionChip } from "./library-composition-chip";
import { useSteamLibrarySummary } from "./use-library-summary";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: { children: ReactNode }) => <a {...props}>{children}</a>,
}));

vi.mock("./use-library-summary", () => ({
  useSteamLibrarySummary: vi.fn(),
}));

type HookReturn = {
  data: SteamLibrarySummary | undefined;
  isPending: boolean;
  isError: boolean;
};

function mockHook(value: HookReturn): void {
  vi.mocked(useSteamLibrarySummary).mockReturnValue(
    value as unknown as ReturnType<typeof useSteamLibrarySummary>
  );
}

function renderChip() {
  return render(
    <MotionConfig reducedMotion="always">
      <LibraryCompositionChip />
    </MotionConfig>
  );
}

afterEach(() => {
  vi.mocked(useSteamLibrarySummary).mockReset();
});

describe("LibraryCompositionChip", () => {
  it("renders a loading verdict while the query is pending", () => {
    mockHook({ data: undefined, isPending: true, isError: false });
    renderChip();
    expect(screen.getByText("Loading library composition…")).toBeTruthy();
  });

  it("renders an unavailable verdict on error", () => {
    mockHook({ data: undefined, isPending: false, isError: true });
    renderChip();
    expect(
      screen.getByText("Library composition is unavailable right now.")
    ).toBeTruthy();
  });

  it("renders a first-poll empty state when ownedCount is 0", () => {
    mockHook({
      data: {
        ownedCount: 0,
        everLaunchedCount: 0,
        untouchedCount: 0,
        lastSyncedAt: null,
      },
      isPending: false,
      isError: false,
    });
    renderChip();
    expect(
      screen.getByText(/Library hasn't synced yet — first poll lands at 04:00/)
    ).toBeTruthy();
  });

  it("renders the prescription about untouched titles when untouchedCount > 0", () => {
    mockHook({
      data: {
        ownedCount: 120,
        everLaunchedCount: 90,
        untouchedCount: 30,
        lastSyncedAt: "2026-05-19T00:00:00Z",
      },
      isPending: false,
      isError: false,
    });
    renderChip();
    expect(screen.getByText("120 games owned, 90 ever launched.")).toBeTruthy();
    expect(
      screen.getByText(
        "30 still untouched — the backlog inside the library, not the wishlist."
      )
    ).toBeTruthy();
  });

  it("renders the 'every owned title opened' prescription when untouchedCount is 0", () => {
    mockHook({
      data: {
        ownedCount: 50,
        everLaunchedCount: 50,
        untouchedCount: 0,
        lastSyncedAt: "2026-05-19T00:00:00Z",
      },
      isPending: false,
      isError: false,
    });
    renderChip();
    expect(
      screen.getByText("Every owned title has been opened at least once.")
    ).toBeTruthy();
  });
});
