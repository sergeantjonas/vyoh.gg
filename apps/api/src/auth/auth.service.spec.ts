import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import type { AuthConfig } from "./auth.config";
import {
  AuthService,
  SESSION_ABSOLUTE_TTL_MS,
  SESSION_EXTEND_AFTER_MS,
  SESSION_TTL_MS,
} from "./auth.service";

const OWNER_ID = 10_808_486;
const NOW = new Date("2026-08-13T12:00:00.000Z");

const config: AuthConfig = {
  ownerGithubUserId: OWNER_ID,
  clientId: "client-id",
  clientSecret: "client-secret",
  sessionSecret: "hmac-key",
  cookieDomain: undefined,
  webOrigin: "http://localhost:2009",
  secureCookies: false,
};

type Row = {
  tokenHash: string;
  githubUserId: number;
  githubLogin: string;
  createdAt: Date;
  expiresAt: Date;
  absoluteExpiresAt: Date;
};

function fakePrisma() {
  const rows = new Map<string, Row>();
  const session = {
    create: async ({ data }: { data: Row }) => {
      rows.set(data.tokenHash, { ...data });
      return data;
    },
    findUnique: async ({ where }: { where: { tokenHash: string } }) =>
      rows.get(where.tokenHash) ?? null,
    update: async ({
      where,
      data,
    }: {
      where: { tokenHash: string };
      data: Partial<Row>;
    }) => {
      const row = rows.get(where.tokenHash);
      if (row === undefined) throw new Error("no such row");
      Object.assign(row, data);
      return row;
    },
    deleteMany: async ({ where }: { where: { tokenHash: string } }) => ({
      count: rows.delete(where.tokenHash) ? 1 : 0,
    }),
  };
  return { rows, session, prisma: { session } as unknown as PrismaService };
}

const owner = { id: OWNER_ID, login: "vyoh" };
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

describe("AuthService sessions", () => {
  let store: ReturnType<typeof fakePrisma>;
  let service: AuthService;

  beforeEach(() => {
    store = fakePrisma();
    service = new AuthService(store.prisma, config);
  });

  /** The single row every test in this block creates. */
  const onlyRow = (): Row => {
    const [row] = store.rows.values();
    if (row === undefined) throw new Error("expected exactly one session row");
    return row;
  };

  it("persists the hash of the token, never the token", async () => {
    const { token } = await service.createSession(owner, NOW);

    expect(store.rows.has(token)).toBe(false);
    expect(store.rows.has(sha256(token))).toBe(true);
    // 32 random bytes, base64url — no padding, and long enough that there is
    // nothing to brute-force.
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("sets a sliding expiry and a hard ceiling that is further out", async () => {
    await service.createSession(owner, NOW);
    const row = onlyRow();

    expect(row.expiresAt.getTime()).toBe(NOW.getTime() + SESSION_TTL_MS);
    expect(row.absoluteExpiresAt.getTime()).toBe(NOW.getTime() + SESSION_ABSOLUTE_TTL_MS);
  });

  it("resolves the owner behind a live session", async () => {
    const { token } = await service.createSession(owner, NOW);
    expect(await service.resolveOwner(token, NOW)).toEqual(owner);
  });

  it("rejects a missing cookie without touching the database", async () => {
    const findUnique = vi.spyOn(store.session, "findUnique");
    expect(await service.resolveOwner(undefined, NOW)).toBeNull();
    expect(await service.resolveOwner("", NOW)).toBeNull();
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("rejects a token that hashes to no row", async () => {
    await service.createSession(owner, NOW);
    expect(await service.resolveOwner("not-a-real-token", NOW)).toBeNull();
  });

  it("rejects once the sliding window has passed, and reaps the row", async () => {
    const { token } = await service.createSession(owner, NOW);
    const after = new Date(NOW.getTime() + SESSION_TTL_MS + 1);

    expect(await service.resolveOwner(token, after)).toBeNull();
    expect(store.rows.size).toBe(0);
  });

  it("rejects once the absolute ceiling has passed even with a live sliding window", async () => {
    const { token } = await service.createSession(owner, NOW);
    const row = onlyRow();
    // The state the ceiling exists to catch: a session kept alive by use for
    // three months, whose sliding window is still comfortably in the future.
    const after = new Date(NOW.getTime() + SESSION_ABSOLUTE_TTL_MS + 1);
    row.expiresAt = new Date(after.getTime() + SESSION_TTL_MS);

    expect(await service.resolveOwner(token, after)).toBeNull();
    expect(store.rows.size).toBe(0);
  });

  it("rejects a session whose github id is not the configured owner", async () => {
    const { token } = await service.createSession({ id: 999, login: "someone" }, NOW);
    expect(await service.resolveOwner(token, NOW)).toBeNull();
    // Not reaped: it has not expired, and deleting it would be a side effect of
    // reading someone else's row.
    expect(store.rows.size).toBe(1);
  });

  it("extends the sliding window once it has drifted past the threshold", async () => {
    const { token } = await service.createSession(owner, NOW);
    const later = new Date(NOW.getTime() + SESSION_EXTEND_AFTER_MS + 1);

    await service.resolveOwner(token, later);

    const row = onlyRow();
    expect(row.expiresAt.getTime()).toBe(later.getTime() + SESSION_TTL_MS);
  });

  it("does not write on every request", async () => {
    const { token } = await service.createSession(owner, NOW);
    const update = vi.spyOn(store.session, "update");

    await service.resolveOwner(token, new Date(NOW.getTime() + 60_000));

    expect(update).not.toHaveBeenCalled();
  });

  it("never slides the expiry past the absolute ceiling", async () => {
    const { token } = await service.createSession(owner, NOW);
    // Day 89 of 90: a full 30-day extension would outrun the ceiling.
    const late = new Date(NOW.getTime() + SESSION_ABSOLUTE_TTL_MS - 24 * 60 * 60 * 1000);
    const row = onlyRow();
    row.expiresAt = new Date(late.getTime() + 1000);

    await service.resolveOwner(token, late);

    expect(row.expiresAt.getTime()).toBe(row.absoluteExpiresAt.getTime());
  });

  it("revokes a session, and revoking again is a no-op", async () => {
    const { token } = await service.createSession(owner, NOW);

    await service.revokeSession(token);
    expect(store.rows.size).toBe(0);

    await expect(service.revokeSession(token)).resolves.toBeUndefined();
    await expect(service.revokeSession(undefined)).resolves.toBeUndefined();
  });

  it("scopes ownership to the configured id", () => {
    expect(service.isOwner(owner)).toBe(true);
    expect(service.isOwner({ id: OWNER_ID + 1, login: "vyoh" })).toBe(false);
  });
});

describe("AuthService GitHub exchange", () => {
  let service: AuthService;

  beforeEach(() => {
    service = new AuthService(fakePrisma().prisma, config);
  });

  const jsonResponse = (body: unknown, ok = true) =>
    ({ ok, status: ok ? 200 : 401, json: async () => body }) as Response;

  it("asks GitHub for an authorize url carrying the state and no scope", () => {
    const url = new URL(service.authorizeUrl("state-token"));

    expect(url.origin + url.pathname).toBe("https://github.com/login/oauth/authorize");
    expect(url.searchParams.get("client_id")).toBe("client-id");
    expect(url.searchParams.get("state")).toBe("state-token");
    expect(url.searchParams.get("scope")).toBeNull();
    // Omitted so the destination is whatever the OAuth app registered, not
    // whatever a crafted link asks for.
    expect(url.searchParams.get("redirect_uri")).toBeNull();
  });

  it("returns the identity behind a valid code", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: "gho_token" }))
      .mockResolvedValueOnce(jsonResponse({ id: OWNER_ID, login: "vyoh" }));
    vi.stubGlobal("fetch", fetchMock);

    expect(await service.exchangeCode("code")).toEqual(owner);

    // The access token is spent on the identity lookup and never persisted.
    const userInit = fetchMock.mock.calls[1]?.[1];
    expect(userInit.headers.Authorization).toBe("Bearer gho_token");
    vi.unstubAllGlobals();
  });

  it("treats GitHub's 200-with-error body as a failed exchange", async () => {
    // A replayed or expired code answers 200, so the status alone says nothing.
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: "bad_verification_code" }));
    vi.stubGlobal("fetch", fetchMock);

    expect(await service.exchangeCode("code")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it("returns null when the network fails rather than throwing at the controller", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));
    expect(await service.exchangeCode("code")).toBeNull();
    vi.unstubAllGlobals();
  });

  it("returns null when the user payload is not the shape we expect", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ access_token: "gho_token" }))
        .mockResolvedValueOnce(jsonResponse({ login: "vyoh" }))
    );
    expect(await service.exchangeCode("code")).toBeNull();
    vi.unstubAllGlobals();
  });
});
