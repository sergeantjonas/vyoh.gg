import { useUpdateSteamCuration } from "@/admin/use-admin-steam-games";
import { ControlHint } from "@/components/ui/control-hint";
import { cn } from "@/lib/utils";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useGameCuration } from "./use-game-curation";

/**
 * The owner's hide toggle for one game, in the place they noticed the game.
 *
 * Renders nothing for a visitor — not a disabled control. A locked "Hide from
 * visitors" button next to every game is noise that describes a capability the
 * page cannot offer, which is the case `OwnerAction`'s doc comment marks as
 * gate-at-the-section rather than disable-in-place.
 *
 * Any deliberate press is a ruling, so it stamps `reviewed` alongside the flag:
 * the owner cannot approve a quarantined game and still be asked about it. The
 * inverse — keep it hidden, but stop asking — is a two-state edit that belongs
 * on the `/status` overlay table, not on a one-button chip.
 */
export function HideGameButton({
  appid,
  name,
  compact = false,
  className,
}: {
  appid: number;
  /**
   * The game's title, where the surface knows it. Forwarded so the overlay row
   * gets a label on creation: the api falls back to the owned-game row's name,
   * which is null for a wishlisted or unpurchased appid, and `/status` would
   * then list it as a bare "App 1091500" forever. Ignored on an existing row.
   */
  name?: string | null | undefined;
  /** Icon-only, for a library row or tile where there is no room for words. */
  compact?: boolean;
  className?: string;
}) {
  const { isOwner, hidden, needsReview, isPending } = useGameCuration(appid);
  const update = useUpdateSteamCuration();

  if (!isOwner) return null;

  const busy = update.isPending || isPending;
  const label = hidden ? "Visible to visitors again" : "Hide from visitors";
  const Icon = hidden ? EyeOff : Eye;

  return (
    <ControlHint label={needsReview ? `${label} — needs your ruling` : label} side="top">
      <button
        type="button"
        // The whole row/tile is a link on the list surfaces, so a press here has
        // to stop before it becomes a navigation.
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          update.mutate({
            appid,
            patch: {
              hidden: !hidden,
              reviewed: true,
              // Only a real title — the placeholder a caller renders for an
              // unresolvable name would persist into the overlay as data.
              ...(name == null ? {} : { name }),
            },
          });
        }}
        disabled={busy}
        aria-pressed={hidden}
        aria-label={label}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium transition-colors",
          "disabled:opacity-60",
          hidden
            ? "border-amber-400/40 bg-amber-400/10 text-amber-200/90 hover:bg-amber-400/20"
            : "border-foreground/15 bg-foreground/5 text-foreground/85 hover:bg-foreground/10",
          needsReview && "border-dashed",
          className
        )}
      >
        {busy ? (
          <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
        ) : (
          <Icon aria-hidden="true" className="size-3.5" />
        )}
        {!compact && <span>{hidden ? "Hidden" : "Hide"}</span>}
      </button>
    </ControlHint>
  );
}
