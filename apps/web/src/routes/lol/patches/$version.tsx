import { PatchesPage } from "@/lol/patches/patches-page";
import { validatePatchesSearch } from "@/lol/patches/patches-search";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/lol/patches/$version")({
  component: PatchesVersionRoute,
  validateSearch: validatePatchesSearch,
});

function PatchesVersionRoute() {
  const { version } = Route.useParams();
  const { as } = Route.useSearch();
  return <PatchesPage versionParam={version} asSlug={as} />;
}
