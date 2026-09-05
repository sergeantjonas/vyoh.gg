import { Test } from "@nestjs/testing";
import type { SteamGameRefreshResult } from "@vyoh/shared";
import { describe, expect, it, vi } from "vitest";
import { AuthService } from "../auth/auth.service";
import { SteamGameRefreshController } from "./game-refresh.controller";
import { SteamGameRefreshService } from "./game-refresh.service";

async function buildController(refresh: ReturnType<typeof vi.fn>) {
  const moduleRef = await Test.createTestingModule({
    controllers: [SteamGameRefreshController],
    providers: [
      { provide: SteamGameRefreshService, useValue: { refresh } },
      // `OwnerGuard` injects this; the handler is called directly so the guard
      // never runs. Its presence on the route is owned by conventions.spec.ts.
      { provide: AuthService, useValue: {} },
    ],
  }).compile();
  return moduleRef.get(SteamGameRefreshController);
}

describe("SteamGameRefreshController", () => {
  it("delegates to the refresh service with the parsed appid and returns its result", async () => {
    const result: SteamGameRefreshResult = { ran: false, reason: "already running" };
    const refresh = vi.fn().mockResolvedValue(result);
    const controller = await buildController(refresh);

    await expect(controller.refreshGame({ appid: 1034140 })).resolves.toEqual(result);
    expect(refresh).toHaveBeenCalledExactlyOnceWith(1034140);
  });
});
