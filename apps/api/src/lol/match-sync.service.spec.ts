import { Test } from "@nestjs/testing";
import type { LolAccount } from "@vyoh/shared";
import { describe, expect, it, vi } from "vitest";
import { IdentityService } from "../identity/identity.service";
import { LolService } from "./lol.service";
import { MatchEventsService } from "./match-events.service";
import { MatchSyncService } from "./match-sync.service";

const accountA: LolAccount = {
  slug: "ahri",
  region: "euw1",
  gameName: "Vyoh",
  tagLine: "Ahri",
};
const accountB: LolAccount = {
  slug: "meow",
  region: "euw1",
  gameName: "twtv tifa lol",
  tagLine: "meow",
};

type HeadImpl = (account: LolAccount) => Promise<{ idCount: number; backfilled: number }>;
type HistoricalImpl = (
  account: LolAccount
) => Promise<{ idCount: number; backfilled: number; done: boolean; skipped: boolean }>;

async function makeService(
  syncImpl: HeadImpl,
  accounts: LolAccount[] = [accountA, accountB],
  historicalImpl: HistoricalImpl = async () => ({
    idCount: 0,
    backfilled: 0,
    done: false,
    skipped: true,
  })
) {
  const lol = {
    syncAccountMatches: vi.fn().mockImplementation(syncImpl),
    syncAccountHistorical: vi.fn().mockImplementation(historicalImpl),
  };
  const identity = { getLolAccounts: vi.fn().mockReturnValue(accounts) };
  const events = { emitSyncTick: vi.fn() };
  const moduleRef = await Test.createTestingModule({
    providers: [
      MatchSyncService,
      { provide: LolService, useValue: lol },
      { provide: IdentityService, useValue: identity },
      { provide: MatchEventsService, useValue: events },
    ],
  }).compile();
  return { service: moduleRef.get(MatchSyncService), lol, identity, events };
}

describe("MatchSyncService.syncAll", () => {
  it("calls LolService.syncAccountMatches for every whitelisted account", async () => {
    const { service, lol } = await makeService(async () => ({
      idCount: 20,
      backfilled: 0,
    }));

    await service.syncAll();

    expect(lol.syncAccountMatches).toHaveBeenCalledTimes(2);
    expect(lol.syncAccountMatches).toHaveBeenNthCalledWith(1, accountA);
    expect(lol.syncAccountMatches).toHaveBeenNthCalledWith(2, accountB);
  });

  it("continues to remaining accounts when one fails", async () => {
    const { service, lol } = await makeService(async (account) => {
      if (account.slug === "ahri") throw new Error("riot down");
      return { idCount: 20, backfilled: 2 };
    });

    await service.syncAll();

    // Both accounts still attempted; the second one succeeded.
    expect(lol.syncAccountMatches).toHaveBeenCalledTimes(2);
  });

  it("runs the historical step after a successful head sync", async () => {
    const { service, lol } = await makeService(async () => ({
      idCount: 20,
      backfilled: 0,
    }));

    await service.syncAll();

    // Each account: head + historical.
    expect(lol.syncAccountMatches).toHaveBeenCalledTimes(2);
    expect(lol.syncAccountHistorical).toHaveBeenCalledTimes(2);
    expect(lol.syncAccountHistorical).toHaveBeenNthCalledWith(1, accountA);
    expect(lol.syncAccountHistorical).toHaveBeenNthCalledWith(2, accountB);
  });

  it("skips the historical step when head sync failed for that account", async () => {
    const { service, lol } = await makeService(async (account) => {
      if (account.slug === "ahri") throw new Error("riot down");
      return { idCount: 20, backfilled: 0 };
    });

    await service.syncAll();

    // accountA's head failed — no historical call for it. accountB succeeded
    // — historical still ran. The next account is not blocked.
    expect(lol.syncAccountHistorical).toHaveBeenCalledTimes(1);
    expect(lol.syncAccountHistorical).toHaveBeenCalledWith(accountB);
  });

  it("keeps walking other accounts when one historical step throws", async () => {
    const { service, lol } = await makeService(
      async () => ({ idCount: 20, backfilled: 0 }),
      [accountA, accountB],
      async (account) => {
        if (account.slug === "ahri") throw new Error("riot timeout");
        return { idCount: 5, backfilled: 5, done: true, skipped: false };
      }
    );

    await service.syncAll();

    // Both heads ran, both historicals attempted.
    expect(lol.syncAccountMatches).toHaveBeenCalledTimes(2);
    expect(lol.syncAccountHistorical).toHaveBeenCalledTimes(2);
  });

  it("skips a tick if one is already running", async () => {
    let resolveFirst: () => void = () => {};
    const firstStarted = new Promise<void>((resolve) => {
      resolveFirst = resolve;
    });
    let inFlight: () => void = () => {};
    const blocker = new Promise<void>((resolve) => {
      inFlight = resolve;
    });
    const { service, lol } = await makeService(async () => {
      resolveFirst();
      await blocker;
      return { idCount: 20, backfilled: 0 };
    });

    const first = service.syncAll();
    await firstStarted;

    // Second call kicks off while the first is still running — should bail.
    await service.syncAll();
    expect(lol.syncAccountMatches).toHaveBeenCalledTimes(1);

    inFlight();
    await first;
  });

  it("does nothing on a tick with zero whitelisted accounts", async () => {
    const { service, lol } = await makeService(
      async () => ({ idCount: 0, backfilled: 0 }),
      []
    );

    await service.syncAll();

    expect(lol.syncAccountMatches).not.toHaveBeenCalled();
  });
});
