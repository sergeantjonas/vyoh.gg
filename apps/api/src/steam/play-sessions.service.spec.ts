import { describe, expect, it } from "vitest";
import { type TransitionInput, computeTransition } from "./play-sessions.service";

const NOW = new Date("2026-05-16T12:00:00.000Z");
const LAST_POLL = new Date("2026-05-16T11:58:00.000Z");

function input(overrides: Partial<TransitionInput>): TransitionInput {
  return {
    openSession: null,
    previous: null,
    next: { appid: null, gameName: null },
    now: NOW,
    ...overrides,
  };
}

describe("computeTransition", () => {
  it("does nothing when no open session and owner still not in a game", () => {
    expect(computeTransition(input({}))).toEqual({ type: "noop" });
  });

  it("does nothing when the open session matches the new appid (still in same game)", () => {
    const action = computeTransition(
      input({
        openSession: { id: "s1", appid: 1030300 },
        previous: { appid: 1030300, lastPolledAt: LAST_POLL },
        next: { appid: 1030300, gameName: "Silksong" },
      })
    );
    expect(action).toEqual({ type: "noop" });
  });

  it("opens a new session on null → X transition", () => {
    const action = computeTransition(
      input({
        previous: { appid: null, lastPolledAt: LAST_POLL },
        next: { appid: 1030300, gameName: "Silksong" },
      })
    );
    expect(action).toEqual({ type: "open", appid: 1030300, name: "Silksong" });
  });

  it("falls back to `App {id}` when next has no gameName", () => {
    const action = computeTransition(
      input({
        next: { appid: 730, gameName: null },
      })
    );
    expect(action).toEqual({ type: "open", appid: 730, name: "App 730" });
  });

  it("closes the open session on X → null using the previous lastPolledAt", () => {
    const action = computeTransition(
      input({
        openSession: { id: "s1", appid: 1030300 },
        previous: { appid: 1030300, lastPolledAt: LAST_POLL },
        next: { appid: null, gameName: null },
      })
    );
    expect(action).toEqual({ type: "close", openId: "s1", endedAt: LAST_POLL });
  });

  it("closes and opens on X → Y, anchoring endedAt to the previous tick", () => {
    const action = computeTransition(
      input({
        openSession: { id: "s1", appid: 730 },
        previous: { appid: 730, lastPolledAt: LAST_POLL },
        next: { appid: 1030300, gameName: "Silksong" },
      })
    );
    expect(action).toEqual({
      type: "closeAndOpen",
      openId: "s1",
      endedAt: LAST_POLL,
      openAppid: 1030300,
      name: "Silksong",
    });
  });

  it("falls back to `now` when the open session doesn't match prior state (orphan)", () => {
    // Open row says appid=999, but the prior player-state row didn't see
    // that appid — desync, so we don't trust the prior lastPolledAt as
    // the "last seen in this game" timestamp.
    const action = computeTransition(
      input({
        openSession: { id: "orphan", appid: 999 },
        previous: { appid: 730, lastPolledAt: LAST_POLL },
        next: { appid: null, gameName: null },
      })
    );
    expect(action).toEqual({ type: "close", openId: "orphan", endedAt: NOW });
  });

  it("falls back to `now` when previous state is missing (fresh DB orphan)", () => {
    const action = computeTransition(
      input({
        openSession: { id: "ghost", appid: 730 },
        previous: null,
        next: { appid: null, gameName: null },
      })
    );
    expect(action).toEqual({ type: "close", openId: "ghost", endedAt: NOW });
  });
});
