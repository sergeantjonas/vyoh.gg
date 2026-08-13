import type { ExecutionContext } from "@nestjs/common";
import { UnauthorizedException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { AuthService } from "./auth.service";
import { OwnerGuard } from "./owner.guard";

const owner = { id: 10_808_486, login: "vyoh" };

const contextWithCookie = (cookie: string | undefined): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ headers: { cookie } }) }),
  }) as unknown as ExecutionContext;

const guardWith = (resolveOwner: AuthService["resolveOwner"]) =>
  new OwnerGuard({ resolveOwner } as AuthService);

describe("OwnerGuard", () => {
  it("lets an owner session through", async () => {
    const resolveOwner = vi.fn().mockResolvedValue(owner);
    const guard = guardWith(resolveOwner);

    expect(await guard.canActivate(contextWithCookie("vyoh_session=live-token"))).toBe(
      true
    );
    expect(resolveOwner).toHaveBeenCalledWith("live-token", expect.any(Date));
  });

  it("401s when the service rejects the session", async () => {
    const guard = guardWith(vi.fn().mockResolvedValue(null));

    await expect(
      guard.canActivate(contextWithCookie("vyoh_session=stale-token"))
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("401s when there is no session cookie at all", async () => {
    const resolveOwner = vi.fn().mockResolvedValue(null);
    const guard = guardWith(resolveOwner);

    await expect(guard.canActivate(contextWithCookie(undefined))).rejects.toBeInstanceOf(
      UnauthorizedException
    );
    await expect(guard.canActivate(contextWithCookie("other=1"))).rejects.toBeInstanceOf(
      UnauthorizedException
    );
    expect(resolveOwner).toHaveBeenCalledWith(undefined, expect.any(Date));
  });
});
