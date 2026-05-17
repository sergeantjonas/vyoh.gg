import { HttpError } from "@/lib/http-error";
import { useQuery } from "@tanstack/react-query";
import type { PatchListEntry } from "@vyoh/shared";

const API_URL = "http://localhost:2010";

async function fetchPatchList(): Promise<PatchListEntry[]> {
  const res = await fetch(`${API_URL}/lol/patches`);
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
  return res.json() as Promise<PatchListEntry[]>;
}

// The list only flips when the cron detects a new patch (every ~2 weeks).
// Cache aggressively within the session — paired with `usePatchChanges`
// it powers both the C2 "current patch" lookup and the C3 selector.
const STALE_TIME_MS = 60_000;

export function usePatchList() {
  return useQuery({
    queryKey: ["lol", "patches", "list"],
    queryFn: fetchPatchList,
    staleTime: STALE_TIME_MS,
  });
}
