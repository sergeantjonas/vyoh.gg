import { describe, expect, it } from "vitest";
import {
  rewriteSteamDescriptionAssetUrl,
  steamAchievementIconUrl,
  steamCapsuleUrl,
  steamLibraryCapsuleUrl,
  steamLibraryHeroUrl,
  steamLibraryLogoUrl,
  steamMicrotrailerPosterUrl,
  steamMicrotrailerUrl,
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
      // `noflip` segment defaults when flipHero is undefined/false — the
      // proxy serves the original orientation. See `steamLibraryHeroUrl`.
      "http://localhost:2010/img/steam/hero/noflip/440/0.webp"
    );
    expect(steamLibraryLogoUrl(440)).toBe(
      // v2 cache-bust segment — bumped when the logo proxy pipeline added
      // alpha trim, so browsers refresh past the prior untrimmed bytes.
      // See LOGO_SCHEMA_VERSION.
      "http://localhost:2010/img/steam/logo/2/440/0.webp"
    );
    expect(steamPageBackgroundUrl(440)).toBe(
      // v3 cache-bust segment — flips browsers off the year-cached prior
      // bytes onto the latest preference order (library_hero first, then
      // page_bg variants, then mirror). See BACKDROP_SCHEMA_VERSION.
      // `noflip` matches the hero route's default.
      "http://localhost:2010/img/steam/backdrop/3/noflip/440/0.webp"
    );
  });

  it("encodes a numeric assetTimestamp into the URL", () => {
    expect(steamCapsuleUrl(440, 1717000000)).toBe(
      "http://localhost:2010/img/steam/capsule/440/1717000000.webp"
    );
  });

  it("encodes a BigInt assetTimestamp into the URL", () => {
    expect(steamLibraryHeroUrl(440, 1717000000n)).toBe(
      "http://localhost:2010/img/steam/hero/noflip/440/1717000000.webp"
    );
  });

  it("encodes the flip segment when flipHero is true", () => {
    expect(steamLibraryHeroUrl(440, 1717000000n, true)).toBe(
      "http://localhost:2010/img/steam/hero/flip/440/1717000000.webp"
    );
  });

  it("treats explicit null assetTimestamp as '0'", () => {
    expect(steamLibraryLogoUrl(440, null)).toBe(
      "http://localhost:2010/img/steam/logo/2/440/0.webp"
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

describe("rewriteSteamDescriptionAssetUrl", () => {
  const HASH = "b2d503549e33e6603c86b6bd7babdb38";

  it("rewrites a .webm extras URL to the proxy path", () => {
    expect(
      rewriteSteamDescriptionAssetUrl(
        `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1245620/extras/${HASH}.webm`
      )
    ).toBe(`http://localhost:2010/img/steam/desc/1245620/extras/${HASH}.webm`);
  });

  it("rewrites a .poster.avif extras URL to the proxy path", () => {
    expect(
      rewriteSteamDescriptionAssetUrl(
        `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1245620/extras/${HASH}.poster.avif`
      )
    ).toBe(`http://localhost:2010/img/steam/desc/1245620/extras/${HASH}.poster.avif`);
  });

  it("strips the ?t=… cache-buster from the upstream URL", () => {
    expect(
      rewriteSteamDescriptionAssetUrl(
        `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1245620/extras/${HASH}.webm?t=1767883716`
      )
    ).toBe(`http://localhost:2010/img/steam/desc/1245620/extras/${HASH}.webm`);
  });

  it("accepts http as well as https upstreams", () => {
    expect(
      rewriteSteamDescriptionAssetUrl(
        `http://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1245620/extras/${HASH}.webm`
      )
    ).toContain("/img/steam/desc/1245620/extras/");
  });

  it("returns null for non-extras Steam paths (publisher screenshots, header art)", () => {
    expect(
      rewriteSteamDescriptionAssetUrl(
        "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1245620/header.jpg"
      )
    ).toBeNull();
  });

  it("returns null for upstream URLs with editorial slug filenames (pre-pivot bbcode shape)", () => {
    expect(
      rewriteSteamDescriptionAssetUrl(
        "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1245620/extras/er_steam_gif_01_-_wide"
      )
    ).toBeNull();
  });

  it("returns null for non-Steam hosts", () => {
    expect(
      rewriteSteamDescriptionAssetUrl(`https://evil.example.com/extras/${HASH}.webm`)
    ).toBeNull();
  });

  it("returns null for unsupported extensions", () => {
    expect(
      rewriteSteamDescriptionAssetUrl(
        `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1245620/extras/${HASH}.mp4`
      )
    ).toBeNull();
  });
});

describe("steamMicrotrailerUrl", () => {
  // Real-world shape captured 2026-05-29 from RE4 (appid 2050650): five
  // slash-separated segments `{appid}/{movieid}/{hash}/{ts}/microtrailer.{ext}`,
  // where ts is a unix-epoch cache-bump on the directory itself.
  it("splits the canonical 5-segment filename into proxy path segments", () => {
    expect(
      steamMicrotrailerUrl(
        "2050650/657549/cb3c3f74c8ef584d34401e5786b1858845df8fbe/1750745214/microtrailer.webm"
      )
    ).toBe(
      "http://localhost:2010/img/steam/microtrailer/2050650/657549/cb3c3f74c8ef584d34401e5786b1858845df8fbe/1750745214/microtrailer.webm"
    );
  });

  it("accepts mp4 alongside webm", () => {
    expect(steamMicrotrailerUrl("2050650/657549/abc/1750745214/microtrailer.mp4")).toBe(
      "http://localhost:2010/img/steam/microtrailer/2050650/657549/abc/1750745214/microtrailer.mp4"
    );
  });

  it("returns null for unexpected extensions (mov, etc.)", () => {
    expect(
      steamMicrotrailerUrl("2050650/657549/abc/1750745214/microtrailer.mov")
    ).toBeNull();
  });

  it("returns null when the path doesn't end in microtrailer.{ext}", () => {
    expect(steamMicrotrailerUrl("2050650/657549/abc/1750745214/trailer.webm")).toBeNull();
  });

  it("returns null when path traversal characters appear in a segment", () => {
    expect(
      steamMicrotrailerUrl("2050650/../etc/passwd/1750745214/microtrailer.webm")
    ).toBeNull();
  });

  it("returns null when the old 4-segment shape is supplied", () => {
    // Older draft assumed `{appid}/{movieid}/{hash}/microtrailer.{ext}`.
    // Steam returns the 5-segment shape; the 4-segment one was never real.
    expect(steamMicrotrailerUrl("2050650/657549/abc/microtrailer.webm")).toBeNull();
  });
});

describe("steamMicrotrailerPosterUrl", () => {
  // Real-world shape captured 2026-05-29 from RE4: `{movieid}/movie.NxN.{ext}`,
  // rooted at the trailer's own publisher id (NOT the parent appid).
  it("rewrites a canonical movie.NxN.jpg poster filename to the proxy path", () => {
    expect(steamMicrotrailerPosterUrl("256998128/movie.293x165.jpg")).toBe(
      "http://localhost:2010/img/steam/microtrailer-poster/256998128/movie.293x165.jpg"
    );
  });

  it("accepts png posters", () => {
    expect(steamMicrotrailerPosterUrl("256998128/movie.293x165.png")).toBe(
      "http://localhost:2010/img/steam/microtrailer-poster/256998128/movie.293x165.png"
    );
  });

  it("returns null for the older extras/ shape (never the real Steam format)", () => {
    expect(
      steamMicrotrailerPosterUrl("367520/extras/launch_trailer_medium.jpg")
    ).toBeNull();
  });

  it("returns null when the size suffix is missing", () => {
    expect(steamMicrotrailerPosterUrl("256998128/movie.jpg")).toBeNull();
  });

  it("returns null for path traversal attempts", () => {
    expect(steamMicrotrailerPosterUrl("256998128/../etc/passwd.jpg")).toBeNull();
  });
});
