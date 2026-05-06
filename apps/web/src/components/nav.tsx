import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";

const NAV_ITEMS = [
  { to: "/", label: "Home" },
  { to: "/lol", label: "LoL" },
  { to: "/steam", label: "Steam" },
] as const;

const linkClass = "rounded-md px-3 py-1.5 text-sm font-medium transition-colors";

export function Nav() {
  return (
    <nav className="border-b border-border">
      <div className="mx-auto flex max-w-4xl items-center gap-6 px-6 py-3">
        <Link to="/" className="font-bold tracking-tight">
          vyoh.gg
        </Link>
        <div className="flex gap-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                linkClass,
                "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
              activeProps={{
                className: cn(linkClass, "text-foreground bg-muted"),
              }}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
