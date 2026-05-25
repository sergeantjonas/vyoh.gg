// Per-app screenshot payload served by GET /steam/game/:appid/screenshots.
// Two server-side buckets from IStoreBrowseService — `allAges` is the
// storefront default (and the only one rendered without an explicit owner
// opt-in), `mature` is the bucket Steam itself gates behind a maturity
// toggle. Empty arrays mean either the enrichment row is missing or the
// upstream bucket was empty; renderers treat both identically.

import type { SteamScreenshotEntry } from "./screenshots.ts";

export interface SteamGameScreenshots {
  appid: number;
  allAges: SteamScreenshotEntry[];
  mature: SteamScreenshotEntry[];
}
