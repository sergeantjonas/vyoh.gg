import { PatchesPage } from "@/lol/patches/patches-page";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/lol/$accountSlug/patches/$version")({
  component: PatchesVersionRoute,
});

function PatchesVersionRoute() {
  const { accountSlug, version } = Route.useParams();
  return <PatchesPage versionParam={version} asSlug={accountSlug} />;
}
