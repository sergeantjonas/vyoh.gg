import { useIsOwner } from "@/auth/use-viewer";
import { SectionTitle } from "@/components/ui/section-title";
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
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <SectionTitle as="h2">Curated Steam games</SectionTitle>
        {pending > 0 && (
          <span className="rounded-md border border-amber-400/40 bg-amber-400/10 px-2 py-1 text-xs font-medium text-amber-200/90">
            {pending} awaiting your ruling
          </span>
        )}
      </div>
      {games.data ? (
        <CuratedGamesTable rows={games.data.entries} />
      ) : (
        <p className="text-sm text-muted-foreground">Loading the overlay…</p>
      )}
    </section>
  );
}
