import { LeagueOfLegendsIcon, SteamIcon } from "@/components/brand-icons";
import { OrbGlyph } from "@/components/orb-glyph";
import { cn } from "@/lib/utils";
import { Link, useRouterState } from "@tanstack/react-router";
import { Activity, Home } from "lucide-react";
import { m } from "motion/react";

const NAV_ITEMS = [
  { to: "/", label: "Home", Icon: Home },
  { to: "/lol", label: "LoL", Icon: LeagueOfLegendsIcon },
  { to: "/steam", label: "Steam", Icon: SteamIcon },
  { to: "/status", label: "Status", Icon: Activity },
] as const;

function isItemActive(pathname: string, to: string) {
  if (to === "/") return pathname === "/";
  return pathname === to || pathname.startsWith(`${to}/`);
}

export function Nav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav className="sticky top-0 z-50 bg-background/60 backdrop-blur-md">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-foreground/15 to-transparent"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-sky-400/35 via-50% to-transparent opacity-70 blur-[1px]"
      />
      <div className="relative mx-auto flex max-w-4xl items-center gap-6 px-6 py-3">
        <Link to="/" className="flex items-center gap-2 text-lg font-bold tracking-tight">
          <OrbGlyph className="size-[1.5em] translate-y-[0.1em]" />
          <span className="flex items-baseline">
            <span className="bg-gradient-to-br from-sky-400 via-violet-400 to-emerald-400 bg-clip-text text-transparent">
              vyoh
            </span>
            <span className="text-muted-foreground">.gg</span>
          </span>
        </Link>
        <div className="flex gap-1">
          {NAV_ITEMS.map(({ to, label, Icon }) => {
            const active = isItemActive(pathname, to);
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  "relative rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                )}
              >
                <span className="relative z-10 flex items-center gap-2">
                  <Icon
                    className={cn("size-4 transition-transform", active && "scale-110")}
                  />
                  {label}
                </span>
                {active && (
                  <m.div
                    layoutId="top-nav-pill"
                    className="absolute inset-0 rounded-md bg-gradient-to-br from-foreground/10 to-foreground/5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] ring-1 ring-foreground/10"
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
