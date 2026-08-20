import type { ExecutionContext } from "@nestjs/common";
import { GUARDS_METADATA, HEADERS_METADATA } from "@nestjs/common/constants";
import { describe, expect, it, vi } from "vitest";
import type { AuthService } from "./auth.service";
import { SESSION_COOKIE } from "./cookies";
import { ViewerGuard, ViewerIsOwner, WithViewer } from "./viewer";

type Req = { headers: { cookie?: string }; viewerIsOwner?: boolean };

function contextFor(request: Req): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function guardWith(resolveOwner: AuthService["resolveOwner"]) {
  return new ViewerGuard({ resolveOwner } as unknown as AuthService);
}

const OWNER = { id: 1, login: "vyoh" };

describe("ViewerGuard", () => {
  it("marks the request when a live owner session resolves", async () => {
    const request: Req = { headers: { cookie: `${SESSION_COOKIE}=tok` } };
    const guard = guardWith(vi.fn().mockResolvedValue(OWNER));

    expect(await guard.canActivate(contextFor(request))).toBe(true);
    expect(request.viewerIsOwner).toBe(true);
  });

  it("marks an anonymous request without rejecting it", async () => {
    const request: Req = { headers: {} };
    const resolveOwner = vi.fn().mockResolvedValue(null);
    const guard = guardWith(resolveOwner);

    expect(await guard.canActivate(contextFor(request))).toBe(true);
    expect(request.viewerIsOwner).toBe(false);
    expect(resolveOwner).toHaveBeenCalledWith(undefined, expect.any(Date));
  });

  // The point of the guard: it annotates, it never gates. A public route that
  // 401'd because the visitor had no cookie would be a regression the type
  // system can't see.
  it("never denies, whatever the session says", async () => {
    for (const resolved of [OWNER, null]) {
      const guard = guardWith(vi.fn().mockResolvedValue(resolved));
      expect(await guard.canActivate(contextFor({ headers: {} }))).toBe(true);
    }
  });

  it("serves the public projection when session lookup throws", async () => {
    const request: Req = { headers: { cookie: `${SESSION_COOKIE}=tok` } };
    const guard = guardWith(vi.fn().mockRejectedValue(new Error("db is gone")));

    expect(await guard.canActivate(contextFor(request))).toBe(true);
    expect(request.viewerIsOwner).toBe(false);
  });

  it("passes the owner's token through to the resolver", async () => {
    const resolveOwner = vi.fn().mockResolvedValue(OWNER);
    const guard = guardWith(resolveOwner);
    await guard.canActivate(
      contextFor({ headers: { cookie: `other=x; ${SESSION_COOKIE}=secret` } })
    );
    expect(resolveOwner).toHaveBeenCalledWith("secret", expect.any(Date));
  });
});

describe("ViewerIsOwner", () => {
  // `createParamDecorator` returns the decorator, not the factory, so the
  // resolver is reached through the metadata Nest stores rather than called
  // directly. Worth the indirection: the default is what keeps a route that
  // forgot `@WithViewer()` serving the public projection instead of throwing.
  function resolve(request: Req): boolean {
    class Probe {
      handler(@ViewerIsOwner() _isOwner: boolean) {}
    }
    const args = Reflect.getMetadata("__routeArguments__", Probe, "handler") as Record<
      string,
      { factory: (data: unknown, ctx: ExecutionContext) => boolean }
    >;
    const entry = Object.values(args)[0];
    if (entry === undefined) throw new Error("param decorator stored no factory");
    return entry.factory(undefined, contextFor(request));
  }

  it("reads what the guard left on the request", () => {
    expect(resolve({ headers: {}, viewerIsOwner: true })).toBe(true);
    expect(resolve({ headers: {}, viewerIsOwner: false })).toBe(false);
  });

  it("is false when the guard never ran, rather than undefined", () => {
    expect(resolve({ headers: {} })).toBe(false);
  });
});

describe("WithViewer", () => {
  class Probe {
    @WithViewer()
    handler() {}
  }

  const descriptor = Object.getOwnPropertyDescriptor(Probe.prototype, "handler");

  it("attaches the viewer guard", () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, descriptor?.value)).toContain(
      ViewerGuard
    );
  });

  // Two viewers get different bytes from one URL. A shared cache holding the
  // owner's copy and serving it to a visitor is the whole failure mode, so the
  // header is part of the contract rather than a nicety.
  it("marks the response uncacheable by anything but the requesting browser", () => {
    const headers = Reflect.getMetadata(HEADERS_METADATA, descriptor?.value) as {
      name: string;
      value: string;
    }[];
    expect(headers).toEqual([{ name: "Cache-Control", value: "private, no-cache" }]);
  });
});
