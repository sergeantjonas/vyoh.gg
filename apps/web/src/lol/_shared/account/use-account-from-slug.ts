import { useMe } from "@/identity/use-me";
import type { LolAccount } from "@vyoh/shared";

export function useAccountFromSlug(slug: string): LolAccount | undefined {
  const me = useMe();
  return me.data?.lol.find((a) => a.slug.toLowerCase() === slug.toLowerCase());
}
