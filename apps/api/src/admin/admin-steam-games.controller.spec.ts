import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { AuthService } from "../auth/auth.service";
import { AdminSteamGamesController } from "./admin-steam-games.controller";
import { AdminSteamGamesService } from "./admin-steam-games.service";

async function buildController(stub: Partial<AdminSteamGamesService> = {}) {
  const moduleRef = await Test.createTestingModule({
    controllers: [AdminSteamGamesController],
    providers: [
      { provide: AdminSteamGamesService, useValue: stub },
      // `OwnerGuard` on every route injects this. The handlers are called
      // directly here so the guard never runs — it only has to resolve for the
      // module to compile. Guard behaviour lives in owner.guard.spec.ts and its
      // presence on each route in conventions.spec.ts.
      { provide: AuthService, useValue: {} },
    ],
  }).compile();
  return moduleRef.get(AdminSteamGamesController);
}

describe("AdminSteamGamesController", () => {
  it("passes the appid and body through to the update", async () => {
    const update = vi.fn().mockResolvedValue({ appid: 1091500 });
    const controller = await buildController({ update });

    await controller.update(1091500, { hidden: true, note: "not for the site" });

    expect(update).toHaveBeenCalledWith(1091500, {
      hidden: true,
      note: "not for the site",
    });
  });

  it("delegates the list without reshaping it", async () => {
    const payload = { entries: [{ appid: 570 }], pendingReview: 1 };
    const controller = await buildController({
      list: vi.fn().mockResolvedValue(payload),
    });

    expect(await controller.list()).toBe(payload);
  });

  it("serves the review count from its own route", async () => {
    const reviewCount = vi.fn().mockResolvedValue({ pendingReview: 4 });
    const controller = await buildController({ reviewCount });

    expect(await controller.reviewCount()).toEqual({ pendingReview: 4 });
    expect(reviewCount).toHaveBeenCalledOnce();
  });

  it("forwards the delete", async () => {
    const remove = vi.fn().mockResolvedValue(undefined);
    const controller = await buildController({ remove });

    await controller.remove(570);

    expect(remove).toHaveBeenCalledWith(570);
  });
});
