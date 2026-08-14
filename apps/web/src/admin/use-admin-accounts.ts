import { meQueryOptions } from "@/identity/use-me";
import { ownerRequest } from "@/lib/owner-request";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AdminLolAccount,
  AdminLolAccountDeleteResult,
  AdminSteamAccount,
  AdminSteamAccountDeleteResult,
  LolAccount,
} from "@vyoh/shared";

export const adminLolAccountsQueryKey = ["admin", "lol-accounts"] as const;
export const adminSteamAccountsQueryKey = ["admin", "steam-accounts"] as const;

/**
 * One row of the roster table: the public account, plus the owner-only detail
 * when the admin read has resolved.
 *
 * The split exists because `/admin/*` 401s for everyone but the owner while the
 * roster itself is already public — the nav lists it. So the table renders for
 * any visitor from `/me` and gains its two timestamp columns once the owner's
 * read lands. `detail: null` is the locked view, and the columns that would read
 * from it aren't rendered at all rather than filled with a placeholder that
 * would claim an account is syncing when it might be paused.
 */
export interface RosterRow {
  account: LolAccount;
  detail: AdminLolAccount | null;
}

export interface SteamRosterRow {
  steamId64: string;
  detail: AdminSteamAccount | null;
}

export function mergeRoster(
  accounts: readonly LolAccount[],
  detail: readonly AdminLolAccount[] | undefined
): RosterRow[] {
  const bySlug = new Map((detail ?? []).map((d) => [d.slug, d]));
  return accounts.map((account) => ({
    account,
    detail: bySlug.get(account.slug) ?? null,
  }));
}

export function mergeSteamRoster(
  steamIds: readonly string[],
  detail: readonly AdminSteamAccount[] | undefined
): SteamRosterRow[] {
  const byId = new Map((detail ?? []).map((d) => [d.steamId64, d]));
  return steamIds.map((steamId64) => ({
    steamId64,
    detail: byId.get(steamId64) ?? null,
  }));
}

/**
 * `enabled` rather than a caught 401: the read is gated, so for a signed-out
 * visitor a request is known to fail before it is sent, and firing it anyway
 * would put a red 401 in everyone's network panel on every status-page visit.
 */
export function useAdminLolAccounts(enabled: boolean) {
  return useQuery({
    queryKey: adminLolAccountsQueryKey,
    queryFn: () => ownerRequest<AdminLolAccount[]>("GET", "/admin/lol-accounts"),
    enabled,
    staleTime: 30_000,
  });
}

export function useAdminSteamAccounts(enabled: boolean) {
  return useQuery({
    queryKey: adminSteamAccountsQueryKey,
    queryFn: () => ownerRequest<AdminSteamAccount[]>("GET", "/admin/steam-accounts"),
    enabled,
    staleTime: 30_000,
  });
}

/**
 * Both admin reads plus `/me`, after any roster write.
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
      queryClient.invalidateQueries({ queryKey: adminSteamAccountsQueryKey }),
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

export function useCreateSteamAccount() {
  const invalidate = useInvalidateRoster();
  return useMutation<AdminSteamAccount, Error, string>({
    mutationFn: (steamId64) =>
      ownerRequest<AdminSteamAccount>("POST", "/admin/steam-accounts", { steamId64 }),
    onSuccess: invalidate,
  });
}

export function useDeleteSteamAccount() {
  const invalidate = useInvalidateRoster();
  return useMutation<AdminSteamAccountDeleteResult, Error, string>({
    mutationFn: (steamId64) =>
      ownerRequest<AdminSteamAccountDeleteResult>(
        "DELETE",
        `/admin/steam-accounts/${encodeURIComponent(steamId64)}`
      ),
    onSuccess: invalidate,
  });
}
