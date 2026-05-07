import { useAccountFromSlug } from "@/identity/use-account-from-slug";
import { cn } from "@/lib/utils";
import { AccountSwitcher } from "@/lol/account-switcher";
import { Link, Outlet, createFileRoute } from "@tanstack/react-router";

const linkClass = "px-3 py-2 text-sm font-medium transition-colors";

export const Route = createFileRoute("/lol/$accountSlug")({
  component: AccountLayout,
});

function AccountLayout() {
  const { accountSlug } = Route.useParams();
  const account = useAccountFromSlug(accountSlug);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
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
        <AccountSwitcher currentSlug={accountSlug} />
      </div>

      <div className="flex gap-1 border-b border-border">
        <Link
          to="/lol/$accountSlug/matches"
          params={{ accountSlug }}
          className={cn(linkClass, "text-muted-foreground hover:text-foreground")}
          activeProps={{
            className: cn(
              linkClass,
              "text-foreground border-b-2 border-foreground -mb-px"
            ),
          }}
          activeOptions={{ includeSearch: false }}
        >
          Matches
        </Link>
        <Link
          to="/lol/$accountSlug/trends"
          params={{ accountSlug }}
          className={cn(linkClass, "text-muted-foreground hover:text-foreground")}
          activeProps={{
            className: cn(
              linkClass,
              "text-foreground border-b-2 border-foreground -mb-px"
            ),
          }}
        >
          Trends
        </Link>
        <Link
          to="/lol/$accountSlug/champions"
          params={{ accountSlug }}
          className={cn(linkClass, "text-muted-foreground hover:text-foreground")}
          activeProps={{
            className: cn(
              linkClass,
              "text-foreground border-b-2 border-foreground -mb-px"
            ),
          }}
        >
          Champions
        </Link>
      </div>

      <Outlet />
    </div>
  );
}
