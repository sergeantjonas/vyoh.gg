import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import {
  SteamPlaySessionsService,
  type TransitionInput,
  computeTransition,
} from "./play-sessions.service";
import type { SteamPlayerUnlocksService } from "./player-unlocks.service";

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
    expect(action).toEqual({
      type: "close",
      openId: "s1",
      closedAppid: 1030300,
      endedAt: LAST_POLL,
    });
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
      closedAppid: 730,
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
    expect(action).toEqual({
      type: "close",
      openId: "orphan",
      closedAppid: 999,
      endedAt: NOW,
    });
  });

  it("falls back to `now` when previous state is missing (fresh DB orphan)", () => {
    const action = computeTransition(
      input({
        openSession: { id: "ghost", appid: 730 },
        previous: null,
        next: { appid: null, gameName: null },
      })
    );
    expect(action).toEqual({
      type: "close",
      openId: "ghost",
      closedAppid: 730,
      endedAt: NOW,
    });
  });
});

describe("SteamPlaySessionsService.recordTransition", () => {
  function makeService(
    opts: {
      openSession?: { id: string; appid: number } | null;
    } = {}
  ) {
    const create = vi.fn().mockResolvedValue({ id: "new" });
    const update = vi.fn().mockResolvedValue({});
    const findFirst = vi.fn().mockResolvedValue(opts.openSession ?? null);
    const $transaction = vi.fn().mockResolvedValue([{}, { id: "new" }]);
    const prisma = {
      steamPlaySession: { create, update, findFirst },
      $transaction,
    } as unknown as PrismaService;
    const refreshUnlocksForGame = vi.fn().mockResolvedValue(undefined);
    const playerUnlocks = {
      refreshUnlocksForGame,
    } as unknown as SteamPlayerUnlocksService;
    return {
      service: new SteamPlaySessionsService(prisma, playerUnlocks),
      create,
      update,
      $transaction,
      refreshUnlocksForGame,
    };
  }

  it("creates a new session row on open", async () => {
    const { service, create } = makeService({ openSession: null });
    await service.recordTransition({
      previous: { appid: null, lastPolledAt: LAST_POLL },
      next: { appid: 1030300, gameName: "Silksong" },
    });
    expect(create).toHaveBeenCalledWith({
      data: { appid: 1030300, gameNameSnapshot: "Silksong" },
    });
  });

  it("is a no-op when computeTransition returns noop", async () => {
    const { service, create, update } = makeService({
      openSession: { id: "s1", appid: 1030300 },
    });
    await service.recordTransition({
      previous: { appid: 1030300, lastPolledAt: LAST_POLL },
      next: { appid: 1030300, gameName: "Silksong" },
    });
    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("closes the open session and fires an unlock refresh on close", async () => {
    const { service, update, refreshUnlocksForGame } = makeService({
      openSession: { id: "s1", appid: 730 },
    });
    await service.recordTransition({
      previous: { appid: 730, lastPolledAt: LAST_POLL },
      next: { appid: null, gameName: null },
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: "s1" },
      data: { endedAt: LAST_POLL },
    });
    // Wait a tick for the fire-and-forget unlock refresh to schedule.
    await new Promise((r) => setTimeout(r, 0));
    expect(refreshUnlocksForGame).toHaveBeenCalledWith(730);
  });

  it("closes then opens within a $transaction on game switch", async () => {
    const { service, $transaction, refreshUnlocksForGame } = makeService({
      openSession: { id: "s1", appid: 730 },
    });
    await service.recordTransition({
      previous: { appid: 730, lastPolledAt: LAST_POLL },
      next: { appid: 1030300, gameName: "Silksong" },
    });
    expect($transaction).toHaveBeenCalledOnce();
    await new Promise((r) => setTimeout(r, 0));
    expect(refreshUnlocksForGame).toHaveBeenCalledWith(730);
  });

  it("swallows unlock refresh errors so the next tick is not blocked", async () => {
    const create = vi.fn().mockResolvedValue({ id: "new" });
    const update = vi.fn().mockResolvedValue({});
    const findFirst = vi.fn().mockResolvedValue({ id: "s1", appid: 730 });
    const prisma = {
      steamPlaySession: { create, update, findFirst },
      $transaction: vi.fn(),
    } as unknown as PrismaService;
    const refreshUnlocksForGame = vi.fn().mockRejectedValue(new Error("boom"));
    const service = new SteamPlaySessionsService(prisma, {
      refreshUnlocksForGame,
    } as unknown as SteamPlayerUnlocksService);
    await service.recordTransition({
      previous: { appid: 730, lastPolledAt: LAST_POLL },
      next: { appid: null, gameName: null },
    });
    // Allow the rejected promise to settle without an unhandled-rejection.
    await new Promise((r) => setTimeout(r, 0));
    expect(refreshUnlocksForGame).toHaveBeenCalledWith(730);
  });
});
