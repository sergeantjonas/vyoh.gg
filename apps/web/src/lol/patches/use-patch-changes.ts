import { HttpError } from "@/lib/http-error";
import { queryOptions, useQuery } from "@tanstack/react-query";
import type { PatchChangesResponse } from "@vyoh/shared";

import { API_URL } from "@/lib/api-url";

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

// Cache key carries the patch version, so once fetched the payload is
// effectively immutable for that key — Riot only edits historical notes
// in extremely rare cases.
//
// Split out of the hook so the route loader can prime the same cache entry
// server-side. The hook and the loader MUST go through this one factory: a
// loader that rebuilds the key inline warms an entry the hook never reads,
// which looks like it works (data is in the dehydrated payload) while the
// component still renders its pending branch.
export function patchChangesQueryOptions(version: string) {
  return queryOptions({
    queryKey: ["lol", "patches", "changes", version],
    queryFn: () => fetchPatchChanges(version),
    staleTime: Number.POSITIVE_INFINITY,
  });
}

// Backs the PN3 patch-notes tab. Pass `null` while the parent is still
// resolving which version to show (e.g. patch list is loading) — the
// query stays disabled instead of firing a doomed request.
export function usePatchChanges(version: string | null) {
  return useQuery({
    ...patchChangesQueryOptions(version as string),
    enabled: version !== null && version.length > 0,
  });
}
