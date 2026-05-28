import { describe, expect, it } from "vitest";
import {
  type SteamAdaptiveTrailer,
  pickAdaptiveTrailer,
  steamTrailerCdnUrl,
} from "./trailers";

const av1: SteamAdaptiveTrailer = {
  cdnPath: "2050650/657549/abc/1750745214/dash_av1.mpd",
  encoding: "dash_av1",
};
const h264: SteamAdaptiveTrailer = {
  cdnPath: "2050650/657549/abc/1750745214/dash_h264.mpd",
  encoding: "dash_h264",
};
const hls: SteamAdaptiveTrailer = {
  cdnPath: "2050650/657549/abc/1750745214/hls_264_master.m3u8",
  encoding: "hls_h264",
};

describe("steamTrailerCdnUrl", () => {
  it("composes the direct video CDN URL for an adaptive manifest path", () => {
    expect(steamTrailerCdnUrl(av1.cdnPath)).toBe(
      "https://video.akamai.steamstatic.com/store_trailers/2050650/657549/abc/1750745214/dash_av1.mpd"
    );
  });

  it("composes the direct CDN URL for a microtrailer.webm filename (same root)", () => {
    expect(
      steamTrailerCdnUrl(
        "2050650/657549/cb3c3f74c8ef584d34401e5786b1858845df8fbe/1750745214/microtrailer.webm"
      )
    ).toContain("video.akamai.steamstatic.com/store_trailers/2050650/");
  });
});

describe("pickAdaptiveTrailer", () => {
  it("returns null when there are no variants at all", () => {
    expect(pickAdaptiveTrailer([], { isSafari: false, supportsAv1: true })).toBeNull();
  });

  it("prefers HLS on Safari even when AV1 is available", () => {
    expect(
      pickAdaptiveTrailer([av1, h264, hls], { isSafari: true, supportsAv1: true })
    ).toBe(hls);
  });

  it("falls back to dash_h264 on Safari when HLS is missing", () => {
    expect(pickAdaptiveTrailer([av1, h264], { isSafari: true, supportsAv1: true })).toBe(
      h264
    );
  });

  it("prefers AV1 on AV1-capable non-Safari browsers", () => {
    expect(
      pickAdaptiveTrailer([av1, h264, hls], { isSafari: false, supportsAv1: true })
    ).toBe(av1);
  });

  it("falls back to dash_h264 when AV1 isn't supported", () => {
    expect(
      pickAdaptiveTrailer([av1, h264, hls], { isSafari: false, supportsAv1: false })
    ).toBe(h264);
  });

  it("falls back through hls then the first variant if dash_h264 is missing", () => {
    expect(pickAdaptiveTrailer([av1, hls], { isSafari: false, supportsAv1: false })).toBe(
      hls
    );
  });

  it("returns the only variant when there's exactly one", () => {
    expect(pickAdaptiveTrailer([av1], { isSafari: false, supportsAv1: false })).toBe(av1);
  });
});
