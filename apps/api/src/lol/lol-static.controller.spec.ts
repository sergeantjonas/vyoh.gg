import type { LolStaticBundle } from "@vyoh/shared";
import { describe, expect, it, vi } from "vitest";
import type { LolStaticSyncService } from "./lol-static-sync.service";
import { LolStaticController } from "./lol-static.controller";

function makeController(stubs: Partial<LolStaticSyncService> = {}) {
  return new LolStaticController(stubs as LolStaticSyncService);
}

describe("LolStaticController", () => {
  it("getBundle() delegates to LolStaticSyncService.getBundle", async () => {
    const bundle: LolStaticBundle = {
      patchVersion: "26.10",
      syncedAt: "2026-05-21T00:00:00.000Z",
      champions: [
        {
          id: 62,
          alias: "MonkeyKing",
          name: "Wukong",
          roles: ["Fighter"],
          modernClasses: ["Fighter"],
          modernSubclasses: ["Skirmisher"],
        },
      ],
      championAbilities: { 62: [] },
      items: [],
      summonerSpells: [],
      perks: [],
      profileIcons: [],
    };
    const getBundle = vi.fn().mockResolvedValue(bundle);
    const ctrl = makeController({ getBundle });
    expect(await ctrl.getBundle()).toBe(bundle);
    expect(getBundle).toHaveBeenCalledOnce();
  });
});
