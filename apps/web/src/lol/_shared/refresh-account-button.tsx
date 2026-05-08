import { Button } from "@/components/ui/button";
import { useSyncAccount } from "@/lol/matches/use-matches";
import type { LolAccount } from "@vyoh/shared";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

export function RefreshAccountButton({ account }: { account: LolAccount | undefined }) {
  const sync = useSyncAccount(account);

  const handleClick = () => {
    if (!account || sync.isPending) return;
    sync.mutate(undefined, {
      onSuccess: (result) => {
        if (result.backfilled > 0) {
          toast.success(
            `Synced — ${result.backfilled} new ${result.backfilled === 1 ? "match" : "matches"}`
          );
        } else {
          toast(`Already up to date (${result.idCount} recent matches)`);
        }
      },
      onError: (err) => {
        toast.error(`Sync failed: ${err.message}`);
      },
    });
  };

  return (
    <Button
      variant="outline"
      size="icon"
      type="button"
      onClick={handleClick}
      disabled={!account || sync.isPending}
      aria-label="Refresh matches"
      title="Fetch the latest matches from Riot"
    >
      <RefreshCw className={sync.isPending ? "animate-spin" : ""} />
    </Button>
  );
}
