import { describe, expect, it } from "vitest";
import { projectEnrichment } from "./enrichment.service";
import type { SteamStoreItemFullRaw } from "./types";

function raw(overrides: Partial<SteamStoreItemFullRaw> = {}): SteamStoreItemFullRaw {
  return {
    appid: 367520,
    success: 1,
    name: "Hollow Knight",
    ...overrides,
  };
}

describe("projectEnrichment", () => {
  it("returns null when Steam did not resolve the item", () => {
    expect(projectEnrichment(raw({ success: 0 }))).toBeNull();
  });

  it("maps a full asset manifest into row-shaped paths + timestamp", () => {
    const row = projectEnrichment(
      raw({
        type: 0,
        is_free: false,
        tagids: [1628, 1625, 29482],
        assets: {
          asset_url_format: "steam/apps/367520/${FILENAME}?t=1776125684",
          library_capsule: "1eebc7e0/library_capsule.jpg",
          library_capsule_2x: "1eebc7e0/library_capsule_2x.jpg",
          library_hero: "0daf3933/library_hero.jpg",
          library_hero_2x: "0daf3933/library_hero_2x.jpg",
          header: "3c348949/header.jpg",
          hero_capsule: "e6cd56db/hero_capsule.jpg",
        },
        categories: {
          feature_categoryids: [22, 29, 23],
          supported_player_categoryids: [2],
        },
        release: { steam_release_date: 1487959251 },
      })
    );
    expect(row).not.toBeNull();
    expect(row).toMatchObject({
      appid: 367520,
      assetUrlFormat: "steam/apps/367520/${FILENAME}?t=1776125684",
      assetTimestamp: 1_776_125_684n,
      libraryCapsulePath: "1eebc7e0/library_capsule.jpg",
      libraryCapsule2xPath: "1eebc7e0/library_capsule_2x.jpg",
      libraryHeroPath: "0daf3933/library_hero.jpg",
      libraryHero2xPath: "0daf3933/library_hero_2x.jpg",
      headerPath: "3c348949/header.jpg",
      heroCapsulePath: "e6cd56db/hero_capsule.jpg",
      appType: 0,
      isFree: false,
      tagIds: [1628, 1625, 29482],
      featureCategoryIds: [22, 29, 23],
    });
    expect(row?.releaseDate?.toISOString()).toBe("2017-02-24T18:00:51.000Z");
  });

  it("nulls timestamp + paths when the asset block is absent", () => {
    const row = projectEnrichment(raw({}));
    expect(row).toMatchObject({
      assetUrlFormat: null,
      assetTimestamp: null,
      libraryCapsulePath: null,
      headerPath: null,
      releaseDate: null,
      tagIds: [],
      featureCategoryIds: [],
    });
  });

  it("caps tagIds at 20 so the queryable column stays bounded", () => {
    const thirty = Array.from({ length: 30 }, (_, i) => 1000 + i);
    const row = projectEnrichment(raw({ tagids: thirty }));
    expect(row?.tagIds).toHaveLength(20);
    expect(row?.tagIds[0]).toBe(1000);
    expect(row?.tagIds[19]).toBe(1019);
  });

  it("treats a zero or missing steam_release_date as no release date", () => {
    expect(
      projectEnrichment(raw({ release: { steam_release_date: 0 } }))?.releaseDate
    ).toBeNull();
    expect(projectEnrichment(raw({ release: {} }))?.releaseDate).toBeNull();
  });

  it("defaults logoPath to null when no PICS hash is supplied", () => {
    expect(projectEnrichment(raw({}))?.logoPath).toBeNull();
  });

  it("merges the PICS-sourced logo hash when supplied", () => {
    const row = projectEnrichment(
      raw({ appid: 3764200 }),
      "c0cb6f0c5702fdb43a1ff89cee79ffbe4d990b47"
    );
    expect(row?.logoPath).toBe("c0cb6f0c5702fdb43a1ff89cee79ffbe4d990b47");
  });
});
