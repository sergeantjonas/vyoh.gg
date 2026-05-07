import { Test } from "@nestjs/testing";
import type { LolAccount } from "@vyoh/shared";
import { describe, expect, it, vi } from "vitest";
import { IdentityService } from "../identity/identity.service";
import { LolService } from "./lol.service";
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

async function makeService(
  syncImpl: (account: LolAccount) => Promise<{ idCount: number; backfilled: number }>,
  accounts: LolAccount[] = [accountA, accountB]
) {
  const lol = { syncAccountMatches: vi.fn().mockImplementation(syncImpl) };
  const identity = { getLolAccounts: vi.fn().mockReturnValue(accounts) };
  const moduleRef = await Test.createTestingModule({
    providers: [
      MatchSyncService,
      { provide: LolService, useValue: lol },
      { provide: IdentityService, useValue: identity },
    ],
  }).compile();
  return { service: moduleRef.get(MatchSyncService), lol, identity };
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
