import { useQuery } from "@tanstack/react-query";

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
