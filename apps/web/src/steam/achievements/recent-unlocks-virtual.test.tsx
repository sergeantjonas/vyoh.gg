import { mainScrollRef } from "@/lib/scroll-container";
import { render, screen } from "@testing-library/react";
import type { SteamRecentUnlock } from "@vyoh/shared";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RecentUnlocksVirtual } from "./recent-unlocks-virtual";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: { children: ReactNode }) => (
    <a {...(props as Record<string, string>)}>{children}</a>
  ),
}));

// Same mock pattern as the library virtualizers — render the full item
// set synchronously so each assertion sees every row + header without
// touching the real intersection / measurement plumbing.
vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: ({
    count,
    estimateSize,
  }: {
    count: number;
    estimateSize: (i: number) => number;
    [key: string]: unknown;
  }) => ({
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({
        index,
        start: index * estimateSize(index),
        key: index,
      })),
    getTotalSize: () =>
      Array.from({ length: count }, (_, i) => estimateSize(i)).reduce((a, b) => a + b, 0),
    measureElement: () => undefined,
  }),
}));

afterEach(() => {
  mainScrollRef.current = null;
});

function unlock(overrides: Partial<SteamRecentUnlock> = {}): SteamRecentUnlock {
  return {
    appid: 440,
    apiName: "FIRST_BLOOD",
    displayName: "First Blood",
    description: "",
    gameName: "Team Fortress 2",
    hidden: false,
    unlockedAt: "2026-05-01T12:00:00Z",
    globalPercent: null,
    ...overrides,
  };
}

describe("RecentUnlocksVirtual", () => {
  it("renders a row per unlock plus one header per month", () => {
    const unlocks = [
      unlock({
        apiName: "A",
        displayName: "A title",
        unlockedAt: "2026-05-10T10:00:00Z",
      }),
      unlock({
        apiName: "B",
        displayName: "B title",
        unlockedAt: "2026-05-02T10:00:00Z",
      }),
      unlock({
        apiName: "C",
        displayName: "C title",
        unlockedAt: "2026-04-20T10:00:00Z",
      }),
    ];
    const { container } = render(<RecentUnlocksVirtual unlocks={unlocks} />);

    // Two month headers — May 2026 and April 2026 — each with its row count.
    expect(screen.getAllByRole("heading").length).toBe(2);

    // All three unlocks rendered.
    expect(screen.getByText("A title")).toBeTruthy();
    expect(screen.getByText("B title")).toBeTruthy();
    expect(screen.getByText("C title")).toBeTruthy();

    // Headers + rows are all absolutely positioned by the virtualizer.
    const positioned = container.querySelectorAll('div[style*="position: absolute"]');
    expect(positioned.length).toBe(5);
  });

  it("renders nothing when the unlock feed is empty", () => {
    const { container } = render(<RecentUnlocksVirtual unlocks={[]} />);
    // The outer relative wrapper still renders, but no header/row items
    // are inside it.
    expect(container.querySelectorAll('div[style*="position: absolute"]').length).toBe(0);
  });
});
