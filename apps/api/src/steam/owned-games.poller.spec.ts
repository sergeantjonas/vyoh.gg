import { describe, expect, it, vi } from "vitest";
import { SteamOwnedGamesPoller } from "./owned-games.poller";
import type { SteamOwnedGamesService } from "./owned-games.service";

function makePoller() {
  const service = { syncOwnedGames: vi.fn().mockResolvedValue(undefined) };
  return {
    poller: new SteamOwnedGamesPoller(service as unknown as SteamOwnedGamesService),
    service,
  };
}

describe("SteamOwnedGamesPoller.tick", () => {
  it("calls syncOwnedGames on the wrapped service", async () => {
    const { poller, service } = makePoller();
    await poller.tick();
    expect(service.syncOwnedGames).toHaveBeenCalled();
  });

  it("swallows syncOwnedGames errors so the cron keeps firing", async () => {
    const { poller, service } = makePoller();
    service.syncOwnedGames.mockRejectedValueOnce(new Error("steam down"));
    await expect(poller.tick()).resolves.toBeUndefined();
  });

  it("skips an overlapping tick when a previous one is still mid-flight", async () => {
    const { poller, service } = makePoller();
    const release: { fn: (() => void) | null } = { fn: null };
    service.syncOwnedGames.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          release.fn = resolve;
        })
    );
    const first = poller.tick();
    await new Promise((r) => setImmediate(r));
    await poller.tick();
    expect(service.syncOwnedGames).toHaveBeenCalledTimes(1);
    release.fn?.();
    await first;
  });

  it("clears the running flag after a failure so the next tick proceeds", async () => {
    const { poller, service } = makePoller();
    service.syncOwnedGames.mockRejectedValueOnce(new Error("steam down"));
    await poller.tick();
    await poller.tick();
    expect(service.syncOwnedGames).toHaveBeenCalledTimes(2);
  });
});
