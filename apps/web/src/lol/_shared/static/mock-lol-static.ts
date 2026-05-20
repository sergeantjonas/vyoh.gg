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
};

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
