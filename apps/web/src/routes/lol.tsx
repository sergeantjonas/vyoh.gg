import { useMe } from "@/identity/use-me";
import { cn } from "@/lib/utils";
import { Link, Outlet, createFileRoute } from "@tanstack/react-router";

const SUB_NAV = [
  { to: "/lol/matches", label: "Matches" },
  { to: "/lol/trends", label: "Trends" },
  { to: "/lol/champions", label: "Champions" },
] as const;

const linkClass = "px-3 py-2 text-sm font-medium transition-colors";

export const Route = createFileRoute("/lol")({
  component: LolLayout,
});

function LolLayout() {
  const me = useMe();
  const account = me.data?.lol[0];

  return (
    <div className="flex flex-col gap-6">
      {me.isError && <p className="text-sm text-destructive">{me.error.message}</p>}

      {account && (
        <section className="flex items-baseline gap-3">
          <h2 className="text-xl font-semibold">
            {account.gameName}
            <span className="text-muted-foreground">#{account.tagLine}</span>
          </h2>
          <span className="text-sm uppercase text-muted-foreground">
            {account.region}
          </span>
        </section>
      )}

      <div className="flex gap-1 border-b border-border">
        {SUB_NAV.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={cn(linkClass, "text-muted-foreground hover:text-foreground")}
            activeProps={{
              className: cn(
                linkClass,
                "text-foreground border-b-2 border-foreground -mb-px"
              ),
            }}
          >
            {item.label}
          </Link>
        ))}
      </div>

      <Outlet />
    </div>
  );
}
