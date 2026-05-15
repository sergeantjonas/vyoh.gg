import { cn } from "@/lib/utils";
import { Link, Outlet, createFileRoute, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Library, ListChecks, Trophy } from "lucide-react";

export const Route = createFileRoute("/steam")({
  component: SteamLayout,
});

const TABS = [
  { to: "/steam", label: "Profile", Icon: LayoutDashboard, exact: true },
  { to: "/steam/library", label: "Library", Icon: Library, exact: false },
  { to: "/steam/wishlist", label: "Wishlist", Icon: ListChecks, exact: false },
  { to: "/steam/achievements", label: "Achievements", Icon: Trophy, exact: false },
] as const;

function SteamLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground/60">
          Steam
        </p>
        <nav
          aria-label="Steam sections"
          className="flex items-center gap-1 border-b border-border/40"
        >
          {TABS.map((tab) => {
            const active = tab.exact
              ? pathname === tab.to
              : pathname === tab.to || pathname.startsWith(`${tab.to}/`);
            return (
              <Link
                key={tab.to}
                to={tab.to}
                className={cn(
                  "-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition-colors",
                  active
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <tab.Icon className="size-4" />
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <Outlet />
    </div>
  );
}
