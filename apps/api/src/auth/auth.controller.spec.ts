import { Test } from "@nestjs/testing";
import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { AUTH_CONFIG, type AuthConfig } from "./auth.config";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { SESSION_COOKIE, STATE_COOKIE } from "./cookies";
import { signState } from "./oauth-state";

const OWNER_ID = 10_808_486;
const SECRET = "hmac-key";

const config: AuthConfig = {
  ownerGithubUserId: OWNER_ID,
  clientId: "client-id",
  clientSecret: "client-secret",
  sessionSecret: SECRET,
  cookieDomain: undefined,
  webOrigin: "http://web.test",
  secureCookies: false,
};

const owner = { id: OWNER_ID, login: "vyoh" };

type FakeResponse = Response & {
  cookies: { name: string; value: string }[];
  cleared: string[];
  redirectedTo: string | null;
  statusCode: number | null;
};

function fakeResponse(): FakeResponse {
  const res = {
    cookies: [] as { name: string; value: string }[],
    cleared: [] as string[],
    redirectedTo: null as string | null,
    statusCode: null as number | null,
    cookie(name: string, value: string) {
      res.cookies.push({ name, value });
      return res;
    },
    clearCookie(name: string) {
      res.cleared.push(name);
      return res;
    },
    redirect(url: string) {
      res.redirectedTo = url;
    },
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    end() {
      return res;
    },
  };
  return res as unknown as FakeResponse;
}

const request = (cookie?: string): Request => ({ headers: { cookie } }) as Request;

const cookieValue = (res: FakeResponse, name: string): string | undefined =>
  res.cookies.find((c) => c.name === name)?.value;

async function build(auth: Partial<AuthService>) {
  const moduleRef = await Test.createTestingModule({
    controllers: [AuthController],
    providers: [
      { provide: AuthService, useValue: auth },
      { provide: AUTH_CONFIG, useValue: config },
    ],
  }).compile();
  return moduleRef.get(AuthController);
}

const defaults = (): Partial<AuthService> => ({
  authorizeUrl: (state: string) =>
    `https://github.com/login/oauth/authorize?state=${state}`,
  exchangeCode: vi.fn().mockResolvedValue(owner),
  isOwner: (identity: { id: number }) => identity.id === OWNER_ID,
  createSession: vi
    .fn()
    .mockResolvedValue({ token: "fresh-token", expiresAt: new Date() }),
  revokeSession: vi.fn().mockResolvedValue(undefined),
  resolveOwner: vi.fn().mockResolvedValue(null),
});

/** Walk the login redirect to recover the state token the controller minted. */
function startLogin(controller: AuthController, next?: string) {
  const res = fakeResponse();
  controller.login(next === undefined ? {} : { next }, res);
  const state = new URL(res.redirectedTo ?? "").searchParams.get("state") ?? "";
  return { res, state, nonce: cookieValue(res, STATE_COOKIE) ?? "" };
}

describe("GET /auth/github/login", () => {
  it("sets a state cookie and redirects to GitHub with the matching nonce", async () => {
    const controller = await build(defaults());
    const { res, state, nonce } = startLogin(controller, "/lol/ahri");

    expect(res.redirectedTo).toContain("https://github.com/login/oauth/authorize");
    expect(nonce).not.toBe("");
    const claims = JSON.parse(
      Buffer.from(state.split(".")[0] ?? "", "base64url").toString("utf8")
    );
    expect(claims.nonce).toBe(nonce);
    expect(claims.next).toBe("/lol/ahri");
  });

  it("clamps an off-site next to the default", async () => {
    const controller = await build(defaults());
    const { state } = startLogin(controller, "//evil.example");

    const claims = JSON.parse(
      Buffer.from(state.split(".")[0] ?? "", "base64url").toString("utf8")
    );
    expect(claims.next).toBe("/status");
  });
});

describe("GET /auth/github/callback", () => {
  it("mints a session and redirects to the requested path", async () => {
    const auth = defaults();
    const controller = await build(auth);
    const { state, nonce } = startLogin(controller, "/status");

    const res = fakeResponse();
    await controller.callback(
      { code: "abc", state },
      request(`${STATE_COOKIE}=${nonce}`),
      res
    );

    expect(cookieValue(res, SESSION_COOKIE)).toBe("fresh-token");
    expect(res.redirectedTo).toBe("http://web.test/status");
    // One-shot: the state cookie must not survive to be replayed.
    expect(res.cleared).toContain(STATE_COOKIE);
  });

  it("refuses a state token whose nonce does not match the browser's cookie", async () => {
    const auth = defaults();
    const controller = await build(auth);
    const { state } = startLogin(controller);

    const res = fakeResponse();
    // A signed state token is not enough — this is the login-CSRF case, where
    // an attacker replays their own handshake into someone else's browser.
    await controller.callback(
      { code: "abc", state },
      request(`${STATE_COOKIE}=other`),
      res
    );

    expect(cookieValue(res, SESSION_COOKIE)).toBeUndefined();
    expect(res.redirectedTo).toBe("http://web.test/login?error=state&next=%2Fstatus");
    expect(auth.exchangeCode).not.toHaveBeenCalled();
  });

  it("refuses a callback with no state cookie at all", async () => {
    const auth = defaults();
    const controller = await build(auth);
    const { state } = startLogin(controller);

    const res = fakeResponse();
    await controller.callback({ code: "abc", state }, request(undefined), res);

    expect(cookieValue(res, SESSION_COOKIE)).toBeUndefined();
    expect(auth.exchangeCode).not.toHaveBeenCalled();
  });

  it("refuses an expired state token", async () => {
    const auth = defaults();
    const controller = await build(auth);
    const expired = signState(
      { nonce: "n", next: "/status", exp: Date.now() - 1 },
      SECRET
    );

    const res = fakeResponse();
    await controller.callback(
      { code: "abc", state: expired },
      request(`${STATE_COOKIE}=n`),
      res
    );

    expect(cookieValue(res, SESSION_COOKIE)).toBeUndefined();
    expect(auth.exchangeCode).not.toHaveBeenCalled();
  });

  it("handles GitHub's cancel redirect, which carries an error and no code", async () => {
    const auth = defaults();
    const controller = await build(auth);
    const { state, nonce } = startLogin(controller);

    const res = fakeResponse();
    await controller.callback(
      { error: "access_denied", state },
      request(`${STATE_COOKIE}=${nonce}`),
      res
    );

    expect(res.redirectedTo).toContain("error=github");
    expect(auth.exchangeCode).not.toHaveBeenCalled();
  });

  it("refuses a valid GitHub login that is not the owner", async () => {
    const auth = {
      ...defaults(),
      exchangeCode: vi.fn().mockResolvedValue({ id: 999, login: "someone" }),
    };
    const controller = await build(auth);
    const { state, nonce } = startLogin(controller);

    const res = fakeResponse();
    await controller.callback(
      { code: "abc", state },
      request(`${STATE_COOKIE}=${nonce}`),
      res
    );

    expect(cookieValue(res, SESSION_COOKIE)).toBeUndefined();
    expect(res.redirectedTo).toContain("error=forbidden");
    expect(auth.createSession).not.toHaveBeenCalled();
  });

  it("redirects rather than throwing when the code exchange fails", async () => {
    const auth = { ...defaults(), exchangeCode: vi.fn().mockResolvedValue(null) };
    const controller = await build(auth);
    const { state, nonce } = startLogin(controller);

    const res = fakeResponse();
    await controller.callback(
      { code: "abc", state },
      request(`${STATE_COOKIE}=${nonce}`),
      res
    );

    expect(res.redirectedTo).toContain("error=github");
    expect(auth.createSession).not.toHaveBeenCalled();
  });
});

describe("GET /auth/viewer", () => {
  it("answers 200 with isOwner false for an anonymous visitor", async () => {
    const controller = await build(defaults());
    expect(await controller.viewer(request(undefined))).toEqual({ isOwner: false });
  });

  it("returns the login when the session resolves to the owner", async () => {
    const auth = { ...defaults(), resolveOwner: vi.fn().mockResolvedValue(owner) };
    const controller = await build(auth);

    expect(await controller.viewer(request(`${SESSION_COOKIE}=live`))).toEqual({
      isOwner: true,
      login: "vyoh",
    });
    expect(auth.resolveOwner).toHaveBeenCalledWith("live", expect.any(Date));
  });
});

describe("POST /auth/logout", () => {
  it("revokes the session, clears the cookie, and answers 204", async () => {
    const auth = defaults();
    const controller = await build(auth);

    const res = fakeResponse();
    await controller.logout(request(`${SESSION_COOKIE}=live`), res);

    expect(auth.revokeSession).toHaveBeenCalledWith("live");
    expect(res.cleared).toContain(SESSION_COOKIE);
    expect(res.statusCode).toBe(204);
  });

  it("is idempotent when there is no cookie", async () => {
    const auth = defaults();
    const controller = await build(auth);

    const res = fakeResponse();
    await controller.logout(request(undefined), res);

    expect(auth.revokeSession).toHaveBeenCalledWith(undefined);
    expect(res.statusCode).toBe(204);
  });
});
