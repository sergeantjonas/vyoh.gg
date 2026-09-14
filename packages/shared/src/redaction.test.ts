import { describe, expect, it } from "vitest";
import {
  isSecretKey,
  redactSecrets,
  redactSecretsDeep,
  scrubPayload,
} from "./redaction.ts";

describe("redactSecrets", () => {
  it("redacts a credential query parameter but keeps its name", () => {
    expect(
      redactSecrets("GET https://api.steampowered.com/x?key=ABC123&steamid=7 failed")
    ).toBe("GET https://api.steampowered.com/x?key=***&steamid=7 failed");
  });

  it("matches prefixed and mixed-case parameter names", () => {
    expect(redactSecrets("?access_token=xyz&API_SECRET=abc&password=hunter2")).toBe(
      "?access_token=***&API_SECRET=***&password=***"
    );
  });

  it("scrubs the first parameter of a query string that has no leading ?", () => {
    // Sentry stores `request.query_string` with the `?` already stripped, so a
    // pattern requiring one leaves the first parameter — often the key itself —
    // in cleartext.
    expect(redactSecrets("key=STEAMKEY&steamid=7")).toBe("key=***&steamid=7");
  });

  it("redacts a credential carried in a URL's userinfo", () => {
    // `DATABASE_URL` has no `=` to find; the password sits before the `@`.
    expect(redactSecrets("connect postgresql://vyoh:P4ssw0rd@db:5432/vyoh failed")).toBe(
      "connect postgresql://vyoh:***@db:5432/vyoh failed"
    );
  });

  it("leaves an ordinary URL with a port alone", () => {
    expect(redactSecrets("http://localhost:2010/health")).toBe(
      "http://localhost:2010/health"
    );
  });

  it("leaves parameters that are not credentials alone", () => {
    expect(redactSecrets("?steamid=7&appid=440")).toBe("?steamid=7&appid=440");
  });

  it("leaves a string with no query parameters unchanged", () => {
    expect(redactSecrets("ECONNRESET talking to Riot")).toBe(
      "ECONNRESET talking to Riot"
    );
  });
});

describe("isSecretKey", () => {
  it("matches the headers that carry a credential in full", () => {
    for (const key of [
      "authorization",
      "Cookie",
      "cookies",
      "x-api-key",
      "sessionToken",
    ]) {
      expect(isSecretKey(key)).toBe(true);
    }
  });

  it("matches the bare parameter names a parsed query string produces", () => {
    // `{ key: "…", code: "…" }` is what `request.query_string` looks like once
    // an SDK parses it — Steam's Web API key and GitHub's OAuth code.
    expect(isSecretKey("key")).toBe(true);
    expect(isSecretKey("code")).toBe(true);
  });

  it("matches the names a database connection string hides under", () => {
    for (const key of ["DATABASE_URL", "databaseUrl", "connectionString"]) {
      expect(isSecretKey(key)).toBe(true);
    }
  });

  it("matches this app's own session cookie", () => {
    // `vyoh_session` is a live login, and a `session(id|key|token)`-shaped
    // pattern misses it. Pinned because tightening this regex to spare the
    // play-session fields below is exactly what would drop it again.
    expect(isSecretKey("vyoh_session")).toBe(true);
  });

  it("does not match ordinary fields", () => {
    for (const key of [
      "steamid",
      "appid",
      "durationMs",
      "puuid",
      "keyboard",
      "countryCode",
    ]) {
      expect(isSecretKey(key)).toBe(false);
    }
  });

  it("leaves this app's play-session fields alone", () => {
    // `session` unqualified would erase real telemetry: the app counts play
    // sessions, and those names are exactly what a report needs to be useful.
    for (const key of ["sessionCount", "playSessions", "firstSessionMinutes"]) {
      expect(isSecretKey(key)).toBe(false);
    }
  });
});

describe("redactSecretsDeep", () => {
  it("redacts strings nested in objects and arrays", () => {
    const event = { breadcrumbs: [{ data: { url: "https://x/y?key=ABC" } }] };
    expect(redactSecretsDeep(event)).toEqual({
      breadcrumbs: [{ data: { url: "https://x/y?key=***" } }],
    });
  });

  it("drops a secret-keyed value wholesale, not just its query string", () => {
    const event = {
      request: { headers: { authorization: "Bearer abc123", accept: "*/*" } },
    };
    expect(redactSecretsDeep(event)).toEqual({
      request: { headers: { authorization: "***", accept: "*/*" } },
    });
  });

  it("does not mutate the input", () => {
    const event = { message: "?key=ABC" };
    redactSecretsDeep(event);
    expect(event.message).toBe("?key=ABC");
  });

  it("scrubs every occurrence of a shared reference, not just the first", () => {
    // A Sentry event routinely attaches one object at two points — the same
    // `data` on two breadcrumbs, say. A guard that remembers every object it
    // has ever seen would hand the second one back untouched.
    const shared = { url: "https://x/y?key=LIVEKEY" };
    expect(
      JSON.stringify(redactSecretsDeep({ first: shared, second: shared }))
    ).not.toContain("LIVEKEY");
  });

  it("terminates on a cyclic structure", () => {
    const event: Record<string, unknown> = { message: "?key=ABC" };
    event.self = event;
    const result = redactSecretsDeep(event) as Record<string, unknown>;
    expect(result.message).toBe("?key=***");
    expect(result.self).toBe("***");
  });

  it("fails closed at the depth cap instead of passing an unscanned subtree through", () => {
    let leaf: Record<string, unknown> = { url: "?key=ABC" };
    for (let i = 0; i < 14; i += 1) leaf = { nested: leaf };
    const json = JSON.stringify(redactSecretsDeep(leaf));
    expect(json).not.toContain("ABC");
    expect(json).toContain("***");
  });

  it("keeps __proto__ as an own property instead of re-parenting the result", () => {
    const event = JSON.parse('{"__proto__":{"polluted":true},"ok":"?key=ABC"}') as Record<
      string,
      unknown
    >;
    const result = redactSecretsDeep(event);
    expect(Object.keys(result)).toContain("__proto__");
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
  });

  it("substitutes the marker for a property whose getter throws", () => {
    const event = {
      ok: "?key=ABC",
      get boom(): string {
        throw new Error("nope");
      },
    };
    expect(() => redactSecretsDeep(event)).not.toThrow();
    expect(redactSecretsDeep(event)).toEqual({ ok: "?key=***", boom: "***" });
  });

  it("terminates on a graph that shares references across many paths", () => {
    // Path-scoped cycle guards do not collapse a shared-reference graph, so
    // this shape is walked once per distinct path and multiplies out. Without
    // the visit budget it exhausts the heap rather than returning.
    let level: Record<string, unknown> = { url: "?key=ABC" };
    for (let depth = 0; depth < 11; depth += 1) {
      const shared = level;
      level = { a: shared, b: shared, c: shared, d: shared, e: shared, f: shared };
    }
    const json = JSON.stringify(redactSecretsDeep(level));
    expect(json).not.toContain("ABC");
    // A *bare* marker, not `?key=***`: the scrubbed leaves would satisfy a
    // plain toContain("***") even if exhaustion returned nothing at all.
    expect(json).toMatch(/:"\*\*\*"/);
  });

  it("bounds a single wide array rather than rebuilding all of it", () => {
    const wide = { items: new Array(1_000_000).fill("?key=ABC") };
    const result = redactSecretsDeep(wide);
    expect(result.items.length).toBeLessThan(1_000_000);
    expect(result.items.at(-1)).toBe("***");
  });

  it("returns the marker when a proxy trap throws instead of letting it escape", () => {
    const hostile = new Proxy(
      { ok: "?key=ABC" },
      {
        ownKeys() {
          throw new Error("nope");
        },
      }
    );
    expect(redactSecretsDeep({ nested: hostile })).toEqual({ nested: "***" });
  });

  it("scrubs every credential shape a real event carries", () => {
    // One assertion over the shapes that actually reach `beforeSend`. Each of
    // the three leaked at some point during review, each in a different place,
    // which is why they are pinned together rather than trusted individually.
    const event = {
      request: {
        url: "https://api.steampowered.com/x?key=STEAMKEY",
        query_string: "key=STEAMKEY&steamid=7",
        headers: { authorization: "Bearer RIOTTOKEN", accept: "*/*" },
        cookies: { vyoh_session: "SESSIONTOKEN" },
      },
      breadcrumbs: [{ data: { url: "/auth/github/callback?code=OAUTHCODE" } }],
      extra: { parsed: { key: "STEAMKEY", code: "OAUTHCODE" } },
    };
    const json = JSON.stringify(redactSecretsDeep(event));
    for (const secret of ["STEAMKEY", "RIOTTOKEN", "SESSIONTOKEN", "OAUTHCODE"]) {
      expect(json).not.toContain(secret);
    }
    // Still useful afterwards: the non-secret context survives.
    expect(json).toContain("steamid=7");
    expect(json).toContain("api.steampowered.com");
  });

  it("passes values that are neither strings, arrays nor plain objects through", () => {
    const date = new Date("2026-09-13T00:00:00.000Z");
    expect(redactSecretsDeep({ at: date }).at).toBe(date);
  });
});

describe("scrubPayload", () => {
  it("redacts secrets anywhere in an event", () => {
    expect(
      scrubPayload({
        message: "GET https://api.steampowered.com/x?key=LIVE failed",
        extra: { headers: { authorization: "Bearer LIVE" } },
      })
    ).toEqual({
      message: "GET https://api.steampowered.com/x?key=*** failed",
      extra: { headers: { authorization: "***" } },
    });
  });

  it("drops the payload when the scrubber collapses it to the marker", () => {
    // A value that defeats the walk entirely comes back as the bare marker. A
    // string is not an event, and one we cannot vouch for is worse than none.
    const hostile = new Proxy(
      { ok: 1 },
      {
        ownKeys() {
          throw new Error("nope");
        },
      }
    );
    expect(scrubPayload(hostile)).toBeNull();
  });
});
