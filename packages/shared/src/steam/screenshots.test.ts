import { describe, expect, it } from "vitest";
import { steamScreenshotFullUrl, steamScreenshotThumbUrl } from "./screenshots.ts";

describe("steamScreenshotThumbUrl", () => {
  it("composes the 600x338 thumbnail URL by injecting size before .jpg", () => {
    expect(
      steamScreenshotThumbUrl(550, "steam/apps/550/ss_abc.jpg?t=1772742214")
    ).toBe(
      "https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/550/ss_abc.600x338.jpg?t=1772742214"
    );
  });

  it("does NOT prepend the appid (the filename already contains steam/apps/<appid>/)", () => {
    // Regression guard for the original implementation which appended both
    // {appid} AND the full embedded path — producing a 301/400 from the CDN.
    const url = steamScreenshotThumbUrl(550, "steam/apps/550/ss_abc.jpg");
    expect(url).not.toMatch(/\/550\/steam\/apps\/550\//);
  });

  it("preserves a filename without a `?t=` query string", () => {
    expect(steamScreenshotThumbUrl(550, "steam/apps/550/ss_abc.jpg")).toBe(
      "https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/550/ss_abc.600x338.jpg"
    );
  });

  it("passes through a filename that already has a size suffix", () => {
    expect(steamScreenshotThumbUrl(42, "steam/apps/42/ss_xyz.640x360.jpg")).toBe(
      "https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/42/ss_xyz.640x360.jpg"
    );
  });
});

describe("steamScreenshotFullUrl", () => {
  it("composes the 1920x1080 full-size URL preserving the `?t=` cache buster", () => {
    expect(
      steamScreenshotFullUrl(550, "steam/apps/550/ss_abc.jpg?t=1772742214")
    ).toBe(
      "https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/550/ss_abc.1920x1080.jpg?t=1772742214"
    );
  });
});
