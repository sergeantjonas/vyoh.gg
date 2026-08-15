import { meQueryOptions } from "@/identity/use-me";
import { ownerRequest } from "@/lib/owner-request";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AdminLolAccount, AdminLolAccountDeleteResult } from "@vyoh/shared";

export const adminLolAccountsQueryKey = ["admin", "lol-accounts"] as const;

/**
 * `enabled` rather than a caught 401: the read is gated, so for a signed-out
 * visitor a request is known to fail before it is sent, and firing it anyway
 * would put a red 401 in everyone's network panel on every status-page visit.
 * The surface these feed is owner-only too, so this is belt-and-braces — but the
 * hooks have to be called before that gate to keep hook order stable.
 */
export function useAdminLolAccounts(enabled: boolean) {
  return useQuery({
    queryKey: adminLolAccountsQueryKey,
    queryFn: () => ownerRequest<AdminLolAccount[]>("GET", "/admin/lol-accounts"),
    enabled,
    staleTime: 30_000,
  });
}

/**
 * The admin read plus `/me`, after any roster write.
 *
 * `/me` is in the set because hiding an account changes the nav, and the nav is
 * built from `/me` — a write that refreshed only the admin table would leave the
 * account it just hid still listed in the dropdown until the next navigation.
 */
function useInvalidateRoster() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: adminLolAccountsQueryKey }),
      queryClient.invalidateQueries({ queryKey: meQueryOptions().queryKey }),
    ]);
}

export interface CreateLolAccountInput {
  slug: string;
  gameName: string;
  tagLine: string;
  region: string;
  isOwner: boolean;
}

export function useCreateLolAccount() {
  const invalidate = useInvalidateRoster();
  return useMutation<AdminLolAccount, Error, CreateLolAccountInput>({
    mutationFn: (input) =>
      ownerRequest<AdminLolAccount>("POST", "/admin/lol-accounts", input),
    onSuccess: invalidate,
  });
}

/** The four flags a roster row exposes; send only what changes. */
export interface UpdateLolAccountInput {
  slug: string;
  patch: {
    isOwner?: boolean;
    isPrimary?: boolean;
    hidden?: boolean;
    syncPaused?: boolean;
  };
}

export function useUpdateLolAccount() {
  const invalidate = useInvalidateRoster();
  return useMutation<AdminLolAccount, Error, UpdateLolAccountInput>({
    mutationFn: ({ slug, patch }) =>
      ownerRequest<AdminLolAccount>(
        "PATCH",
        `/admin/lol-accounts/${encodeURIComponent(slug)}`,
        patch
      ),
    onSuccess: invalidate,
  });
}

export function useDeleteLolAccount() {
  const invalidate = useInvalidateRoster();
  return useMutation<AdminLolAccountDeleteResult, Error, string>({
    mutationFn: (slug) =>
      ownerRequest<AdminLolAccountDeleteResult>(
        "DELETE",
        `/admin/lol-accounts/${encodeURIComponent(slug)}`
      ),
    onSuccess: invalidate,
  });
}
