import { Button } from "@/components/ui/button";
import { ControlHint } from "@/components/ui/control-hint";
import { cn } from "@/lib/utils";
import { type AdminLolAccount, OWNER_TIME_ZONE } from "@vyoh/shared";
import { Crown, Eye, EyeOff, Pause, Play, Star, Trash2 } from "lucide-react";
import { useDeleteLolAccount, useUpdateLolAccount } from "./use-admin-accounts";

const SINCE_FMT = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: OWNER_TIME_ZONE,
});

/**
 * The roster, one row per tracked Riot account.
 *
 * Hide and pause are rendered as *state* rather than as menu actions: a roster
 * where three of nine rows are paused has to be legible at a glance, otherwise
 * "why is this account stale" turns into a debugging session. So both are
 * toggles carrying their own resting label, not verbs behind an overflow menu.
 */
export function LolAccountsTable({ rows }: { rows: AdminLolAccount[] }) {
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
          {rows.map((account) => {
            const hidden = account.hiddenAt !== null;
            const paused = account.syncPausedAt !== null;
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
                    <ControlHint
                      label={
                        account.isOwner ? "Stop counting as mine" : "Count as one of mine"
                      }
                    >
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-pressed={account.isOwner}
                        aria-label={`Owner account: ${label}`}
                        disabled={busy}
                        onClick={() =>
                          update.mutate({
                            slug: account.slug,
                            patch: { isOwner: !account.isOwner },
                          })
                        }
                      >
                        <Star
                          className={cn(
                            account.isOwner && "fill-current text-foreground"
                          )}
                        />
                      </Button>
                    </ControlHint>
                    {/* Promotion only. Clearing the flag would leave a roster with
                        owners and no primary, which the api rejects — moving it
                        means promoting another row, which demotes this one. */}
                    <ControlHint
                      label={
                        account.isPrimary
                          ? "The primary account"
                          : "Make this the primary"
                      }
                    >
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-pressed={account.isPrimary}
                        aria-label={`Primary account: ${label}`}
                        disabled={busy || account.isPrimary}
                        onClick={() =>
                          update.mutate({
                            slug: account.slug,
                            patch: { isPrimary: true },
                          })
                        }
                      >
                        <Crown
                          className={cn(
                            account.isPrimary && "fill-current text-foreground"
                          )}
                        />
                      </Button>
                    </ControlHint>
                  </div>
                </td>

                <td className="px-2 py-2">
                  <ControlHint
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
                      disabled={busy}
                      onClick={() =>
                        update.mutate({ slug: account.slug, patch: { hidden: !hidden } })
                      }
                    >
                      {hidden ? <EyeOff /> : <Eye />}
                      <span className={cn(!hidden && "text-muted-foreground")}>
                        {hidden ? "Hidden" : "Listed"}
                      </span>
                    </Button>
                  </ControlHint>
                  {account.hiddenAt && (
                    <span className="ml-1 text-xs text-muted-foreground">
                      since {SINCE_FMT.format(new Date(account.hiddenAt))}
                    </span>
                  )}
                </td>

                <td className="px-2 py-2">
                  <ControlHint
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
                      disabled={busy}
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
                  </ControlHint>
                  {account.syncPausedAt && (
                    <span className="ml-1 text-xs text-muted-foreground">
                      since {SINCE_FMT.format(new Date(account.syncPausedAt))}
                    </span>
                  )}
                </td>

                <td className="py-2 pl-2 text-right">
                  {/* No confirm step. The api refuses to remove an account that
                      still has match rows, and re-adding the same Riot ID
                      re-attaches its history — the tuple is the join key — so
                      the reachable case is cheap to undo. */}
                  <ControlHint label="Remove from the roster">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="text-muted-foreground hover:text-destructive"
                      aria-label={`Remove ${label}`}
                      disabled={busy}
                      onClick={() => remove.mutate(account.slug)}
                    >
                      <Trash2 />
                    </Button>
                  </ControlHint>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
