import type { LolStaticBundle } from "@vyoh/shared";
import { vi } from "vitest";

export const EMPTY_LOL_STATIC: LolStaticBundle = {
  patchVersion: null,
  syncedAt: null,
  champions: [],
  championAbilities: {},
  items: [],
  summonerSpells: [],
  perks: [],
  profileIcons: [],
};

/**
 * Stub `fetch` with a URL-fragment → JSON body map. Anything not matched
 * rejects, so an unanticipated request fails loudly rather than resolving to
 * `undefined` and looking like empty data.
 *
 * `useDDragonVersion` is always answered, because it fires on its own whenever
 * a LoL surface mounts, independent of whatever the test is about.
 *
 * Passing `{}` is the common case: it says "this component mounts hooks I am
 * not asserting on, and none of them may reach the network". That matches how
 * the components already behave, since these requests were failing anyway (the
 * ddragon call is CORS-blocked under happy-dom, and the api ones are refused on
 * CI); the difference is that now they fail without a socket.
 *
 * Relies on `fetch` already being a `vi.fn`, which `test-setup.ts` guarantees
 * by installing the unmocked-fetch guard before each test.
 */
export function mockFetchRoutes(routes: Record<string, unknown> = {}): void {
  vi.mocked(fetch).mockImplementation((input) => {
    const url = String(input);
    if (url.includes("ddragon.leagueoflegends.com/api/versions.json")) {
      return Promise.resolve(new Response(JSON.stringify(["15.1.1"]), { status: 200 }));
    }
    for (const [fragment, body] of Object.entries(routes)) {
      if (url.includes(fragment)) {
        return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
      }
    }
    return Promise.reject(new Error(`unexpected url ${url}`));
  });
}

// Kept separate from mockFetchRoutes rather than delegating: this matches
// `/lol/static` with endsWith, and five existing test files depend on that
// exactness. Fragment matching would also catch `/lol/static/anything`.
export function mockLolStaticFetch(bundle: Partial<LolStaticBundle>): void {
  const full: LolStaticBundle = { ...EMPTY_LOL_STATIC, ...bundle };
  vi.mocked(fetch).mockImplementation((input) => {
    const url = String(input);
    if (url.endsWith("/lol/static")) {
      return Promise.resolve(new Response(JSON.stringify(full), { status: 200 }));
    }
    // `useDDragonVersion` fetches versions.json on its own (independent of
    // the bundle) — return a stable stub so callers that read the patch
    // segment for image URLs see a deterministic value in tests.
    if (url.includes("ddragon.leagueoflegends.com/api/versions.json")) {
      return Promise.resolve(new Response(JSON.stringify(["15.1.1"]), { status: 200 }));
    }
    return Promise.reject(new Error(`unexpected url ${url}`));
  });
}
