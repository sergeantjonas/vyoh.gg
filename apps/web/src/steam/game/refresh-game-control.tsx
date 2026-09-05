import { OwnerAction } from "@/auth/owner-action";
import { useIsOwner } from "@/auth/use-viewer";
import { Button } from "@/components/ui/button";
import { toastError, toastInfo } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { type SteamGameRefreshLegs, formatPlaytimeVerbose } from "@vyoh/shared";
import { Lock, RefreshCw } from "lucide-react";
import type { useRefreshSteamGame } from "./use-refresh-steam-game";

type RefreshMutation = ReturnType<typeof useRefreshSteamGame>;

/**
 * The owner's "fetch now" for one game. The mutation is owned by the page and
 * passed in, because the button sits in the identity card's chip row while its
 * result (`RefreshGameResult`) renders on a line of its own below the chips —
 * two places, one run.
 *
 * Rendered locked for a visitor rather than hidden — `OwnerAction`'s trade: the
 * identity card around it is worth reading anyway, and the control describes a
 * capability of the page (this data is live, and can be pulled on demand) that
 * a visitor may well want to know about. The hide toggle beside it makes the
 * opposite call for the reason its own comment gives.
 *
 * A second press while a run is in flight is disabled here and refused by the
 * api; the refusal reads as a toast because the result line is for what changed.
 */
export function RefreshGameControl({
  refresh,
  className,
}: {
  refresh: RefreshMutation;
  /** Layout classes for the tooltip trigger, the box the chip row lays out. */
  className?: string | undefined;
}) {
  const isOwner = useIsOwner();

  const onRefresh = () => {
    refresh.mutate(undefined, {
      onSuccess: (result) => {
        if (!result.ran)
          void toastInfo("A refresh is already running — try again in a moment");
      },
      onError: (err) => void toastError(`Refresh failed: ${err.message}`),
    });
  };

  return (
    <OwnerAction
      isOwner={isOwner}
      side="top"
      label="Fetch this game's data from Steam now"
      className={className}
    >
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={onRefresh}
        disabled={!isOwner || refresh.isPending}
        aria-label="Refresh this game from Steam"
      >
        {isOwner ? (
          <RefreshCw className={cn(refresh.isPending && "animate-spin")} />
        ) : (
          <Lock />
        )}
      </Button>
    </OwnerAction>
  );
}

// What the last run changed, one clause per leg. `<output>` carries the status
// role, so the line is announced when it lands under the chips.
export function RefreshGameResult({ legs }: { legs: SteamGameRefreshLegs }) {
  return (
    <output aria-label="Refresh result" className="block text-xs text-muted-foreground">
      {describeLegs(legs).map((line, i) => (
        <span key={line}>
          {i > 0 && <span aria-hidden="true"> · </span>}
          {line}
        </span>
      ))}
    </output>
  );
}

// Failures and Steam's per-app privacy refusal are stated as such; the
// playtime leg names the library snapshot it really is.
export function describeLegs(legs: SteamGameRefreshLegs): string[] {
  const { schema, unlocks, rarity, enrichment, playtime } = legs;
  return [
    schema.failed
      ? "schema fetch failed"
      : schema.achievementCount === null
        ? "no achievement schema"
        : `${schema.achievementCount} achievements in schema`,
    unlocks.statsPrivate
      ? "unlock stats private on Steam"
      : unlocks.failed
        ? "unlock fetch failed"
        : `${unlocks.newUnlocks} new ${unlocks.newUnlocks === 1 ? "unlock" : "unlocks"}`,
    rarity.failed
      ? "rarity fetch failed"
      : `rarity for ${rarity.rowsWritten} achievements`,
    enrichment.failed
      ? "store data failed"
      : enrichment.written
        ? "store data refreshed"
        : "store data unchanged",
    describePlaytime(playtime),
  ];
}

function describePlaytime(playtime: SteamGameRefreshLegs["playtime"]): string {
  if (playtime.failed) return "library snapshot failed";
  const { beforeMinutes: before, afterMinutes: after } = playtime;
  if (after === null) return "no playtime in the library snapshot";
  if (before === null)
    return `playtime ${formatPlaytimeVerbose(after)} (library snapshot)`;
  if (after === before) return "playtime unchanged (library snapshot)";
  if (after > before) {
    return `playtime up ${formatPlaytimeVerbose(after - before)} (library snapshot)`;
  }
  return `playtime now ${formatPlaytimeVerbose(after)} (library snapshot)`;
}
