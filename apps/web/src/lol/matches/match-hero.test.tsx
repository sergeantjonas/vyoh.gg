import { render, screen } from "@testing-library/react";
import type { MatchSummary } from "@vyoh/shared";
import { MotionConfig } from "motion/react";
import { useLayoutEffect } from "react";
import { describe, expect, it, vi } from "vitest";
import { ActiveMatchProvider, useActiveMatch } from "./active-match-context";
import { MatchHero } from "./match-hero";

vi.mock("@/lol/champions/use-champions", () => ({
  useChampionName: () => (alias: string) => alias,
}));

vi.mock("@/lol/champions/champion-card", () => ({
  ChampionCardChrome: ({ champion }: { champion: string }) => (
    <div data-testid="chrome" data-champion={champion} />
  ),
  championCardBaseClassName: "champ-card",
  championCardStyle: () => ({}),
}));

function summary(overrides: Partial<MatchSummary> = {}): MatchSummary {
  return {
    matchId: "EUW1_1",
    queueType: "Ranked Solo",
    champion: "Ahri",
    kills: 5,
    deaths: 2,
    assists: 7,
    win: true,
    durationSec: 1800,
    playedAt: "2026-01-15T18:30:00Z",
    remake: false,
    teamPosition: "MIDDLE",
    gameVersion: "16.9.1.1",
    visionScore: 20,
    damageShare: 0.25,
    firstBloodKill: false,
    csAt10: 80,
    csAt15: 120,
    goldAt10: 4000,
    goldAt15: 6000,
    teamGoldDiffAt15: 200,
    deathTimings: [],
    deathXs: [],
    deathYs: [],
    killTimings: [],
    killXs: [],
    killYs: [],
    laneOpponent: null,
    ...overrides,
  };
}

function renderHero(s: MatchSummary, lpDelta?: number) {
  return render(
    <MotionConfig reducedMotion="always">
      <ActiveMatchProvider>
        <MatchHero summary={s} {...(lpDelta !== undefined && { lpDelta })} />
      </ActiveMatchProvider>
    </MotionConfig>
  );
}

describe("MatchHero", () => {
  it("renders the champion name, Win badge, and KDA for a winning game", () => {
    renderHero(summary());
    expect(screen.getByText("Ahri")).toBeTruthy();
    expect(screen.getByText("Win")).toBeTruthy();
    expect(screen.getByText("5")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByText("7")).toBeTruthy();
  });

  it("renders the Loss badge for a lost game", () => {
    renderHero(summary({ win: false }));
    expect(screen.getByText("Loss")).toBeTruthy();
    expect(screen.queryByText("Win")).toBeNull();
  });

  it("renders the Remake badge and hides the LP delta on remakes", () => {
    renderHero(summary({ remake: true }), 12);
    expect(screen.getByText("Remake")).toBeTruthy();
    expect(screen.queryByText(/LP/)).toBeNull();
  });

  it("renders the LP delta with a + sign when positive", () => {
    const { container } = renderHero(summary(), 15);
    expect(container.textContent).toContain("+15 LP");
  });

  it("renders the LP delta without a synthesized + when negative", () => {
    const { container } = renderHero(summary({ win: false }), -18);
    expect(container.textContent).toContain("-18 LP");
    expect(container.textContent).not.toContain("+");
  });

  it("renders the queue type and a formatted duration in the meta row", () => {
    const { container } = renderHero(summary());
    expect(container.textContent).toContain("Ranked Solo");
    expect(container.textContent).toContain("30m 00s");
  });
});

describe("MatchHero entrance animation", () => {
  function OriginPrimer({ matchId }: { matchId: string }) {
    const { setOriginRect } = useActiveMatch();
    useLayoutEffect(() => {
      setOriginRect({
        matchId,
        rect: {
          top: 100,
          left: 50,
          width: 200,
          height: 80,
          right: 250,
          bottom: 180,
          x: 50,
          y: 100,
          toJSON: () => ({}),
        } as DOMRect,
        direction: "forward",
      });
    }, [matchId, setOriginRect]);
    return null;
  }

  function renderHeroWithOrigin(s: MatchSummary) {
    return render(
      <MotionConfig reducedMotion="never">
        <ActiveMatchProvider>
          <OriginPrimer matchId={s.matchId} />
          <MatchHero summary={s} />
        </ActiveMatchProvider>
      </MotionConfig>
    );
  }

  it("runs the FLIP transform when origin matches and motion is enabled", async () => {
    const animate = vi.fn();
    const originalAnimate = HTMLDivElement.prototype.animate;
    HTMLDivElement.prototype.animate = animate as unknown as typeof originalAnimate;
    const originalRaf = globalThis.requestAnimationFrame;
    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    }) as typeof globalThis.requestAnimationFrame;
    try {
      renderHeroWithOrigin(summary({ matchId: "EUW1_FLIP" }));
      expect(animate).toHaveBeenCalled();
      const args = animate.mock.calls[0] as unknown as [
        Keyframe[],
        KeyframeAnimationOptions,
      ];
      expect(args[1].duration).toBe(550);
    } finally {
      HTMLDivElement.prototype.animate = originalAnimate;
      globalThis.requestAnimationFrame = originalRaf;
    }
  });

  it("skips the animation when the origin matchId differs", () => {
    function MismatchPrimer() {
      const { setOriginRect } = useActiveMatch();
      useLayoutEffect(() => {
        setOriginRect({
          matchId: "DIFFERENT",
          rect: { top: 0, left: 0, width: 1, height: 1 } as DOMRect,
          direction: "forward",
        });
      }, [setOriginRect]);
      return null;
    }
    const animate = vi.fn();
    const originalAnimate = HTMLDivElement.prototype.animate;
    HTMLDivElement.prototype.animate = animate as unknown as typeof originalAnimate;
    try {
      render(
        <MotionConfig reducedMotion="never">
          <ActiveMatchProvider>
            <MismatchPrimer />
            <MatchHero summary={summary({ matchId: "EUW1_HERO" })} />
          </ActiveMatchProvider>
        </MotionConfig>
      );
      expect(animate).not.toHaveBeenCalled();
    } finally {
      HTMLDivElement.prototype.animate = originalAnimate;
    }
  });

  it("skips the animation when origin direction is backward", () => {
    function BackwardPrimer({ matchId }: { matchId: string }) {
      const { setOriginRect } = useActiveMatch();
      useLayoutEffect(() => {
        setOriginRect({
          matchId,
          rect: { top: 0, left: 0, width: 1, height: 1 } as DOMRect,
          direction: "backward",
        });
      }, [matchId, setOriginRect]);
      return null;
    }
    const animate = vi.fn();
    const originalAnimate = HTMLDivElement.prototype.animate;
    HTMLDivElement.prototype.animate = animate as unknown as typeof originalAnimate;
    try {
      render(
        <MotionConfig reducedMotion="never">
          <ActiveMatchProvider>
            <BackwardPrimer matchId="EUW1_BACK" />
            <MatchHero summary={summary({ matchId: "EUW1_BACK" })} />
          </ActiveMatchProvider>
        </MotionConfig>
      );
      expect(animate).not.toHaveBeenCalled();
    } finally {
      HTMLDivElement.prototype.animate = originalAnimate;
    }
  });

  it("cancels the pending RAF on unmount before it fires", () => {
    const cancel = vi.fn();
    const originalRaf = globalThis.requestAnimationFrame;
    const originalCancel = globalThis.cancelAnimationFrame;
    globalThis.requestAnimationFrame = (() =>
      42) as typeof globalThis.requestAnimationFrame;
    globalThis.cancelAnimationFrame =
      cancel as unknown as typeof globalThis.cancelAnimationFrame;
    try {
      const { unmount } = renderHeroWithOrigin(summary({ matchId: "EUW1_UNMOUNT" }));
      unmount();
      expect(cancel).toHaveBeenCalledWith(42);
    } finally {
      globalThis.requestAnimationFrame = originalRaf;
      globalThis.cancelAnimationFrame = originalCancel;
    }
  });
});
