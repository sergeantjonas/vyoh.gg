import { Test } from "@nestjs/testing";
import type { LolAccount } from "@vyoh/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { IdentityService } from "../identity/identity.service";
import { RiotError } from "../riot/riot.error";
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
  // The cron syncs the paused-excluded subset, never the raw roster.
  const identity = { getSyncableLolAccounts: vi.fn().mockReturnValue(accounts) };
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

// Whatever lands on a tick result is published: `GET /status` serves it in a
// 200 body and the SSE stream re-emits it every two seconds. That path never
// passes Nest's exception filter, which is what masks internals everywhere
// else, so the classification here is the only thing standing between a
// caught error's message and the public internet.
describe("MatchSyncService error classification", () => {
  async function headErrorFor(err: unknown): Promise<string> {
    const { service } = await makeService(async () => {
      throw err;
    });
    await service.syncAll();
    const head = service.getStatus().lastTick?.accounts[0]?.head;
    return head && "error" in head ? head.error : "";
  }

  it("never publishes a Prisma message, which names the database host", async () => {
    const prismaErr = Object.assign(
      new Error("Can't reach database server at `postgres`:`5432`"),
      { code: "P1001" }
    );
    const published = await headErrorFor(prismaErr);

    expect(published).toBe("database P1001");
    expect(published).not.toContain("postgres");
    expect(published).not.toContain("5432");
  });

  // Riot's HTTP status is the useful half and carries nothing private, so it
  // survives classification — a status page that said "sync failed" for every
  // failure would not be worth reading.
  it("keeps the Riot status code", async () => {
    expect(await headErrorFor(new RiotError("upstream said no", 429, "/lol/x"))).toBe(
      "riot 429"
    );
  });

  it("falls back to a fixed label for anything unrecognised", async () => {
    const leaky = new Error("connect ECONNREFUSED 10.0.0.5:5432 while loading /srv/app");
    const published = await headErrorFor(leaky);

    expect(published).toBe("sync failed");
    expect(published).not.toContain("10.0.0.5");
  });
});

describe("MatchSyncService env toggle + lifecycle", () => {
  const originalEnv = process.env.MATCH_SYNC_ENABLED;
  afterEach(() => {
    if (originalEnv === undefined)
      Reflect.deleteProperty(process.env, "MATCH_SYNC_ENABLED");
    else process.env.MATCH_SYNC_ENABLED = originalEnv;
  });

  it("is enabled by default when MATCH_SYNC_ENABLED is unset", async () => {
    Reflect.deleteProperty(process.env, "MATCH_SYNC_ENABLED");
    const { service } = await makeService(async () => ({ idCount: 0, backfilled: 0 }));
    expect(service.getStatus().enabled).toBe(true);
  });

  it("is enabled when MATCH_SYNC_ENABLED is set to a truthy value", async () => {
    process.env.MATCH_SYNC_ENABLED = "true";
    const { service } = await makeService(async () => ({ idCount: 0, backfilled: 0 }));
    expect(service.getStatus().enabled).toBe(true);
  });

  it("is disabled when MATCH_SYNC_ENABLED=false", async () => {
    process.env.MATCH_SYNC_ENABLED = "false";
    const { service, lol } = await makeService(async () => ({
      idCount: 0,
      backfilled: 0,
    }));
    expect(service.getStatus().enabled).toBe(false);
    // syncAll is a no-op while disabled.
    await service.syncAll();
    expect(lol.syncAccountMatches).not.toHaveBeenCalled();
  });

  it("is disabled when MATCH_SYNC_ENABLED=0", async () => {
    process.env.MATCH_SYNC_ENABLED = "0";
    const { service } = await makeService(async () => ({ idCount: 0, backfilled: 0 }));
    expect(service.getStatus().enabled).toBe(false);
  });

  it("setEnabled toggles state and is a no-op when value is unchanged", async () => {
    const { service } = await makeService(async () => ({ idCount: 0, backfilled: 0 }));
    expect(service.getStatus().enabled).toBe(true);
    // Same value — no log path.
    const same = service.setEnabled(true);
    expect(same.enabled).toBe(true);
    // Flip → triggers internal log path.
    const off = service.setEnabled(false);
    expect(off.enabled).toBe(false);
    // Flip back → triggers other log branch.
    const on = service.setEnabled(true);
    expect(on.enabled).toBe(true);
  });

  it("triggerNow refuses while paused", async () => {
    process.env.MATCH_SYNC_ENABLED = "false";
    const { service, lol } = await makeService(async () => ({
      idCount: 0,
      backfilled: 0,
    }));
    const result = service.triggerNow();
    expect(result.triggered).toBe(false);
    expect(result.reason).toBe("paused");
    expect(lol.syncAccountMatches).not.toHaveBeenCalled();
  });

  it("triggerNow refuses when a tick is already running", async () => {
    let release: () => void = () => {};
    const blocker = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { service } = await makeService(async () => {
      await blocker;
      return { idCount: 0, backfilled: 0 };
    });
    const firstRun = service.syncAll();
    // give the in-flight flag a tick to flip
    await Promise.resolve();
    const result = service.triggerNow();
    expect(result.triggered).toBe(false);
    expect(result.reason).toBe("already running");
    release();
    await firstRun;
  });

  it("triggerNow fires syncAll when enabled and idle", async () => {
    const { service, lol } = await makeService(async () => ({
      idCount: 0,
      backfilled: 0,
    }));
    const result = service.triggerNow();
    expect(result.triggered).toBe(true);
    // syncAll is awaited internally — flush the microtask queue so the mock has time to run.
    await new Promise((r) => setTimeout(r, 0));
    expect(lol.syncAccountMatches).toHaveBeenCalled();
  });

  it("onApplicationBootstrap returns early when disabled", async () => {
    process.env.MATCH_SYNC_ENABLED = "false";
    const { service, lol } = await makeService(async () => ({
      idCount: 0,
      backfilled: 0,
    }));
    service.onApplicationBootstrap();
    await new Promise((r) => setTimeout(r, 0));
    expect(lol.syncAccountMatches).not.toHaveBeenCalled();
  });

  it("onApplicationBootstrap fires syncAll when enabled and swallows rejections", async () => {
    const { service, lol } = await makeService(async () => {
      throw new Error("riot boom");
    });
    service.onApplicationBootstrap();
    // Wait a microtask cycle for the fire-and-forget catch to settle.
    await new Promise((r) => setTimeout(r, 0));
    expect(lol.syncAccountMatches).toHaveBeenCalled();
  });
});
