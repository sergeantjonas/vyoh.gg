import { useMe } from "@/identity/use-me";
import { findAccountBySlug } from "@/lol/_shared/account/find-account-by-slug";
import type { LolAccount } from "@vyoh/shared";

export function useAccountFromSlug(slug: string): LolAccount | undefined {
  const me = useMe();
  return findAccountBySlug(me.data?.lol, slug);
}
