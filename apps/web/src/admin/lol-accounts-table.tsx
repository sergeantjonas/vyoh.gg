import { OwnerAction } from "@/auth/owner-action";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { OWNER_TIME_ZONE } from "@vyoh/shared";
import { Crown, Eye, EyeOff, Pause, Play, Star, Trash2 } from "lucide-react";
import type { RosterRow } from "./use-admin-accounts";
import { useDeleteLolAccount, useUpdateLolAccount } from "./use-admin-accounts";

const SINCE_FMT = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: OWNER_TIME_ZONE,
});

function since(iso: string | null): string {
  return iso === null ? "" : SINCE_FMT.format(new Date(iso));
}

/**
 * The roster, one row per tracked Riot account.
 *
 * Hide and pause are rendered as *state* rather than as menu actions: a roster
 * where three of nine rows are paused has to be legible at a glance, otherwise
 * "why is this account stale" turns into a debugging session. So both are
 * toggles carrying their own resting label, not verbs behind an overflow menu.
 */
export function LolAccountsTable({
  rows,
  isOwner,
}: {
  rows: RosterRow[];
  isOwner: boolean;
}) {
  const update = useUpdateLolAccount();
  const remove = useDeleteLolAccount();
  const busy = update.isPending || remove.isPending;

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No accounts tracked yet — add one to start syncing.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="py-2 pr-3 text-left font-medium">Account</th>
            <th className="px-2 py-2 text-left font-medium">Role</th>
            <th className="px-2 py-2 text-left font-medium">Visibility</th>
            <th className="px-2 py-2 text-left font-medium">Sync</th>
            <th className="py-2 pl-2 text-right font-medium">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ account, detail }) => {
            const hidden = account.hidden === true;
            const paused = detail?.syncPausedAt != null;
            const primary = account.isPrimary === true;
            const owner = account.isOwner === true;
            const label = `${account.gameName}#${account.tagLine}`;

            return (
              <tr key={account.slug} className="border-t">
                <td className="py-2 pr-3">
                  <span className="font-medium text-foreground">{label}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {account.slug} · {account.region}
                  </span>
                </td>

                <td className="px-2 py-2">
                  <div className="flex items-center gap-1">
                    <OwnerAction
                      isOwner={isOwner}
                      side="top"
                      label={owner ? "Stop counting as mine" : "Count as one of mine"}
                    >
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-pressed={owner}
                        aria-label={`Owner account: ${label}`}
                        disabled={!isOwner || busy}
                        onClick={() =>
                          update.mutate({
                            slug: account.slug,
                            patch: { isOwner: !owner },
                          })
                        }
                      >
                        <Star className={cn(owner && "fill-current text-foreground")} />
                      </Button>
                    </OwnerAction>
                    {/* Promotion only. Clearing the flag would leave a roster with
                        owners and no primary, which the api rejects — moving it
                        means promoting another row, which demotes this one. */}
                    <OwnerAction
                      isOwner={isOwner}
                      side="top"
                      label={primary ? "The primary account" : "Make this the primary"}
                    >
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-pressed={primary}
                        aria-label={`Primary account: ${label}`}
                        disabled={!isOwner || busy || primary}
                        onClick={() =>
                          update.mutate({
                            slug: account.slug,
                            patch: { isPrimary: true },
                          })
                        }
                      >
                        <Crown
                          className={cn(primary && "fill-current text-foreground")}
                        />
                      </Button>
                    </OwnerAction>
                  </div>
                </td>

                <td className="px-2 py-2">
                  <OwnerAction
                    isOwner={isOwner}
                    side="top"
                    label={
                      hidden
                        ? "Show in the nav again"
                        : "Drop from the nav — the pages stay reachable"
                    }
                  >
                    <Button
                      variant="ghost"
                      size="xs"
                      aria-pressed={hidden}
                      disabled={!isOwner || busy}
                      onClick={() =>
                        update.mutate({ slug: account.slug, patch: { hidden: !hidden } })
                      }
                    >
                      {hidden ? <EyeOff /> : <Eye />}
                      <span className={cn(!hidden && "text-muted-foreground")}>
                        {hidden ? "Hidden" : "Listed"}
                      </span>
                    </Button>
                  </OwnerAction>
                  {hidden && detail?.hiddenAt && (
                    <span className="ml-1 text-xs text-muted-foreground">
                      since {since(detail.hiddenAt)}
                    </span>
                  )}
                </td>

                <td className="px-2 py-2">
                  {/* Withheld rather than guessed. `syncPausedAt` only reaches
                      the owner, so without it this cell would render "Syncing"
                      for a paused account — the one state whose whole purpose is
                      to explain why an account looks stale. */}
                  {detail === null ? (
                    <span className="text-xs text-muted-foreground">
                      —<span className="sr-only">Sync state is owner-only</span>
                    </span>
                  ) : (
                    <>
                      <OwnerAction
                        isOwner={isOwner}
                        side="top"
                        label={
                          paused
                            ? "Resume fetching new games"
                            : "Stop fetching — history stays browsable"
                        }
                      >
                        <Button
                          variant="ghost"
                          size="xs"
                          aria-pressed={paused}
                          disabled={!isOwner || busy}
                          onClick={() =>
                            update.mutate({
                              slug: account.slug,
                              patch: { syncPaused: !paused },
                            })
                          }
                        >
                          {paused ? <Pause /> : <Play />}
                          <span className={cn(!paused && "text-muted-foreground")}>
                            {paused ? "Paused" : "Syncing"}
                          </span>
                        </Button>
                      </OwnerAction>
                      {paused && detail.syncPausedAt && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          since {since(detail.syncPausedAt)}
                        </span>
                      )}
                    </>
                  )}
                </td>

                <td className="py-2 pl-2 text-right">
                  {/* No confirm step. The api refuses to remove an account that
                      still has match rows, and re-adding the same Riot ID
                      re-attaches its history — the tuple is the join key — so
                      the reachable case is cheap to undo. */}
                  <OwnerAction
                    isOwner={isOwner}
                    side="top"
                    label="Remove from the roster"
                  >
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="text-muted-foreground hover:text-destructive"
                      aria-label={`Remove ${label}`}
                      disabled={!isOwner || busy}
                      onClick={() => remove.mutate(account.slug)}
                    >
                      <Trash2 />
                    </Button>
                  </OwnerAction>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
