export type Regional = "europe" | "americas" | "asia" | "sea";

export type Platform =
  | "euw1"
  | "eun1"
  | "tr1"
  | "ru"
  | "me1"
  | "na1"
  | "br1"
  | "la1"
  | "la2"
  | "kr"
  | "jp1"
  | "oc1"
  | "ph2"
  | "sg2"
  | "th2"
  | "tw2"
  | "vn2";

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

// The runtime platform list, derived from the map above rather than written out
// again: `Record<Platform, Regional>` makes the map exhaustive by construction,
// so a new platform can't be added to the union without landing here too.
// Request DTOs validate a `region` param against this.
export const PLATFORMS: readonly string[] = Object.keys(PLATFORM_TO_REGIONAL);

export function platformToRegional(platform: string): Regional {
  const lower = platform.toLowerCase();
  const regional = PLATFORM_TO_REGIONAL[lower as Platform];
  if (!regional) {
    throw new Error(`Unknown Riot platform: ${platform}`);
  }
  return regional;
}
