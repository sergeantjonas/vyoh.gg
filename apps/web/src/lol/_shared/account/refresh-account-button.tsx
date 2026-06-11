import { Button } from "@/components/ui/button";
import { toastError, toastMessage, toastSuccess } from "@/lib/toast";
import { TOOLTIP_CONTENT_COMPACT } from "@/lib/tooltip";
import { useSyncAccount } from "@/lol/matches/use-matches";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type { LolAccount } from "@vyoh/shared";
import { RefreshCw } from "lucide-react";

export function RefreshAccountButton({ account }: { account: LolAccount | undefined }) {
  const sync = useSyncAccount(account);

  const handleClick = () => {
    if (!account || sync.isPending) return;
    sync.mutate(undefined, {
      onSuccess: (result) => {
        if (result.backfilled > 0) {
          void toastSuccess(
            `Synced — ${result.backfilled} new ${result.backfilled === 1 ? "match" : "matches"}`
          );
        } else {
          void toastMessage(`Already up to date (${result.idCount} recent matches)`);
        }
      },
      onError: (err) => {
        void toastError(`Sync failed: ${err.message}`);
      },
    });
  };

  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>
        <Button
          variant="outline"
          size="icon"
          type="button"
          onClick={handleClick}
          disabled={!account || sync.isPending}
          aria-label="Refresh matches"
        >
          <RefreshCw className={sync.isPending ? "animate-spin" : ""} />
        </Button>
      </TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side="bottom"
          sideOffset={4}
          className={TOOLTIP_CONTENT_COMPACT}
        >
          Fetch the latest matches from Riot
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
