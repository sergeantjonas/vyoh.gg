import {
  useAdminSteamGames,
  useSteamReviewCount,
  useUpdateSteamCuration,
} from "@/admin/use-admin-steam-games";
import { useIsOwner } from "@/auth/use-viewer";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { Eye, EyeOff, PackagePlus } from "lucide-react";

// Beyond a handful the card stops being a question and becomes a table. A bulk
// arrival — a bundle, a family-share flip, a first sync against a fresh DB —
// belongs on /status, which is the surface built for ruling in volume.
const SHOWN = 3;

/**
 * Asks the owner about games the poller quarantined.
 *
 * The quarantine is only half a feature without this. A new purchase is hidden
 * on insert because the poller runs unattended and cannot ask, but "private
 * until someone rules on it" needs the ruling to actually be requested — a dot
 * on the nav says *that* something is waiting without ever asking *what*.
 *
 * Two buttons, not one: "show it" and "keep hidden" are both rulings, and the
 * second changes nothing a visitor can see. That is exactly the two-state edit
 * the in-context `HideGameButton` cannot express, which is why the toggle
 * stamps `reviewed` on every press and this card exists alongside it.
 *
 * Not dismissible, deliberately. A prompt that can be waved away is the nav dot
 * again, and the whole request here was to be asked. It only appears after a
 * real purchase, and answering is one click per game.
 */
export function NewPurchasePrompt() {
  const isOwner = useIsOwner();
  const { data: count } = useSteamReviewCount(isOwner);
  const pending = count?.pendingReview ?? 0;
  // The list is gated behind the cheap count, which the nav dot has already
  // primed — so a Steam page with nothing pending issues no extra request.
  const { data } = useAdminSteamGames(isOwner && pending > 0);
  const update = useUpdateSteamCuration();

  // Only the poller mints an unreviewed row, and it always sets `hiddenAt`, so
  // "unreviewed" and "quarantined new purchase" are the same set. An
  // owner-made ruling is reviewed on arrival by definition.
  const waiting = (data?.entries ?? []).filter((entry) => entry.reviewedAt === null);

  if (!isOwner || pending === 0 || waiting.length === 0) return null;

  return (
    <section
      aria-labelledby="new-purchase-prompt-title"
      className="mb-6 flex flex-col gap-3 rounded-lg border border-amber-400/35 bg-amber-400/[0.06] p-4"
    >
      <div className="flex items-start gap-3">
        <PackagePlus
          aria-hidden="true"
          className="mt-0.5 size-4 shrink-0 text-amber-300/90"
        />
        <div className="flex flex-col gap-0.5">
          <h2
            id="new-purchase-prompt-title"
            className="text-sm font-semibold text-foreground"
          >
            {waiting.length === 1
              ? "A new game showed up in your library"
              : `${waiting.length} new games showed up in your library`}
          </h2>
          <p className="text-xs text-muted-foreground">
            {waiting.length === 1 ? "It is" : "They are"} hidden from visitors until you
            say otherwise.
          </p>
        </div>
      </div>

      <ul className="flex flex-col gap-2">
        {waiting.slice(0, SHOWN).map((entry) => (
          <li
            key={entry.appid}
            className="flex flex-wrap items-center gap-2 rounded-md border border-foreground/10 bg-background/40 px-3 py-2"
          >
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
              {entry.name ?? `App ${entry.appid}`}
            </span>
            <Button
              variant="outline"
              size="xs"
              disabled={update.isPending}
              onClick={() =>
                update.mutate({
                  appid: entry.appid,
                  patch: { hidden: false, reviewed: true },
                })
              }
            >
              <Eye aria-hidden="true" className="size-3.5" />
              Show it
            </Button>
            <Button
              variant="ghost"
              size="xs"
              disabled={update.isPending}
              onClick={() =>
                update.mutate({ appid: entry.appid, patch: { reviewed: true } })
              }
            >
              <EyeOff aria-hidden="true" className="size-3.5" />
              Keep hidden
            </Button>
          </li>
        ))}
      </ul>

      {waiting.length > SHOWN && (
        <Link
          to="/status"
          className="self-start text-xs font-medium text-amber-200/90 underline-offset-2 hover:underline"
        >
          {waiting.length - SHOWN} more waiting — rule on all of them in Status
        </Link>
      )}
    </section>
  );
}
