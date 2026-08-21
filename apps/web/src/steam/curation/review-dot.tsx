import { useSteamReviewCount } from "@/admin/use-admin-steam-games";
import { useIsOwner } from "@/auth/use-viewer";

/**
 * A dot on the Steam nav item while newly-purchased games are still
 * quarantined, because the quarantine is only half a feature without it: a game
 * that stays private until someone rules on it needs the owner to know there is
 * a ruling waiting.
 *
 * On the icon rather than beside the label — the label is hidden below `sm`, and
 * a badge that disappears on a phone is the wrong half to drop. Static, not
 * pulsing: this is one person's housekeeping notice, and an animation running on
 * every route for the lifetime of the tab is a paint cost the nav does not need.
 *
 * Renders nothing for a visitor, who cannot act on it and has no business
 * knowing that anything is pending.
 */
export function SteamReviewDot() {
  const isOwner = useIsOwner();
  const { data } = useSteamReviewCount(isOwner);
  const pending = data?.pendingReview ?? 0;

  if (!isOwner || pending === 0) return null;

  return (
    <span className="absolute top-1 right-1.5 z-10 size-2 rounded-full bg-amber-400 ring-2 ring-background">
      <span className="sr-only">
        {pending === 1
          ? "1 new game is waiting for you to decide whether it is public"
          : `${pending} new games are waiting for you to decide whether they are public`}
      </span>
    </span>
  );
}
