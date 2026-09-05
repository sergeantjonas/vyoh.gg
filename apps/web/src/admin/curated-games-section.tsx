import { useIsOwner } from "@/auth/use-viewer";
import { Badge, StatusCard } from "@/status/status-primitives";
import { CuratedGamesTable } from "./curated-games-table";
import { useAdminSteamGames } from "./use-admin-steam-games";

/**
 * The Steam curation overlay.
 *
 * Absent for anyone but the owner rather than rendered read-only, for a sharper
 * reason than the roster above: an enumeration of the hidden games is precisely
 * the secret the hiding exists to keep, so the api gates this read as well as
 * its writes. A locked copy of it would be a leak wearing a disabled button.
 */
export function CuratedGamesSection() {
  const isOwner = useIsOwner();
  // Before the gate, so hook order stays stable across the flip from pending
  // viewer to confirmed owner. `enabled` keeps a signed-out visit from firing a
  // request that is known to 401.
  const games = useAdminSteamGames(isOwner);

  if (!isOwner) return null;

  const pending = games.data?.pendingReview ?? 0;

  return (
    <StatusCard
      title="Curated Steam games"
      badges={pending > 0 && <Badge tone="warn">{pending} awaiting your ruling</Badge>}
      description="Per-game privacy and featuring overlay. New purchases arrive hidden until you rule on them."
    >
      {games.data ? (
        <CuratedGamesTable rows={games.data.entries} />
      ) : (
        <p className="text-sm text-muted-foreground">Loading the overlay…</p>
      )}
    </StatusCard>
  );
}
