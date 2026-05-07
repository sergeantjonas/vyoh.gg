import type { LolAccount } from "@vyoh/shared";
import { useMe } from "./use-me";

export function useAccountFromSlug(slug: string): LolAccount | undefined {
  const me = useMe();
  return me.data?.lol.find((a) => a.slug.toLowerCase() === slug.toLowerCase());
}
