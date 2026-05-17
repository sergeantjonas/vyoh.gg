import { HttpError } from "@/lib/http-error";
import { useQuery } from "@tanstack/react-query";
import type { PatchChangesResponse } from "@vyoh/shared";

const API_URL = "http://localhost:2010";

async function fetchPatchChanges(version: string): Promise<PatchChangesResponse> {
  const url = `${API_URL}/lol/patches/${encodeURIComponent(version)}/changes`;
  const res = await fetch(url);
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
  return res.json() as Promise<PatchChangesResponse>;
}

const STALE_TIME_MS = 60_000;

// Backs the PN3 patch-notes tab. Pass `null` while the parent is still
// resolving which version to show (e.g. patch list is loading) — the
// query stays disabled instead of firing a doomed request.
export function usePatchChanges(version: string | null) {
  return useQuery({
    queryKey: ["lol", "patches", "changes", version],
    queryFn: () => fetchPatchChanges(version as string),
    enabled: version !== null && version.length > 0,
    staleTime: STALE_TIME_MS,
  });
}
