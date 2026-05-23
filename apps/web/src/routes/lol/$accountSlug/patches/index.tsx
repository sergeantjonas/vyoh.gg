import { PatchesPage } from "@/lol/patches/patches-page";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/lol/$accountSlug/patches/")({
  component: AccountPatchesIndexRoute,
});

function AccountPatchesIndexRoute() {
  const { accountSlug } = Route.useParams();
  return <PatchesPage versionParam={undefined} asSlug={accountSlug} />;
}
