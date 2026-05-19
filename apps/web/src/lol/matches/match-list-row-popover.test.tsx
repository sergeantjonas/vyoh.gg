import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MatchListRowPopover } from "./match-list-row-popover";

vi.mock("@/lol/_shared/assets/champion-square-icon", () => ({
  ChampionSquareIcon: ({ championName }: { championName: string }) => (
    <span data-icon={championName} />
  ),
}));

function makeClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
}

function mockMatchMedia(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

function renderPopover(matchId = "EUW1_1") {
  return render(
    <QueryClientProvider client={makeClient()}>
      <TooltipPrimitive.Provider>
        <MatchListRowPopover matchId={matchId} userChampion="Ahri">
          <button type="button">child-card</button>
        </MatchListRowPopover>
      </TooltipPrimitive.Provider>
    </QueryClientProvider>
  );
}

const originalMatchMedia = window.matchMedia;
afterEach(() => {
  window.matchMedia = originalMatchMedia;
  vi.restoreAllMocks();
});

describe("MatchListRowPopover", () => {
  describe("when the device cannot hover", () => {
    beforeEach(() => mockMatchMedia(false));

    it("renders children directly without wrapping in a tooltip trigger", () => {
      renderPopover();
      expect(screen.getByText("child-card")).toBeTruthy();
      expect(document.querySelector("[data-state]")).toBeNull();
    });
  });

  describe("when the device can hover", () => {
    beforeEach(() => mockMatchMedia(true));

    it("wraps the child in a Radix tooltip trigger but does not fetch until hover", () => {
      renderPopover();
      expect(screen.getByText("child-card")).toBeTruthy();
      // Tooltip content is portaled only when open — closed state means no participant rows.
      expect(document.querySelector('[data-state="instant-open"]')).toBeNull();
    });

    it("does not eagerly mount any participant rows in the closed state", () => {
      renderPopover();
      // No fetch was made yet, so the SkeletonRows aren't rendered either.
      const icons = document.querySelectorAll("[data-icon]");
      expect(icons.length).toBe(0);
    });
  });
});
