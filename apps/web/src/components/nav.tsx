import { LeagueOfLegendsIcon, SteamIcon } from "@/components/brand-icons";
import { useCommandPalette } from "@/components/command-palette-context";
import { OrbGlyph } from "@/components/orb-glyph";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import { useMe } from "@/identity/use-me";
import { cn } from "@/lib/utils";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { Link, useRouterState } from "@tanstack/react-router";
import { Activity, Home, ScrollText, Search } from "lucide-react";
import { m } from "motion/react";
import type { ComponentType, SVGProps } from "react";

const isMac = /Mac/i.test(navigator.platform);
const shortcutLabel = isMac ? "⌘K" : "Ctrl K";

function isItemActive(pathname: string, to: string) {
  if (to === "/") return pathname === "/";
  return pathname === to || pathname.startsWith(`${to}/`);
}

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

type LolAccount = {
  slug: string;
  gameName: string;
  tagLine: string;
  region: string;
};

export function Nav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { setOpen } = useCommandPalette();
  const me = useMe();
  const accounts: readonly LolAccount[] = me.data?.lol ?? [];
  // Pre-fill `?as=<slug>` from the viewer's default LoL account so
  // "Patches" lands on the personalized lens by default. Falls through to
  // the neutral global view when no default account is available.
  const defaultLolSlug = accounts[0]?.slug;
  const lolActive = isItemActive(pathname, "/lol");

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
        <NavigationMenu
          viewport={false}
          delayDuration={100}
          className="max-w-none justify-start"
        >
          <NavigationMenuList className="gap-1">
            <SimpleNavItem to="/" label="Home" Icon={Home} pathname={pathname} />
            <NavigationMenuItem>
              <NavigationMenuTrigger
                className={cn(
                  "relative h-auto cursor-pointer gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted/30 data-open:bg-muted/30",
                  lolActive
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <LeagueOfLegendsIcon
                  className={cn("size-4 transition-transform", lolActive && "scale-110")}
                  aria-hidden
                />
                <span className="relative z-10">LoL</span>
                {lolActive && <NavPillHighlight />}
              </NavigationMenuTrigger>
              <NavigationMenuContent className="!w-72 p-1">
                <LolMenuPanel accounts={accounts} defaultLolSlug={defaultLolSlug} />
              </NavigationMenuContent>
            </NavigationMenuItem>
            <SimpleNavItem
              to="/steam"
              label="Steam"
              Icon={SteamIcon}
              pathname={pathname}
            />
            <SimpleNavItem
              to="/status"
              label="Status"
              Icon={Activity}
              pathname={pathname}
            />
          </NavigationMenuList>
        </NavigationMenu>
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

function SimpleNavItem({
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
    <NavigationMenuItem>
      <NavigationMenuLink asChild active={active}>
        <Link
          to={to}
          className={cn(
            "relative flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors data-active:bg-transparent data-active:focus:bg-transparent data-active:hover:bg-transparent",
            active
              ? "text-foreground"
              : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
          )}
        >
          <Icon
            className={cn("size-4 transition-transform", active && "scale-110")}
            aria-hidden
          />
          <span className="relative z-10">{label}</span>
          {active && <NavPillHighlight />}
        </Link>
      </NavigationMenuLink>
    </NavigationMenuItem>
  );
}

function LolMenuPanel({
  accounts,
  defaultLolSlug,
}: {
  accounts: readonly LolAccount[];
  defaultLolSlug: string | undefined;
}) {
  return (
    <div className="flex flex-col">
      {accounts.length > 0 && (
        <>
          <div className="px-2 pt-1 pb-1 font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
            Accounts
          </div>
          <ul className="flex max-h-[300px] flex-col overflow-y-auto">
            {accounts.map((account) => (
              <li key={account.slug}>
                <NavigationMenuLink asChild>
                  <Link
                    to="/lol/$accountSlug"
                    params={{ accountSlug: account.slug }}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm"
                  >
                    <LeagueOfLegendsIcon
                      className="size-4 text-muted-foreground"
                      aria-hidden
                    />
                    <span className="flex-1 truncate">
                      <span>{account.gameName}</span>
                      <span className="text-muted-foreground">#{account.tagLine}</span>
                    </span>
                    <span className="text-[10px] text-muted-foreground uppercase">
                      {account.region}
                    </span>
                  </Link>
                </NavigationMenuLink>
              </li>
            ))}
          </ul>
          <div className="my-1 h-px bg-border" />
        </>
      )}
      <NavigationMenuLink asChild>
        <Link
          to="/lol/patches"
          search={defaultLolSlug ? { as: defaultLolSlug } : {}}
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm"
        >
          <ScrollText className="size-4" aria-hidden />
          Patches
        </Link>
      </NavigationMenuLink>
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
