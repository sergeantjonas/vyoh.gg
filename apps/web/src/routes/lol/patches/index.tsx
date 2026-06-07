import { routeMeta } from "@/lib/route-meta";
import { PatchesPage } from "@/lol/patches/patches-page";
import { validatePatchesSearch } from "@/lol/patches/patches-search";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/lol/patches/")({
  component: PatchesIndexRoute,
  validateSearch: validatePatchesSearch,
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
