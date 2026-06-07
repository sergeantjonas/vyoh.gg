import { createFileRoute } from "@tanstack/react-router";

// Empty leaf. The matches list + filter UI live on the parent layout
// (apps/web/src/routes/lol/$accountSlug/matches.tsx) so that opening a
// $matchId panel does not unmount the list.
export const Route = createFileRoute("/lol/$accountSlug/matches/")({
  component: () => null,
});
