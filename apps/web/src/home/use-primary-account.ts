import { useMe } from "@/identity/use-me";
import type { LolAccountWithSummary } from "@vyoh/shared";

export function usePrimaryAccount(): {
  account: LolAccountWithSummary | undefined;
  isPending: boolean;
} {
  const me = useMe();
  return { account: me.data?.lol[0], isPending: me.isPending };
}
