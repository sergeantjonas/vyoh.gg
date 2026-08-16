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
      // and its presence on each route by conventions.spec.ts.
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

  it("hands purge the confirmation separately from the path slug", async () => {
    // The service compares the two. Folding them together here — passing the
    // path slug twice, say — would make the check tautological and leave the
    // one irreversible route in the api effectively unconfirmed.
    const purgeAccount = vi.fn().mockResolvedValue({ slug: "twix" });
    const controller = await buildController({ purgeAccount });

    await controller.purgeLolAccount({ slug: "twix" }, { confirm: "ahri" });

    expect(purgeAccount).toHaveBeenCalledWith("twix", "ahri");
  });

  it("delegates the read without reshaping it", async () => {
    const lol = [{ slug: "ahri" }];
    const controller = await buildController({
      listLolAccounts: vi.fn().mockResolvedValue(lol),
    });

    expect(await controller.listLolAccounts()).toBe(lol);
  });
});
