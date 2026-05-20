import { type UseQueryResult, useQuery } from "@tanstack/react-query";
import type { LolStaticBundle } from "@vyoh/shared";

const API_URL = "http://localhost:2010";
const STATIC_URL = `${API_URL}/lol/static`;

const LOL_STATIC_KEY = ["lol", "static"] as const;

async function fetchLolStatic(): Promise<LolStaticBundle> {
  const res = await fetch(STATIC_URL);
  if (!res.ok) throw new Error(`Failed to load static bundle: HTTP ${res.status}`);
  return (await res.json()) as LolStaticBundle;
}

const SHARED_QUERY_OPTS = {
  staleTime: Number.POSITIVE_INFINITY,
  gcTime: Number.POSITIVE_INFINITY,
} as const;

export function useLolStatic(): UseQueryResult<LolStaticBundle> {
  return useQuery({
    queryKey: LOL_STATIC_KEY,
    queryFn: fetchLolStatic,
    ...SHARED_QUERY_OPTS,
  });
}

// Derived selector — all five resource hooks share the same queryKey so the
// bundle is fetched once and select() runs on the cached payload, producing
// the per-hook derived map. `staleTime: Infinity` keeps the bundle reference
// stable so select() output stays referentially stable across renders.
export function useLolStaticSelect<T>(
  select: (bundle: LolStaticBundle) => T
): UseQueryResult<T> {
  return useQuery({
    queryKey: LOL_STATIC_KEY,
    queryFn: fetchLolStatic,
    select,
    ...SHARED_QUERY_OPTS,
  });
}
