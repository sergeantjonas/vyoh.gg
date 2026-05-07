import { useMe } from "@/identity/use-me";
import { Navigate, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/lol/")({
  component: LolIndexPage,
});

function LolIndexPage() {
  const me = useMe();
  const firstSlug = me.data?.lol[0]?.slug;

  if (firstSlug) {
    return (
      <Navigate
        to="/lol/$accountSlug/matches"
        params={{ accountSlug: firstSlug }}
        replace
      />
    );
  }

  if (me.isError) {
    return <p className="text-sm text-destructive">{me.error.message}</p>;
  }

  return <p className="text-sm text-muted-foreground">Loading accounts…</p>;
}
