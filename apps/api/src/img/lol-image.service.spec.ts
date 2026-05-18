import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LolImageService } from "./lol-image.service";

describe("LolImageService.champion", () => {
  const service = new LolImageService();

  it("builds the CDragon square URL with a lower-cased alias", () => {
    const resolved = service.champion("Ahri", "square");
    expect(resolved.urls).toEqual([
      "https://cdn.communitydragon.org/latest/champion/ahri/square",
    ]);
    expect(resolved.params).toEqual({ width: 72, quality: 85 });
  });

  it("uses splash-art for the 'card' variant at a wider width", () => {
    const resolved = service.champion("Ahri", "card");
    expect(resolved.urls[0]).toContain("/splash-art/centered");
    expect(resolved.params).toMatchObject({ width: 500, quality: 90 });
    expect(resolved.params.blur).toBeUndefined();
  });

  it("applies a blur and 80 quality for the 'backdrop' variant", () => {
    const resolved = service.champion("Ahri", "backdrop");
    expect(resolved.urls[0]).toContain("/splash-art/centered");
    expect(resolved.params).toMatchObject({ width: 600, quality: 80, blur: 1 });
  });

  it("strips the Strawberry_ prefix used for Swarm-mode champion aliases", () => {
    const resolved = service.champion("Strawberry_Yuumi", "square");
    expect(resolved.urls[0]).toBe(
      "https://cdn.communitydragon.org/latest/champion/yuumi/square"
    );
  });
});

describe("LolImageService.item", () => {
  const service = new LolImageService();

  it("builds the DDragon item URL pinned to the requested patch", () => {
    const resolved = service.item(3001, "14.10.1");
    expect(resolved.urls).toEqual([
      "https://ddragon.leagueoflegends.com/cdn/14.10.1/img/item/3001.png",
    ]);
    expect(resolved.params).toEqual({ width: 64, quality: 85 });
  });
});

describe("LolImageService.roleIconUrl", () => {
  const service = new LolImageService();

  it("returns the static role-icon URL by slug", () => {
    expect(service.roleIconUrl("middle")).toBe(
      "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/svg/position-middle.svg"
    );
  });
});

describe("LolImageService.rune", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL) => {
        const u = url.toString();
        if (u.endsWith("/v1/perks.json")) {
          return new Response(
            JSON.stringify([
              {
                id: 8005,
                iconPath:
                  "/lol-game-data/assets/perks/styles/precision/presstheattack/presstheattack.png",
              },
              {
                id: 8112,
                iconPath:
                  "/lol-game-data/assets/perks/styles/domination/electrocute/electrocute.png",
              },
            ]),
            { status: 200, headers: { "content-type": "application/json" } }
          );
        }
        throw new Error(`unexpected fetch ${u}`);
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("resolves to the lower-cased CDragon game-data icon URL for a known keystone", async () => {
    const service = new LolImageService();
    const resolved = await service.rune(8005);
    expect(resolved.urls).toEqual([
      "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/perks/styles/precision/presstheattack/presstheattack.png",
    ]);
    expect(resolved.params).toEqual({ width: 40, quality: 85 });
  });

  it("throws for an unknown perk id rather than constructing a 404-bound URL", async () => {
    const service = new LolImageService();
    await expect(service.rune(99_999)).rejects.toThrow(/unknown perk id 99999/);
  });
});

describe("LolImageService.spell", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL) => {
        const u = url.toString();
        if (u.endsWith("/v1/summoner-spells.json")) {
          return new Response(
            JSON.stringify([
              {
                id: 4,
                iconPath: "/lol-game-data/assets/data/spells/icons2d/summoner_flash.png",
              },
              {
                id: 14,
                iconPath: "/lol-game-data/assets/data/spells/icons2d/summoner_dot.png",
              },
            ]),
            { status: 200, headers: { "content-type": "application/json" } }
          );
        }
        throw new Error(`unexpected fetch ${u}`);
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("resolves to the CDragon icon URL for a known summoner spell id", async () => {
    const service = new LolImageService();
    const resolved = await service.spell(4);
    expect(resolved.urls[0]).toBe(
      "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/data/spells/icons2d/summoner_flash.png"
    );
  });

  it("throws for an unknown summoner spell id", async () => {
    const service = new LolImageService();
    await expect(service.spell(99_999)).rejects.toThrow(
      /unknown summoner spell id 99999/
    );
  });
});
