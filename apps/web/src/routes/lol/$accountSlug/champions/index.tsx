import { createFileRoute } from "@tanstack/react-router";

// Empty leaf. The champion list + filters live on the parent layout
// (apps/web/src/routes/lol/$accountSlug/champions.tsx) so that opening a
// $championKey panel does not unmount the list.
export const Route = createFileRoute("/lol/$accountSlug/champions/")({
  component: () => null,
});
