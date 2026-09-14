import { describe, expect, it } from "vitest";
import {
  SESSION_UNLOCK_SLACK_MS,
  isUnlockWithin,
  unlocksOffCamera,
  unlocksWithin,
} from "./unlocks-within.ts";

const START = new Date("2026-09-06T11:50:00Z");
const END = new Date("2026-09-06T16:10:00Z");
const DAY = 24 * 60 * 60 * 1000;
const session = { appid: 1, startedAt: START, endedAt: END };

function unlock(appid: number, offsetMs: number, from: Date = START) {
  return { appid, unlockedAt: new Date(from.getTime() + offsetMs) };
}

describe("isUnlockWithin", () => {
  it("accepts an unlock inside the window", () => {
    expect(isUnlockWithin(session, unlock(1, 60 * 60 * 1000))).toBe(true);
  });

  it("accepts an unlock that landed after the last tick, within slack", () => {
    expect(isUnlockWithin(session, unlock(1, SESSION_UNLOCK_SLACK_MS, END))).toBe(true);
    expect(isUnlockWithin(session, unlock(1, SESSION_UNLOCK_SLACK_MS + 1000, END))).toBe(
      false
    );
  });

  it("accepts an unlock just before the first tick, within slack", () => {
    expect(isUnlockWithin(session, unlock(1, -SESSION_UNLOCK_SLACK_MS))).toBe(true);
    expect(isUnlockWithin(session, unlock(1, -SESSION_UNLOCK_SLACK_MS - 1000))).toBe(
      false
    );
  });

  it("never matches across games", () => {
    expect(isUnlockWithin(session, unlock(2, 60 * 60 * 1000))).toBe(false);
  });
});

describe("unlocksWithin", () => {
  it("returns the session's unlocks in unlock order", () => {
    const late = unlock(1, 3 * 60 * 60 * 1000);
    const early = unlock(1, 10 * 60 * 1000);
    expect(
      unlocksWithin(session, [late, unlock(2, 0), early, unlock(1, 9 * 60 * 60 * 1000)])
    ).toEqual([early, late]);
  });
});

describe("unlocksOffCamera", () => {
  it("keeps unlocks no session of that game can claim", () => {
    const seen = unlock(1, 60 * 1000);
    const unseenSameGame = unlock(1, -DAY);
    const otherGame = unlock(2, 60 * 1000);
    expect(unlocksOffCamera([session], [seen, unseenSameGame, otherGame])).toEqual([
      unseenSameGame,
      otherGame,
    ]);
  });

  it("returns everything when there are no sessions", () => {
    const u = unlock(1, 0);
    expect(unlocksOffCamera([], [u])).toEqual([u]);
  });
});
