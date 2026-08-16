import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toastSuccess } from "@/lib/toast";
import type { AdminLolAccount, AdminPurgePreview } from "@vyoh/shared";
import { useState } from "react";
import { useAdminPurgePreview, usePurgeAccount } from "./use-admin-accounts";

/**
 * Rounded hard, and never to more than three significant figures. The number it
 * renders is an average-row-width estimate, so a reading like "162.7 MB" would
 * dress a guess up as a measurement.
 */
function approxSize(bytes: number): string {
  if (bytes < 1_000_000) return "under 1 MB";
  const mb = bytes / 1_000_000;
  if (mb < 1000) return `~${Math.round(mb)} MB`;
  return `~${(mb / 1000).toFixed(1)} GB`;
}

/**
 * The one irreversible action in the app, so it is built to be slow in the
 * places that matter: counts fetched fresh on open, the slug typed back by
 * hand, and the button inert until it matches.
 *
 * Rendered by the caller as a controlled dialog rather than wrapping its own
 * trigger, the way `AddLolAccountDialog` does. The trigger lives in a table row
 * that unmounts when the roster invalidates — which is precisely what purging
 * does — and a dialog owned by that row would go with it mid-transition.
 */
export function PurgeAccountDialog({
  account,
  onClose,
}: {
  account: AdminLolAccount | null;
  onClose: () => void;
}) {
  const [typed, setTyped] = useState("");
  const preview = useAdminPurgePreview(account?.slug ?? null);
  const purge = usePurgeAccount();

  const label = account ? `${account.gameName}#${account.tagLine}` : "";
  const confirmed = account !== null && typed === account.slug;

  const close = () => {
    setTyped("");
    purge.reset();
    onClose();
  };

  return (
    <Dialog open={account !== null} onOpenChange={(next) => !next && close()}>
      <DialogContent className="p-5">
        <DialogTitle>Purge {label}</DialogTitle>
        <DialogDescription>
          Deletes the account's match history, rank snapshots and cached details. This
          cannot be undone — re-adding the Riot ID gives you an empty account, not this
          one.
        </DialogDescription>

        {account && (
          <div className="flex flex-col gap-3">
            {preview.isPending && (
              <p className="text-sm text-muted-foreground">Counting what this holds…</p>
            )}

            {preview.error && (
              <p role="alert" className="text-sm text-destructive">
                {preview.error.message}
              </p>
            )}

            {preview.data && <PreviewCounts preview={preview.data} />}

            <label htmlFor="purge-confirm" className="flex flex-col gap-1 text-sm">
              <span>
                Type <code className="font-medium text-foreground">{account.slug}</code>{" "}
                to confirm
              </span>
              <Input
                id="purge-confirm"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                // The one field in the app where a helpful correction would be
                // actively harmful: the point is that the operator reproduces
                // the slug, not that the browser does.
                autoCorrect="off"
                spellCheck={false}
              />
            </label>

            {purge.error && (
              <p role="alert" className="text-sm text-destructive">
                {purge.error.message}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="ghost" size="sm" onClick={close}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={!confirmed || purge.isPending}
                onClick={() =>
                  purge.mutate(
                    { slug: account.slug, confirm: typed },
                    {
                      onSuccess: (result) => {
                        void toastSuccess(
                          `Purged ${label} — ${result.matches} match(es) removed`
                        );
                        close();
                      },
                    }
                  )
                }
              >
                {purge.isPending ? "Purging…" : "Purge everything"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Zero rows is worth stating outright rather than rendering as a table of
 * noughts — an account that never synced is the one case where purge is
 * indistinguishable from remove, and saying so is what stops the operator
 * hunting for the difference.
 */
function PreviewCounts({ preview }: { preview: AdminPurgePreview }) {
  if (preview.matches === 0 && preview.rankSnapshots === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No synced history — this only removes the roster row.
      </p>
    );
  }

  const lines: [string, number][] = [
    ["Matches", preview.matches],
    ["Rank snapshots", preview.rankSnapshots],
    ["Cached match details", preview.detailCacheRows],
    ["Cached timelines", preview.timelineCacheRows],
  ];

  return (
    <div className="rounded-md border bg-muted/40 p-3 text-sm">
      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
        {lines.map(([name, count]) => (
          <div key={name} className="contents">
            <dt className="text-muted-foreground">{name}</dt>
            <dd className="text-right font-medium tabular-nums">
              {count.toLocaleString("en-GB")}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 border-t pt-2 text-xs text-muted-foreground">
        Frees {approxSize(preview.estimatedBytes)}. Cached rows are only counted when no
        other tracked account played the same game.
      </p>
    </div>
  );
}
