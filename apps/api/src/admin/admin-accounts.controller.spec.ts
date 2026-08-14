import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";
import { AuthService } from "../auth/auth.service";
import { AdminAccountsController } from "./admin-accounts.controller";
import { AdminAccountsService } from "./admin-accounts.service";

async function buildController(stub: Partial<AdminAccountsService> = {}) {
  const moduleRef = await Test.createTestingModule({
    controllers: [AdminAccountsController],
    providers: [
      { provide: AdminAccountsService, useValue: stub },
      // `OwnerGuard` on every route injects this. The tests below call the
      // handlers directly so the guard never runs — it only has to resolve for
      // the module to compile. Guard behaviour is owned by owner.guard.spec.ts,
      // and its presence on all seven routes by conventions.spec.ts.
      { provide: AuthService, useValue: {} },
    ],
  }).compile();
  return moduleRef.get(AdminAccountsController);
}

describe("AdminAccountsController", () => {
  it("passes the slug and body through to the update", async () => {
    const updateLolAccount = vi.fn().mockResolvedValue({ slug: "twix" });
    const controller = await buildController({ updateLolAccount });

    await controller.updateLolAccount({ slug: "twix" }, { hidden: true });

    expect(updateLolAccount).toHaveBeenCalledWith("twix", { hidden: true });
  });

  it("treats force as opt-in — anything but the literal string is a normal delete", async () => {
    const deleteLolAccount = vi.fn().mockResolvedValue({ slug: "twix", matchRows: 0 });
    const controller = await buildController({ deleteLolAccount });

    await controller.deleteLolAccount({ slug: "twix" }, { force: "true" });
    expect(deleteLolAccount).toHaveBeenLastCalledWith("twix", true);

    await controller.deleteLolAccount({ slug: "twix" }, { force: "false" });
    expect(deleteLolAccount).toHaveBeenLastCalledWith("twix", false);

    await controller.deleteLolAccount({ slug: "twix" }, {});
    expect(deleteLolAccount).toHaveBeenLastCalledWith("twix", false);
  });

  it("unwraps the steam id from the route param", async () => {
    const deleteSteamAccount = vi.fn().mockResolvedValue({ steamId64: "1" });
    const controller = await buildController({ deleteSteamAccount });

    await controller.deleteSteamAccount({ steamId64: "76561198000000001" });

    expect(deleteSteamAccount).toHaveBeenCalledWith("76561198000000001");
  });

  it("delegates the reads without reshaping them", async () => {
    const lol = [{ slug: "ahri" }];
    const steam = [{ steamId64: "1" }];
    const controller = await buildController({
      listLolAccounts: vi.fn().mockResolvedValue(lol),
      listSteamAccounts: vi.fn().mockResolvedValue(steam),
    });

    expect(await controller.listLolAccounts()).toBe(lol);
    expect(await controller.listSteamAccounts()).toBe(steam);
  });
});
