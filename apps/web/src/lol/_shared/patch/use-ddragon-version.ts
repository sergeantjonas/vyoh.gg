import { useQuery } from "@tanstack/react-query";

// Fetches the latest DDragon version (e.g. "16.9.1") and returns it as the
// `:patch` cache-key segment for the API's `/img/lol/*` proxy. Deliberately
// NOT sourced from `useLolStatic().patchVersion`: that field is the
// truncated year-display form ("26.10") for human-readable headers, and
// the image proxy resolves real CDN paths from the full DDragon string.
// A 5KB versions.json fetch on app boot is the right shape here — the
// migration's "delete client-side CDragon JSON" goal didn't cover DDragon.
export function useDDragonVersion(): string {
  const { data } = useQuery({
    queryKey: ["ddragon-version"],
    queryFn: async (): Promise<string> => {
      const res = await fetch("https://ddragon.leagueoflegends.com/api/versions.json");
      const versions = (await res.json()) as string[];
      return versions[0] ?? "16.9.1";
    },
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY,
  });
  return data ?? "16.9.1";
}
