import { Button } from "@/components/ui/button";
import { toastError, toastMessage, toastSuccess } from "@/lib/toast";
import { useSyncAccount } from "@/lol/matches/use-matches";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type { LolAccount } from "@vyoh/shared";
import { RefreshCw } from "lucide-react";

const TOOLTIP_CONTENT_CLASS =
  "pointer-events-none z-50 rounded-md border bg-popover/85 px-2 py-1 text-xs text-popover-foreground shadow-xl backdrop-blur-md data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95";

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
          className={TOOLTIP_CONTENT_CLASS}
        >
          Fetch the latest matches from Riot
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
