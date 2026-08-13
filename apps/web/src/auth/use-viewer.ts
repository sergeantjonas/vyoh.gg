import { API_URL } from "@/lib/api-url";
import { HttpError } from "@/lib/http-error";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Viewer } from "@vyoh/shared";

export const viewerQueryKey = ["viewer"] as const;

const ANONYMOUS: Viewer = { isOwner: false };

async function fetchViewer(): Promise<Viewer> {
  const res = await fetch(`${API_URL}/auth/viewer`, { credentials: "include" });
  if (!res.ok) throw new HttpError(res.status, `HTTP ${res.status}`);
  return res.json();
}

/**
 * Who is looking at the page — the owner with a live session, or anybody else.
 *
 * Deliberately **not** primed from a route loader, unlike `meQueryOptions`. A
 * loader runs on the server, where `API_URL` is the internal origin and the
 * visitor's cookie is not in scope, so a prefetch would resolve to
 * `{ isOwner: false }` and dehydrate that into the client cache as authoritative
 * for the next 30 seconds — the owner would watch their own controls sit locked
 * after a hard refresh. Leaving it client-only costs one request and one flip.
 *
 * The flip is safe to render against: the query is pending during the server
 * render and pending again on the client's first render, so the two agree, and
 * the owner-only chrome simply appears once the response lands.
 */
export function useViewer() {
  return useQuery({
    queryKey: viewerQueryKey,
    queryFn: fetchViewer,
    staleTime: 30_000,
    // The endpoint answers 200 for anonymous visitors by design, so a failure
    // here is the api being unreachable rather than a rejected session. Retrying
    // buys nothing — every surface that reads this already treats "no answer"
    // and "not the owner" identically.
    retry: false,
  });
}

/**
 * `true` only once the api has confirmed a live owner session. Pending and
 * failed states both read as anonymous, which is what keeps every gated surface
 * closed-by-default rather than briefly unlocked on load.
 */
export function useIsOwner(): boolean {
  const { data } = useViewer();
  return data?.isOwner === true;
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_URL}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new HttpError(res.status, `HTTP ${res.status}`);
    },
    // Written straight into the cache rather than invalidated: the cookie is
    // gone the moment the response lands, so a refetch would only confirm what
    // is already known, and doing it in `onSettled` means the UI re-locks even
    // if the request failed after the server had already deleted the row.
    onSettled: () => {
      queryClient.setQueryData(viewerQueryKey, ANONYMOUS);
      void queryClient.invalidateQueries({ queryKey: viewerQueryKey });
    },
  });
}
