import { describe, expect, it } from "vitest";
import {
  steamAchievementIconUrl,
  steamCapsuleUrl,
  steamLibraryCapsuleUrl,
  steamLibraryHeroUrl,
  steamLibraryLogoUrl,
  steamPageBackgroundUrl,
} from "./steam-image";

describe("steam image url helpers", () => {
  it("falls back to a '0' cache-key segment when no assetTimestamp is provided", () => {
    expect(steamCapsuleUrl(440)).toBe(
      "http://localhost:2010/img/steam/capsule/440/0.webp"
    );
    expect(steamLibraryCapsuleUrl(440)).toBe(
      "http://localhost:2010/img/steam/library-capsule/440/0.webp"
    );
    expect(steamLibraryHeroUrl(440)).toBe(
      "http://localhost:2010/img/steam/hero/440/0.webp"
    );
    expect(steamLibraryLogoUrl(440)).toBe(
      "http://localhost:2010/img/steam/logo/440/0.webp"
    );
    expect(steamPageBackgroundUrl(440)).toBe(
      "http://localhost:2010/img/steam/backdrop/440/0.webp"
    );
  });

  it("encodes a numeric assetTimestamp into the URL", () => {
    expect(steamCapsuleUrl(440, 1717000000)).toBe(
      "http://localhost:2010/img/steam/capsule/440/1717000000.webp"
    );
  });

  it("encodes a BigInt assetTimestamp into the URL", () => {
    expect(steamLibraryHeroUrl(440, 1717000000n)).toBe(
      "http://localhost:2010/img/steam/hero/440/1717000000.webp"
    );
  });

  it("treats explicit null assetTimestamp as '0'", () => {
    expect(steamLibraryLogoUrl(440, null)).toBe(
      "http://localhost:2010/img/steam/logo/440/0.webp"
    );
  });

  it("achievement url uses the schema-version cache segment and color variant", () => {
    expect(steamAchievementIconUrl(440, "BACKSTABBER", false)).toBe(
      "http://localhost:2010/img/steam/achievement/440/BACKSTABBER/1.webp"
    );
  });

  it("achievement gray variant routes to /achievement-gray/", () => {
    expect(steamAchievementIconUrl(440, "BACKSTABBER", true)).toBe(
      "http://localhost:2010/img/steam/achievement-gray/440/BACKSTABBER/1.webp"
    );
  });
});
