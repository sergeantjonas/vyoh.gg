import { describe, expect, it } from "vitest";
import { steamScreenshotFullUrl, steamScreenshotThumbUrl } from "./screenshots.ts";

describe("steamScreenshotThumbUrl", () => {
  it("composes the 600x338 thumbnail URL from appid + base filename", () => {
    expect(steamScreenshotThumbUrl(1245620, "ss_abc.jpg")).toBe(
      "https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/1245620/ss_abc.600x338.jpg"
    );
  });

  it("passes through a filename that already has a size suffix", () => {
    expect(steamScreenshotThumbUrl(42, "ss_xyz.640x360.jpg")).toBe(
      "https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/42/ss_xyz.640x360.jpg"
    );
  });
});

describe("steamScreenshotFullUrl", () => {
  it("composes the 1920x1080 full-size URL", () => {
    expect(steamScreenshotFullUrl(1245620, "ss_abc.jpg")).toBe(
      "https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/1245620/ss_abc.1920x1080.jpg"
    );
  });
});
