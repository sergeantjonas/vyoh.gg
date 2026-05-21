import { type UseQueryResult, useQuery } from "@tanstack/react-query";
import type { LolAbilityDescriptionDto } from "@vyoh/shared";

const API_URL = "http://localhost:2010";

// Lazy per-ability description fetch. The bundle ships identity (id, slot,
// abilityIndex, name, icon); description text is resolved on demand here
// because cron-bulk syncing every ability description on cold-start tripped
// the wiki's rate limit. The server stamps each row with a patch watermark
// after a successful fetch, so subsequent reads for any user on the same
// patch hit the cache. See docs/working-notes/lol/lazy-ability-descriptions.md.
async function fetchAbilityDescription(
  championId: number,
  slot: string,
  abilityIndex: number
): Promise<LolAbilityDescriptionDto> {
  const res = await fetch(
    `${API_URL}/lol/static/ability/${championId}/${slot}/${abilityIndex}`
  );
  if (!res.ok) {
    throw new Error(`Failed to load ability description: HTTP ${res.status}`);
  }
  return (await res.json()) as LolAbilityDescriptionDto;
}

export function useAbilityDescription(
  championId: number,
  slot: string,
  abilityIndex: number,
  options: { enabled?: boolean } = {}
): UseQueryResult<LolAbilityDescriptionDto> {
  return useQuery({
    queryKey: ["lol", "static", "ability", championId, slot, abilityIndex] as const,
    queryFn: () => fetchAbilityDescription(championId, slot, abilityIndex),
    // Server owns invalidation via the per-row `wikiSyncedPatchVersion`
    // watermark — once fetched, the client never needs to revalidate.
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY,
    enabled: options.enabled ?? true,
  });
}
