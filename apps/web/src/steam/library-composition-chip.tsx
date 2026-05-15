import { Link } from "@tanstack/react-router";
import { FactCard } from "./_shared/fact-card";
import { useSteamLibrarySummary } from "./use-library-summary";

export function LibraryCompositionChip() {
  const { data, isPending, isError } = useSteamLibrarySummary();

  if (isPending) {
    return <FactCard title="Library" verdict="Loading library composition…" empty />;
  }

  if (isError || !data) {
    return (
      <FactCard
        title="Library"
        verdict="Library composition is unavailable right now."
        empty
      />
    );
  }

  if (data.ownedCount === 0) {
    return (
      <FactCard
        title="Library"
        verdict="Library hasn't synced yet — first poll lands at 04:00 Brussels time."
        empty
      />
    );
  }

  const { ownedCount, everLaunchedCount, untouchedCount } = data;
  const verdict = `${ownedCount} games owned, ${everLaunchedCount} ever launched.`;
  const prescription =
    untouchedCount > 0
      ? `${untouchedCount} still untouched — the backlog inside the library, not the wishlist.`
      : "Every owned title has been opened at least once.";

  return (
    <FactCard
      title="Library"
      metric={ownedCount}
      metricLabel={{ singular: "game", plural: "games" }}
      verdict={verdict}
      prescription={prescription}
      evidence={
        <Link
          to="/steam/library"
          className="text-sm text-foreground/70 underline-offset-2 hover:underline"
        >
          See the full library →
        </Link>
      }
    />
  );
}
