import { PatchesPage } from "@/lol/patches/patches-page";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/lol/$accountSlug/patches/")({
  component: () => <PatchesPage versionParam={undefined} />,
});
