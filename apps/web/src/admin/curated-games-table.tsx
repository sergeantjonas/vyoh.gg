import { Button } from "@/components/ui/button";
import { ControlHint } from "@/components/ui/control-hint";
import { type AdminSteamGame, OWNER_TIME_ZONE } from "@vyoh/shared";
import { Check, Eye, EyeOff, Star, StarOff, Trash2 } from "lucide-react";
import { useClearSteamCuration, useUpdateSteamCuration } from "./use-admin-steam-games";

const SINCE_FMT = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: OWNER_TIME_ZONE,
});

/**
 * The curation overlay, one row per curated appid.
 *
 * The two axes are separate columns because they are separate decisions:
 * `hidden` is privacy (never named to a visitor) and `unfeatured` is art
 * direction (still listed, never promoted to a chapter on `/`). Collapsing them
 * into one "curated" state is the mistake the schema was written to prevent —
 * un-hiding a game would silently re-promote it to a chapter.
 *
 * Review is its own column rather than a side effect of touching a flag, which
 * is the difference from the in-context toggle: here the owner can say "yes I
 * looked, keep it hidden" without changing what visitors see.
 */
export function CuratedGamesTable({ rows }: { rows: AdminSteamGame[] }) {
  const update = useUpdateSteamCuration();
  const clear = useClearSteamCuration();
  const busy = update.isPending || clear.isPending;

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nothing curated. New purchases land here quarantined until you rule on them.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="py-2 pr-3 text-left font-medium">Game</th>
            <th className="px-2 py-2 text-left font-medium">Visibility</th>
            <th className="px-2 py-2 text-left font-medium">Featuring</th>
            <th className="px-2 py-2 text-left font-medium">Review</th>
            <th className="py-2 pl-2 text-right font-medium">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const hidden = row.hiddenAt !== null;
            const unfeatured = row.unfeaturedAt !== null;
            const needsReview = row.reviewedAt === null;

            return (
              <tr key={row.appid} className="border-t">
                <td className="py-2 pr-3">
                  <span className="font-medium text-foreground">
                    {row.name ?? `App ${row.appid}`}
                  </span>
                  <span className="ml-2 text-xs text-muted-foreground">{row.appid}</span>
                  {row.note !== null && (
                    <span className="ml-2 text-xs text-muted-foreground italic">
                      {row.note}
                    </span>
                  )}
                </td>

                <td className="px-2 py-2">
                  <ControlHint label={hidden ? "Show to visitors" : "Hide from visitors"}>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-pressed={hidden}
                      aria-label={hidden ? "Show to visitors" : "Hide from visitors"}
                      disabled={busy}
                      onClick={() =>
                        update.mutate({ appid: row.appid, patch: { hidden: !hidden } })
                      }
                    >
                      {hidden ? (
                        <EyeOff className="text-amber-400" />
                      ) : (
                        <Eye className="text-muted-foreground" />
                      )}
                    </Button>
                  </ControlHint>
                  {hidden && (
                    <span className="ml-1 text-xs text-muted-foreground">
                      since {SINCE_FMT.format(new Date(row.hiddenAt ?? row.createdAt))}
                    </span>
                  )}
                </td>

                <td className="px-2 py-2">
                  <ControlHint
                    label={
                      unfeatured
                        ? "Allow as a chapter on the landing page"
                        : "Never feature as a chapter"
                    }
                  >
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-pressed={unfeatured}
                      aria-label={
                        unfeatured ? "Allow as a chapter" : "Never feature as a chapter"
                      }
                      disabled={busy}
                      onClick={() =>
                        update.mutate({
                          appid: row.appid,
                          patch: { unfeatured: !unfeatured },
                        })
                      }
                    >
                      {unfeatured ? (
                        <StarOff className="text-muted-foreground" />
                      ) : (
                        <Star className="text-foreground/70" />
                      )}
                    </Button>
                  </ControlHint>
                </td>

                <td className="px-2 py-2">
                  {needsReview ? (
                    <ControlHint label="Mark as decided, leaving the flags as they are">
                      <Button
                        variant="outline"
                        size="xs"
                        disabled={busy}
                        onClick={() =>
                          update.mutate({ appid: row.appid, patch: { reviewed: true } })
                        }
                      >
                        <Check className="size-3.5" />
                        Needs review
                      </Button>
                    </ControlHint>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {SINCE_FMT.format(new Date(row.reviewedAt ?? row.createdAt))}
                    </span>
                  )}
                </td>

                <td className="py-2 pl-2 text-right">
                  {/* Distinct from `hidden: false` — dropping the row forgets
                      the note and the record that a decision was made here. */}
                  <ControlHint label="Forget this ruling entirely">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label="Forget this ruling entirely"
                      disabled={busy}
                      onClick={() => clear.mutate(row.appid)}
                    >
                      <Trash2 className="text-destructive/80" />
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
