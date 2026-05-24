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

  it("projects basic_info.short_description into shortDescription", () => {
    const row = projectEnrichment(
      raw({ basic_info: { short_description: "Explore a vast ruined kingdom." } })
    );
    expect(row?.shortDescription).toBe("Explore a vast ruined kingdom.");
  });

  it("defaults shortDescription to null when basic_info is absent", () => {
    expect(projectEnrichment(raw({}))?.shortDescription).toBeNull();
  });

  it("projects platforms.steam_deck_compat_category into steamDeckCompat", () => {
    const row = projectEnrichment(raw({ platforms: { steam_deck_compat_category: 3 } }));
    expect(row?.steamDeckCompat).toBe(3);
  });

  it("defaults steamDeckCompat to null when the platforms block is absent", () => {
    expect(projectEnrichment(raw({}))?.steamDeckCompat).toBeNull();
  });

  it("projects platforms.windows/mac/linux into the boolean OS columns", () => {
    const row = projectEnrichment(
      raw({ platforms: { windows: true, mac: false, linux: true } })
    );
    expect(row?.platformWindows).toBe(true);
    expect(row?.platformMac).toBe(false);
    expect(row?.platformLinux).toBe(true);
  });

  it("marks platformVr=true when vr_support has any key", () => {
    const row = projectEnrichment(
      raw({ platforms: { vr_support: { vr_native: true } } })
    );
    expect(row?.platformVr).toBe(true);
  });

  it("marks platformVr=false when vr_support is an explicit empty object", () => {
    const row = projectEnrichment(raw({ platforms: { vr_support: {} } }));
    expect(row?.platformVr).toBe(false);
  });

  it("leaves platformVr=null when vr_support is missing", () => {
    const row = projectEnrichment(raw({ platforms: { windows: true } }));
    expect(row?.platformVr).toBeNull();
  });

  it("projects reviews.summary_filtered into the reviewSummary blob", () => {
    const row = projectEnrichment(
      raw({
        reviews: {
          summary_filtered: {
            review_count: 56_501,
            percent_positive: 94,
            review_score: 8,
            review_score_label: "Very Positive",
          },
        },
      })
    );
    expect(row?.reviewSummary).toEqual({
      reviewCount: 56_501,
      percentPositive: 94,
      reviewScore: 8,
      reviewScoreLabel: "Very Positive",
    });
  });

  it("nulls reviewSummary when any sub-field is missing (partial blocks)", () => {
    const row = projectEnrichment(
      raw({
        reviews: {
          summary_filtered: {
            // Missing review_score / review_score_label — Steam returns this
            // shape for games below the review-count threshold.
            review_count: 3,
            percent_positive: 100,
          },
        },
      })
    );
    expect(row?.reviewSummary).toBeNull();
  });

  it("nulls reviewSummary when no reviews block is present", () => {
    expect(projectEnrichment(raw({}))?.reviewSummary).toBeNull();
  });

  it("projects game_rating into the gameRating blob with defaulted fields", () => {
    const row = projectEnrichment(
      raw({
        game_rating: {
          type: "ESRB",
          rating: "M",
          descriptors: ["Violence", "Language"],
          required_age: 17,
          use_age_gate: true,
          image_url: "shared/images/ratings/ESRB/m.png",
        },
      })
    );
    expect(row?.gameRating).toEqual({
      type: "ESRB",
      rating: "M",
      descriptors: ["Violence", "Language"],
      requiredAge: 17,
      useAgeGate: true,
      imageUrl: "shared/images/ratings/ESRB/m.png",
    });
  });

  it("nulls gameRating when upstream returned the explicit null (AO-rated)", () => {
    const row = projectEnrichment(raw({ game_rating: null }));
    expect(row?.gameRating).toBeNull();
  });

  it("nulls gameRating when type or rating is missing", () => {
    const row = projectEnrichment(raw({ game_rating: { descriptors: ["Violence"] } }));
    expect(row?.gameRating).toBeNull();
  });

  it("defaults descriptors to [] when game_rating omits the list", () => {
    const row = projectEnrichment(raw({ game_rating: { type: "PEGI", rating: "16" } }));
    expect(row?.gameRating?.descriptors).toEqual([]);
  });
});
