import { routeMeta } from "@/lib/route-meta";
import { PatchesPage } from "@/lol/patches/patches-page";
import { validatePatchesSearch } from "@/lol/patches/patches-search";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/lol/patches/$version")({
  component: PatchesVersionRoute,
  validateSearch: validatePatchesSearch,
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
