import { routeMeta } from "@/lib/route-meta";
import { PatchesPage } from "@/lol/patches/patches-page";
import { validatePatchesSearch } from "@/lol/patches/patches-search";
import { patchChangesQueryOptions } from "@/lol/patches/use-patch-changes";
import { patchListQueryOptions } from "@/lol/patches/use-patch-list";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/lol/patches/")({
  component: PatchesIndexRoute,
  validateSearch: validatePatchesSearch,
  // Awaited, so the patch notes are in the server-rendered HTML rather than
  // fetched after hydration. This is the whole point of the route for a
  // crawler: the champion/item/rune changes are the page's indexable content,
  // and they only change when a patch ships.
  //
  // The two queries are dependent, not parallel: which changeset to fetch is
  // the *newest entry of the list*, so the list has to settle first. Priming
  // only the list leaves the page rendering `PatchesLoading`, because its
  // gate is `!patchChanges && (patchList === undefined || changesPending)` —
  // one of the two being warm is not enough to clear it.
  //
  // Both halves are deliberately fatal, unlike the tolerated primes elsewhere
  // (see `primeQuietly`). The list picks the version, so losing it loses the
  // page outright; losing the changeset drops `PatchesPage` into `PatchesEmpty`
  // before the version sidebar renders, so swallowing would serve an empty
  // unnavigable document at HTTP 200 — and this is the route the SSR migration
  // exists to get indexed. A 500 tells a crawler to come back.
  loader: async ({ context: { queryClient } }) => {
    const patches = await queryClient.ensureQueryData(patchListQueryOptions());
    const newest = patches[0]?.version;
    if (newest) {
      await queryClient.ensureQueryData(patchChangesQueryOptions(newest));
    }
  },
  head: () =>
    routeMeta({
      title: "Patches · LoL · vyoh.gg",
      description: "League of Legends patch notes browser on vyoh.gg.",
    }),
});

function PatchesIndexRoute() {
  const { as } = Route.useSearch();
  return <PatchesPage versionParam={undefined} asSlug={as} />;
}
