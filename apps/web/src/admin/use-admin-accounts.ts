import { meQueryOptions } from "@/identity/use-me";
import { ownerRequest } from "@/lib/owner-request";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AdminLolAccount,
  AdminLolAccountDeleteResult,
  AdminPurgePreview,
  AdminPurgeResult,
} from "@vyoh/shared";

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

/**
 * What purging `slug` would remove. `null` while no dialog is open, so the
 * query stays idle until there is an account to ask about.
 *
 * `staleTime: 0` against the 30s the roster read uses. These counts are the
 * only thing standing between the operator and an irreversible delete, and a
 * cached figure from a previous dialog — taken before a sync tick, or before
 * another account was purged out from under the shared-match arithmetic —
 * would be a confident wrong number at exactly the wrong moment.
 */
export function useAdminPurgePreview(slug: string | null) {
  return useQuery({
    queryKey: ["admin", "lol-accounts", slug, "purge-preview"] as const,
    queryFn: () =>
      ownerRequest<AdminPurgePreview>(
        "GET",
        `/admin/lol-accounts/${encodeURIComponent(slug ?? "")}/purge-preview`
      ),
    enabled: slug !== null,
    staleTime: 0,
    gcTime: 0,
  });
}

/**
 * Purge sends the slug twice — once in the path, once as the confirmation the
 * api checks it against. Not redundant: the api rejects a mismatch, so this is
 * the wire half of the typed-slug step, and passing anything but what the
 * operator typed would defeat it.
 */
export function usePurgeAccount() {
  const invalidate = useInvalidateRoster();
  return useMutation<AdminPurgeResult, Error, { slug: string; confirm: string }>({
    mutationFn: ({ slug, confirm }) =>
      ownerRequest<AdminPurgeResult>(
        "POST",
        `/admin/lol-accounts/${encodeURIComponent(slug)}/purge`,
        { confirm }
      ),
    onSuccess: invalidate,
  });
}
