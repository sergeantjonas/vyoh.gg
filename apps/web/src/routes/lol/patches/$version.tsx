import { primeQuietly } from "@/lib/prime-quietly";
import { routeMeta } from "@/lib/route-meta";
import { PatchesPage } from "@/lol/patches/patches-page";
import { validatePatchesSearch } from "@/lol/patches/patches-search";
import { patchChangesQueryOptions } from "@/lol/patches/use-patch-changes";
import { patchListQueryOptions } from "@/lol/patches/use-patch-list";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/lol/patches/$version")({
  component: PatchesVersionRoute,
  validateSearch: validatePatchesSearch,
  // Same shape as the index route, minus the dependency: the version is in
  // the path, so both queries can be awaited in parallel.
  //
  // Only the changeset is fatal. It is the page — without it `PatchesPage`
  // returns `PatchesEmpty` before it renders the version sidebar, so tolerating
  // it would serve an empty unnavigable document at HTTP 200 and teach a
  // crawler that the patch notes this route exists to get indexed aren't there.
  // The list only supplies the release date (read through `patchList?.find`),
  // so its failure costs one line of a page that is otherwise entirely intact.
  loader: ({ context: { queryClient }, params }) =>
    Promise.all([
      primeQuietly(queryClient.ensureQueryData(patchListQueryOptions())),
      queryClient.ensureQueryData(patchChangesQueryOptions(params.version)),
    ]),
  head: ({ params }) =>
    routeMeta({
      title: `Patch ${params.version} · LoL · vyoh.gg`,
      description: `League of Legends patch ${params.version} notes on vyoh.gg.`,
    }),
});

function PatchesVersionRoute() {
  const { version } = Route.useParams();
  const { as } = Route.useSearch();
  return <PatchesPage versionParam={version} asSlug={as} />;
}
