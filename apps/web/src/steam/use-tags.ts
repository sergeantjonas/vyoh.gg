import { HttpError } from "@/lib/http-error";
import { useQuery } from "@tanstack/react-query";
import type { SteamTagCatalog } from "@vyoh/shared";

const API_URL = "http://localhost:2010";

async function fetchTagCatalog(): Promise<SteamTagCatalog> {
  const res = await fetch(`${API_URL}/steam/tags`);
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { message?: string };
      if (typeof body?.message === "string") message = body.message;
    } catch {
      // not JSON — keep fallback
    }
    throw new HttpError(res.status, message);
  }
  return res.json() as Promise<SteamTagCatalog>;
}

// Backed by the monthly IStoreService/GetTagList cron. The catalog is in the
// low thousands and changes on the order of a few new entries per month —
// effectively static within a session. 24h stale-time is generous and keeps
// the network completely silent for the rest of the visit after the first
// load.
export function useSteamTags() {
  return useQuery({
    queryKey: ["steam", "tags"],
    queryFn: fetchTagCatalog,
    staleTime: 24 * 60 * 60 * 1_000,
  });
}
