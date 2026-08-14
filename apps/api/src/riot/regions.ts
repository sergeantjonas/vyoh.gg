import { PLATFORMS, type Platform } from "@vyoh/shared";

// Re-exported so the api keeps importing its routing vocabulary from one place.
// The list itself is shared: the web's add-account form offers the same
// platforms this module maps.
export { PLATFORMS };
export type { Platform };

export type Regional = "europe" | "americas" | "asia" | "sea";

// Exhaustive by construction — a platform added to the shared list has to be
// mapped here or this stops type-checking.
const PLATFORM_TO_REGIONAL: Record<Platform, Regional> = {
  euw1: "europe",
  eun1: "europe",
  tr1: "europe",
  ru: "europe",
  me1: "europe",
  na1: "americas",
  br1: "americas",
  la1: "americas",
  la2: "americas",
  kr: "asia",
  jp1: "asia",
  oc1: "sea",
  ph2: "sea",
  sg2: "sea",
  th2: "sea",
  tw2: "sea",
  vn2: "sea",
};

export function platformToRegional(platform: string): Regional {
  const lower = platform.toLowerCase();
  const regional = PLATFORM_TO_REGIONAL[lower as Platform];
  if (!regional) {
    throw new Error(`Unknown Riot platform: ${platform}`);
  }
  return regional;
}
