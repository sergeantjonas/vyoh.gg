import { HttpError } from "@/lib/http-error";
import { queryOptions, useQuery } from "@tanstack/react-query";
import type { Me } from "@vyoh/shared";

import { API_URL } from "@/lib/api-url";

async function fetchMe(): Promise<Me> {
  const res = await fetch(`${API_URL}/me`);
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (typeof body?.message === "string") message = body.message;
    } catch {
      // not JSON — keep fallback
    }
    throw new HttpError(res.status, message);
  }
  return res.json();
}

// The account list every other surface keys off: which Riot accounts exist,
// which is primary, and the slug→account mapping that `useAccountFromSlug`
// resolves. The root route awaits this so `useMe()` is already resolved on the
// server render, which is what lets a section route emit an identity instead
// of a spinner. Kept as a factory so the loader and the hook cannot drift onto
// different cache keys.
export function meQueryOptions() {
  return queryOptions({
    queryKey: ["me"],
    queryFn: fetchMe,
    staleTime: 30_000,
  });
}

export function useMe() {
  return useQuery(meQueryOptions());
}
