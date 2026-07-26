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
  // the path, so both queries can be awaited in parallel. The list is still
  // needed — `PatchesPage` reads the release date off it, and its loading
  // gate gives up only when both have landed.
  loader: ({ context: { queryClient }, params }) =>
    Promise.all([
      queryClient.ensureQueryData(patchListQueryOptions()),
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
