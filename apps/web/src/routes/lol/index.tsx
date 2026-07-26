import { EmptyChampionIllustration, EmptyState } from "@/components/empty-state";
import { meQueryOptions } from "@/identity/use-me";
import { routeMeta } from "@/lib/route-meta";
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/lol/")({
  component: LolIndexPage,
  // `/lol` has no content of its own — it exists to hand you to the primary
  // account. Doing that with a client-side <Navigate> meant the redirect only
  // happened after a full document had been delivered, hydrated, and had run
  // its first render: a crawler reading HTML saw a spinner and stopped, and a
  // visitor paid for a page that was never going to be shown.
  //
  // `beforeLoad` runs before any of that. On a cold hit the server resolves it
  // during route matching and answers with a real redirect; on a client
  // navigation it settles before the route renders at all. `me` is already
  // awaited by the root loader, so `ensureQueryData` is a cache read here
  // rather than a second request.
  beforeLoad: async ({ context: { queryClient } }) => {
    const me = await queryClient.ensureQueryData(meQueryOptions());
    const firstSlug = me.lol[0]?.slug;
    if (firstSlug) {
      throw redirect({
        to: "/lol/$accountSlug",
        params: { accountSlug: firstSlug },
        replace: true,
      });
    }
  },
  head: () =>
    routeMeta({
      title: "League of Legends · vyoh.gg",
      description: "League of Legends profile, matches, and champion stats on vyoh.gg.",
    }),
});

// Reached only when there is no account to redirect to. The loading branch this
// used to carry is gone with the <Navigate>: `beforeLoad` has already awaited
// `me` by the time anything renders, and a rejection lands on the route's
// errorComponent rather than here.
function LolIndexPage() {
  return (
    <EmptyState
      illustration={<EmptyChampionIllustration />}
      title="No League account linked"
      hint="Link a Riot account and its profile, matches, and champion stats show up here."
    />
  );
}
