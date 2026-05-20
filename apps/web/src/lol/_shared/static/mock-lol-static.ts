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
    return Promise.reject(new Error(`unexpected url ${url}`));
  });
}
