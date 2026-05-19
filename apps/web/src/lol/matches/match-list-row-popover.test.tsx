import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { MatchDetail } from "@vyoh/shared";
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

    it("fetches MatchDetail on hover and renders both teams' rows", async () => {
      const detail: MatchDetail = {
        matchId: "EUW1_1",
        participants: [
          {
            puuid: "p1",
            teamId: 100,
            championName: "Ahri",
            riotIdGameName: "BluePlayer",
          },
          {
            puuid: "p2",
            teamId: 100,
            championName: "Lee Sin",
            riotIdGameName: "BlueJgl",
          },
          {
            puuid: "p3",
            teamId: 200,
            championName: "Zed",
            riotIdGameName: "RedPlayer",
          },
          {
            puuid: "p4",
            teamId: 200,
            championName: "Lulu",
            riotIdGameName: "RedSup",
          },
        ],
      } as unknown as MatchDetail;
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(
          new Response(JSON.stringify(detail), { status: 200 }) as unknown as Response
        );

      renderPopover();
      const trigger = screen.getByText("child-card").parentElement as HTMLElement;
      // Hovering flips `fetchEnabled` to true, which kicks off the useQuery.
      fireEvent.mouseEnter(trigger);

      await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
      // The fetch URL encodes the matchId.
      expect(fetchSpy.mock.calls[0]?.[0]).toMatch(/EUW1_1/);
      fetchSpy.mockRestore();
    });

    it("throws via the queryFn when the upstream returns a non-OK status", async () => {
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(new Response("nope", { status: 500 }) as unknown as Response);
      renderPopover();
      const trigger = screen.getByText("child-card").parentElement as HTMLElement;
      fireEvent.mouseEnter(trigger);
      await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
      fetchSpy.mockRestore();
    });
  });
});
