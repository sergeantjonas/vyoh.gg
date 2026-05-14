import { useMe } from "@/identity/use-me";
import type { LolAccount } from "@vyoh/shared";

export function usePrimaryAccount(): {
  account: LolAccount | undefined;
  isPending: boolean;
} {
  const me = useMe();
  return { account: me.data?.lol[0], isPending: me.isPending };
}
