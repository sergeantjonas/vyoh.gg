import { LeagueOfLegendsIcon, SteamIcon } from "@/components/brand-icons";
import { useCommandPalette } from "@/components/command-palette-context";
import { OrbGlyph } from "@/components/orb-glyph";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMe } from "@/identity/use-me";
import { cn } from "@/lib/utils";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { Link, useRouterState } from "@tanstack/react-router";
import { Activity, ChevronDown, Home, ScrollText, Search } from "lucide-react";
import { m } from "motion/react";
import type { ComponentType, SVGProps } from "react";

const NAV_ITEMS = [
  { to: "/", label: "Home", Icon: Home },
  { to: "/steam", label: "Steam", Icon: SteamIcon },
  { to: "/status", label: "Status", Icon: Activity },
] as const;

const isMac = /Mac/i.test(navigator.platform);
const shortcutLabel = isMac ? "⌘K" : "Ctrl K";

const LINK_BASE = "relative rounded-md px-3 py-1.5 text-sm font-medium transition-colors";
const LINK_ACTIVE = "text-foreground";
const LINK_INACTIVE = "text-muted-foreground hover:bg-muted/30 hover:text-foreground";

function isItemActive(pathname: string, to: string) {
  if (to === "/") return pathname === "/";
  return pathname === to || pathname.startsWith(`${to}/`);
}

export function Nav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { setOpen } = useCommandPalette();
  const me = useMe();
  // The dropdown pre-fills `?as=<slug>` from the viewer's default LoL
  // account so "Patches" lands on the personalized lens by default. When
  // no default account is available (logged out, no Riot accounts linked),
  // the link falls through to the neutral global view.
  const defaultLolSlug = me.data?.lol[0]?.slug;

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
          <SimpleNavLink to="/" label="Home" Icon={Home} pathname={pathname} />
          <LolPill pathname={pathname} defaultLolSlug={defaultLolSlug} />
          {NAV_ITEMS.filter((i) => i.to !== "/").map(({ to, label, Icon }) => (
            <SimpleNavLink
              key={to}
              to={to}
              label={label}
              Icon={Icon}
              pathname={pathname}
            />
          ))}
        </div>
        <TooltipPrimitive.Root>
          <TooltipPrimitive.Trigger asChild>
            <button
              type="button"
              aria-label="Open command palette"
              onClick={() => setOpen(true)}
              className="ml-auto cursor-pointer rounded border bg-muted/50 px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <span className="hidden sm:inline">{shortcutLabel}</span>
              <Search className="size-4 sm:hidden" aria-hidden />
            </button>
          </TooltipPrimitive.Trigger>
          <TooltipPrimitive.Portal>
            <TooltipPrimitive.Content
              side="bottom"
              sideOffset={6}
              className="pointer-events-none z-50 rounded-md border bg-popover/85 px-2 py-1 text-xs text-popover-foreground shadow-xl backdrop-blur-md"
            >
              Open command palette
            </TooltipPrimitive.Content>
          </TooltipPrimitive.Portal>
        </TooltipPrimitive.Root>
      </div>
    </nav>
  );
}

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

function SimpleNavLink({
  to,
  label,
  Icon,
  pathname,
}: {
  to: string;
  label: string;
  Icon: IconComponent;
  pathname: string;
}) {
  const active = isItemActive(pathname, to);
  return (
    <Link to={to} className={cn(LINK_BASE, active ? LINK_ACTIVE : LINK_INACTIVE)}>
      <span className="relative z-10 flex items-center gap-2">
        <Icon className={cn("size-4 transition-transform", active && "scale-110")} />
        {label}
      </span>
      {active && <NavPillHighlight />}
    </Link>
  );
}

function LolPill({
  pathname,
  defaultLolSlug,
}: {
  pathname: string;
  defaultLolSlug: string | undefined;
}) {
  const active = isItemActive(pathname, "/lol");
  return (
    <div
      className={cn(
        "relative flex items-center rounded-md",
        active ? LINK_ACTIVE : LINK_INACTIVE
      )}
    >
      <Link
        to="/lol"
        className="relative z-10 flex items-center gap-2 rounded-l-md px-3 py-1.5 text-sm font-medium"
      >
        <LeagueOfLegendsIcon
          className={cn("size-4 transition-transform", active && "scale-110")}
        />
        LoL
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Open LoL menu"
          className="relative z-10 flex cursor-pointer items-center rounded-r-md py-1.5 pr-2 pl-0.5 text-sm transition-colors data-[state=open]:text-foreground"
        >
          <ChevronDown className="size-3.5" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={6} className="min-w-40">
          <DropdownMenuItem asChild>
            <Link
              to="/lol/patches"
              search={defaultLolSlug ? { as: defaultLolSlug } : {}}
              className="cursor-pointer"
            >
              <ScrollText className="size-4" aria-hidden />
              Patches
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {active && <NavPillHighlight />}
    </div>
  );
}

function NavPillHighlight() {
  return (
    <m.div
      layoutId="top-nav-pill"
      className="absolute inset-0 rounded-md bg-gradient-to-br from-foreground/10 to-foreground/5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] ring-1 ring-foreground/10"
      transition={{ type: "spring", stiffness: 500, damping: 35 }}
    />
  );
}
