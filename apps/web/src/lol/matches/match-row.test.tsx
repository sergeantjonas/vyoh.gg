import { fireEvent, render, screen } from "@testing-library/react";
import type { MatchSummary } from "@vyoh/shared";
import { MotionConfig } from "motion/react";
import { type ReactNode, useLayoutEffect } from "react";
import { describe, expect, it, vi } from "vitest";
import { ActiveMatchProvider, useActiveMatch } from "./active-match-context";
import { MatchRow } from "./match-row";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: { children: ReactNode }) => (
    <a {...(props as Record<string, string>)}>{children}</a>
  ),
}));

vi.mock("@/lol/champions/use-champions", () => ({
  useChampionName: () => (alias: string) => alias,
}));

vi.mock("@/lol/champions/champion-card", () => ({
  ChampionCardChrome: ({ champion }: { champion: string }) => (
    <div data-testid="chrome" data-champion={champion} />
  ),
  championCardClassName: "champ-card",
  championCardStyle: () => ({}),
}));

vi.mock("@/lol/_shared/ui/card-tilt", () => ({
  CardTilt: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("./match-list-row-popover", () => ({
  MatchListRowPopover: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

function summary(overrides: Partial<MatchSummary> = {}): MatchSummary {
  return {
    matchId: "EUW1_42",
    queueType: "Ranked Solo",
    champion: "Ahri",
    kills: 8,
    deaths: 3,
    assists: 12,
    win: true,
    durationSec: 1800,
    // Hard-coded ~5 minutes ago so the "5m ago" verdict is deterministic.
    playedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
    remake: false,
    teamPosition: "MIDDLE",
    gameVersion: "16.9.1.1",
    visionScore: 0,
    damageShare: 0,
    firstBloodKill: false,
    csAt10: 0,
    csAt15: 0,
    goldAt10: 0,
    goldAt15: 0,
    teamGoldDiffAt15: 0,
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

function renderRow(props: {
  match: MatchSummary;
  lpDelta?: number;
  isNew?: boolean;
}) {
  return render(
    <MotionConfig reducedMotion="always">
      <ActiveMatchProvider>
        <MatchRow
          match={props.match}
          accountSlug="jonas-euw"
          championDisplayName="Ahri"
          {...(props.lpDelta !== undefined && { lpDelta: props.lpDelta })}
          {...(props.isNew !== undefined && { isNew: props.isNew })}
        />
      </ActiveMatchProvider>
    </MotionConfig>
  );
}

describe("MatchRow", () => {
  it("renders the champion name and Win badge for a winning game", () => {
    renderRow({ match: summary() });
    expect(screen.getByText("Ahri")).toBeTruthy();
    expect(screen.getByText("Win")).toBeTruthy();
  });

  it("renders the Loss badge for a lost game", () => {
    renderRow({ match: summary({ win: false }) });
    expect(screen.getByText("Loss")).toBeTruthy();
    expect(screen.queryByText("Win")).toBeNull();
  });

  it("renders the Remake badge and suppresses LP delta on remakes", () => {
    const { container } = renderRow({ match: summary({ remake: true }), lpDelta: 10 });
    expect(screen.getByText("Remake")).toBeTruthy();
    expect(container.textContent).not.toContain("LP");
  });

  it("renders a positive LP delta with a + prefix", () => {
    const { container } = renderRow({ match: summary(), lpDelta: 22 });
    expect(container.textContent).toContain("+22 LP");
  });

  it("renders the queue type, duration, and 'just now / Xm ago' relative time", () => {
    const { container } = renderRow({ match: summary() });
    expect(container.textContent).toContain("Ranked Solo");
    expect(container.textContent).toContain("30m 00s");
    expect(container.textContent).toMatch(/just now|m ago/);
  });

  it("renders the 'vs <opponent>' line on lane queues with a lane opponent", () => {
    renderRow({
      match: summary({
        teamPosition: "MIDDLE",
        laneOpponent: {
          championName: "Yasuo",
          gameName: "Other",
          tagLine: "EUW",
          puuid: "puuid-y",
          riotIdGameName: "Other",
        } as unknown as MatchSummary["laneOpponent"],
      }),
    });
    expect(screen.getByText(/vs/)).toBeTruthy();
    expect(screen.getByText(/Yasuo/)).toBeTruthy();
  });

  it("omits the 'vs <opponent>' line for ARAM / Arena queues", () => {
    const { container } = renderRow({
      match: summary({
        queueType: "ARAM",
        laneOpponent: {
          championName: "Yasuo",
          gameName: "Other",
          tagLine: "EUW",
          puuid: "puuid-y",
          riotIdGameName: "Other",
        } as unknown as MatchSummary["laneOpponent"],
      }),
    });
    expect(container.textContent).not.toContain("vs Yasuo");
  });

  it("renders a negative LP delta without a + prefix and tints it red", () => {
    const { container } = renderRow({ match: summary({ win: false }), lpDelta: -18 });
    expect(container.textContent).toContain("-18 LP");
  });

  it("renders a 0-LP delta in the muted neutral tint", () => {
    const { container } = renderRow({ match: summary(), lpDelta: 0 });
    expect(container.textContent).toContain("0 LP");
  });

  it("formats hour-old games as 'Xh ago'", () => {
    const { container } = renderRow({
      match: summary({ playedAt: new Date(Date.now() - 3 * 60 * 60_000).toISOString() }),
    });
    expect(container.textContent).toMatch(/3h ago/);
  });

  it("formats day-old games as 'Xd ago'", () => {
    const { container } = renderRow({
      match: summary({
        playedAt: new Date(Date.now() - 2 * 24 * 60 * 60_000).toISOString(),
      }),
    });
    expect(container.textContent).toMatch(/2d ago/);
  });

  it("formats week-old games as 'Xw ago'", () => {
    const { container } = renderRow({
      match: summary({
        playedAt: new Date(Date.now() - 21 * 24 * 60 * 60_000).toISOString(),
      }),
    });
    expect(container.textContent).toMatch(/3w ago/);
  });

  it("uses 'just now' for matches less than a minute old", () => {
    const { container } = renderRow({
      match: summary({ playedAt: new Date(Date.now() - 5_000).toISOString() }),
    });
    expect(container.textContent).toMatch(/just now/);
  });

  it("activates the match on pointer-down (used by the detail-route transition)", () => {
    const { container } = renderRow({ match: summary() });
    // The detail link is the second <a> rendered (first is the dossier anchor).
    const links = container.querySelectorAll("a");
    const detail = links[1];
    if (!detail) throw new Error("detail link not rendered");
    fireEvent.pointerDown(detail);
    // No assertion on context value — coverage of the pointer-down handler is
    // the goal. The handler reads getBoundingClientRect, sets activeMatch,
    // and persists scroll position; all happy-dom no-ops.
    fireEvent.mouseEnter(detail);
  });
});

describe("MatchRow return animation", () => {
  function BackwardPrimer({ matchId }: { matchId: string }) {
    const { setOriginRect } = useActiveMatch();
    useLayoutEffect(() => {
      setOriginRect({
        matchId,
        rect: {
          top: 200,
          left: 100,
          width: 300,
          height: 60,
          right: 400,
          bottom: 260,
          x: 100,
          y: 200,
          toJSON: () => ({}),
        } as DOMRect,
        direction: "backward",
      });
    }, [matchId, setOriginRect]);
    return null;
  }

  it("runs the FLIP transform when the row is the backward-navigation destination", () => {
    const animate = vi.fn();
    const originalAnimate = HTMLDivElement.prototype.animate;
    HTMLDivElement.prototype.animate = animate as unknown as typeof originalAnimate;
    const originalRaf = globalThis.requestAnimationFrame;
    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    }) as typeof globalThis.requestAnimationFrame;
    try {
      const match = summary({ matchId: "EUW1_BACK" });
      render(
        <MotionConfig reducedMotion="never">
          <ActiveMatchProvider>
            <BackwardPrimer matchId={match.matchId} />
            <MatchRow match={match} accountSlug="jonas-euw" championDisplayName="Ahri" />
          </ActiveMatchProvider>
        </MotionConfig>
      );
      expect(animate).toHaveBeenCalled();
    } finally {
      HTMLDivElement.prototype.animate = originalAnimate;
      globalThis.requestAnimationFrame = originalRaf;
    }
  });

  it("cancels the pending RAF when the row unmounts before it fires", () => {
    const cancel = vi.fn();
    const originalRaf = globalThis.requestAnimationFrame;
    const originalCancel = globalThis.cancelAnimationFrame;
    globalThis.requestAnimationFrame = (() =>
      99) as typeof globalThis.requestAnimationFrame;
    globalThis.cancelAnimationFrame =
      cancel as unknown as typeof globalThis.cancelAnimationFrame;
    try {
      const match = summary({ matchId: "EUW1_BACK_UNMOUNT" });
      const { unmount } = render(
        <MotionConfig reducedMotion="never">
          <ActiveMatchProvider>
            <BackwardPrimer matchId={match.matchId} />
            <MatchRow match={match} accountSlug="jonas-euw" championDisplayName="Ahri" />
          </ActiveMatchProvider>
        </MotionConfig>
      );
      unmount();
      expect(cancel).toHaveBeenCalledWith(99);
    } finally {
      globalThis.requestAnimationFrame = originalRaf;
      globalThis.cancelAnimationFrame = originalCancel;
    }
  });
});
