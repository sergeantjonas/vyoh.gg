import { routeMeta } from "@/lib/route-meta";
import { SessionsPage } from "@/steam/sessions/sessions-page";
import { sessionsQueryOptions } from "@/steam/sessions/use-sessions";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/steam/sessions")({
  component: SteamSessionsPage,
  // Primed, and fatal: one endpoint answers every band on the page, it reads
  // only our Postgres in ~35 ms, and at 45 kB for twelve weeks it is worth
  // carrying in the document so the hero, the strip and the records render as
  // an argument rather than a stack of skeletons. Because that one query *is*
  // the page, a failed prime takes the route down rather than answering 200
  // over a document of error cards — the same call `/steam/wishlist` makes.
  // The public projection, as every loader primes.
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(sessionsQueryOptions()),
  head: () =>
    routeMeta({
      title: "Steam sessions · vyoh.gg",
      description:
        "Every observed Steam session: how long the last one ran, what stood out in it, and the records of the last twelve weeks.",
    }),
});

function SteamSessionsPage() {
  return (
    <div className="flex flex-col gap-12">
      <SessionsPage />
    </div>
  );
}
