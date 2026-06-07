import { Loader } from "@/components/loader";
import { useMe } from "@/identity/use-me";
import { routeMeta } from "@/lib/route-meta";
import { Navigate, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/lol/")({
  component: LolIndexPage,
  head: () =>
    routeMeta({
      title: "League of Legends · vyoh.gg",
      description: "League of Legends profile, matches, and champion stats on vyoh.gg.",
    }),
});

function LolIndexPage() {
  const me = useMe();
  const firstSlug = me.data?.lol[0]?.slug;

  if (firstSlug) {
    return (
      <Navigate to="/lol/$accountSlug" params={{ accountSlug: firstSlug }} replace />
    );
  }

  if (me.isError) {
    return <p className="text-sm text-destructive">{me.error.message}</p>;
  }

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader size={14} label="Loading accounts" />
      <span>Loading accounts…</span>
    </div>
  );
}
