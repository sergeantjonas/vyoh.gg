import { routeMeta } from "@/lib/route-meta";
import { SessionsPage } from "@/steam/sessions/sessions-page";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/steam/sessions")({
  component: SteamSessionsPage,
  // No loader prime, deliberately — see `sessionsQueryOptions` for the payload
  // measurement behind that.
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
