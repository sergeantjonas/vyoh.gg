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
import { rankEmblemUrl } from "@/lol/_shared/assets/champion-icon";
import { profileIconUrl } from "@/lol/_shared/assets/summoner-icon";
import { useDDragonVersion } from "@/lol/_shared/patch/use-ddragon-version";
import { useRankedEmblemYear } from "@/lol/_shared/use-ranked-emblem-year";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { Link, useRouterState } from "@tanstack/react-router";
import type { LolAccountWithSummary } from "@vyoh/shared";
import { formatRank } from "@vyoh/shared/lol/rank-history";
import { Activity, Home, ScrollText, Search } from "lucide-react";
import { m } from "motion/react";
import { type ComponentType, type SVGProps, useRef, useState } from "react";

const isMac = /Mac/i.test(navigator.platform);
const shortcutLabel = isMac ? "⌘K" : "Ctrl K";

function isItemActive(pathname: string, to: string) {
  if (to === "/") return pathname === "/";
  return pathname === to || pathname.startsWith(`${to}/`);
}

// Returns the account slug segment from a `/lol/<slug>/...` pathname,
// or null for non-account-scoped LoL routes (e.g. `/lol/patches`).
function activeAccountSlug(pathname: string): string | null {
  if (!pathname.startsWith("/lol/")) return null;
  const segment = pathname.slice("/lol/".length).split("/")[0] ?? "";
  // `patches` is a reserved global subpath, not an account.
  if (segment === "" || segment === "patches") return null;
  return segment;
}

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

// Local alias for readability at call sites. `LolAccountWithSummary` from
// shared is the `/me` wire shape the nav consumes.
type NavLolAccount = LolAccountWithSummary;

// Open-animation window. The shadcn NavigationMenu content's zoom-in /
// fade-in lasts ~200ms; click events landing inside that window are
// almost always the trailing edge of the hover-or-tap that opened the
// menu in the first place, not a deliberate dismiss. Suppress those and
// late deliberate clicks still toggle.
const OPEN_SETTLE_MS = 250;

export function Nav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { setOpen } = useCommandPalette();
  const me = useMe();
  const accounts: readonly NavLolAccount[] = me.data?.lol ?? [];
  // Pre-fill `?as=<slug>` from the viewer's default LoL account so
  // "Patches" lands on the personalized lens by default. Falls through to
  // the neutral global view when no default account is available.
  const defaultLolSlug = accounts[0]?.slug;
  const lolActive = isItemActive(pathname, "/lol");
  const activeSlug = activeAccountSlug(pathname);

  // Controlled value so we can observe the closed→open transition and
  // ignore the click that landed during the open animation.
  const [menuValue, setMenuValue] = useState("");
  const openedAtRef = useRef(0);

  return (
    <nav data-vt-nav="" className="sticky top-0 z-50 bg-background/60 backdrop-blur-md">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-foreground/15 to-transparent"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-sky-400/35 via-50% to-transparent opacity-70 blur-[1px]"
      />
      <div
        data-nav-inner=""
        className="relative mx-auto flex max-w-4xl items-center gap-6 px-6 py-3"
      >
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
          value={menuValue}
          onValueChange={(next) => {
            if (next !== "" && menuValue === "") {
              openedAtRef.current = performance.now();
            }
            setMenuValue(next);
          }}
          className="max-w-none justify-start"
        >
          <NavigationMenuList className="gap-1">
            <SimpleNavItem to="/" label="Home" Icon={Home} pathname={pathname} />
            <NavigationMenuItem>
              <NavigationMenuTrigger
                // Suppress the toggle-close only when the click lands
                // inside the open animation window — almost always the
                // trailing edge of the hover/tap that opened the menu in
                // the first place, never a deliberate dismiss. Clicks
                // after the menu has settled still toggle, so users who
                // genuinely want to close via the trigger can.
                onClick={(e) => {
                  if (
                    (e.currentTarget as HTMLElement).dataset.state === "open" &&
                    performance.now() - openedAtRef.current < OPEN_SETTLE_MS
                  ) {
                    e.preventDefault();
                  }
                }}
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
                <LolMenuPanel
                  accounts={accounts}
                  defaultLolSlug={defaultLolSlug}
                  activeSlug={activeSlug}
                  pathname={pathname}
                />
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
  activeSlug,
  pathname,
}: {
  accounts: readonly NavLolAccount[];
  defaultLolSlug: string | undefined;
  activeSlug: string | null;
  pathname: string;
}) {
  const patchesActive = isItemActive(pathname, "/lol/patches");
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
                <AccountRow account={account} active={account.slug === activeSlug} />
              </li>
            ))}
          </ul>
          <div className="my-1 h-px bg-border" />
        </>
      )}
      <NavigationMenuLink asChild active={patchesActive}>
        <Link
          to="/lol/patches"
          search={defaultLolSlug ? { as: defaultLolSlug } : {}}
          aria-current={patchesActive ? "page" : undefined}
          className={cn(
            "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
            patchesActive && "bg-foreground/10 text-foreground"
          )}
        >
          <ScrollText className="size-4" aria-hidden />
          Patches
        </Link>
      </NavigationMenuLink>
    </div>
  );
}

// Compact queue label for the dropdown's sub-line — the full names
// ("Ranked Solo", "Ranked Flex") used on the profile rank tiles are too
// wide for the 280px-ish menu width. Unknown queues fall through to the
// raw id so a future ranked queue still reads in the UI.
function queueShortLabel(queueId: string): string {
  if (queueId === "RANKED_SOLO_5x5") return "Solo";
  if (queueId === "RANKED_FLEX_SR") return "Flex";
  return queueId;
}

// Account row in the LoL dropdown. The left icon is the per-account
// profile icon (stable identity, like a Discord avatar). Right side
// shows the highest-of solo/flex rank emblem when available; sub-line
// carries region + queue + rank text. Sub-line and right-slot stay
// rendered (region-only / empty) for un-hydrated rows so vertical
// rhythm doesn't jump as data arrives.
function AccountRow({
  account,
  active,
}: {
  account: NavLolAccount;
  active: boolean;
}) {
  const ddVersion = useDDragonVersion();
  const emblemYear = useRankedEmblemYear();
  const summary = account.summary;
  const isHydrated = summary !== null && summary.updatedAt !== null;
  const rank = summary?.rank ?? null;
  const profileIconId = account.profileIconId;

  return (
    <NavigationMenuLink asChild active={active}>
      <Link
        to="/lol/$accountSlug"
        params={{ accountSlug: account.slug }}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
          active && "bg-foreground/10 text-foreground"
        )}
      >
        {/* Fixed-size left icon slot so fallback rows align with hydrated
        ones — the only difference is what goes inside the box. */}
        <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full">
          {profileIconId != null ? (
            <img
              src={profileIconUrl(profileIconId, ddVersion)}
              alt=""
              loading="lazy"
              className="size-7 object-cover"
            />
          ) : (
            <LeagueOfLegendsIcon className="size-4 text-muted-foreground" aria-hidden />
          )}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate">
            <span>{account.gameName}</span>
            <span className="text-muted-foreground">#{account.tagLine}</span>
          </span>
          {/* Subline is rendered for every row so vertical rhythm stays
          uniform whether the denorm has hydrated or not. Hydrated rows get
          region · rank; fallback rows show region alone. */}
          <span className="truncate text-[10px] text-muted-foreground">
            {account.region.toUpperCase()}
            {isHydrated &&
              (rank
                ? ` · ${queueShortLabel(rank.queueId)} · ${formatRank(rank.tier, rank.division, rank.leaguePoints)}`
                : " · Unranked")}
          </span>
        </span>
        {/* Fixed-size right slot so rank-emblem and no-rank rows take the
        same width. Rendered as a placeholder span when there's no emblem
        to display, keeping the row chrome stable. */}
        <span className="flex size-7 shrink-0 items-center justify-center">
          {isHydrated && rank && (
            <img
              src={rankEmblemUrl(rank.tier, emblemYear)}
              alt={rank.tier}
              loading="lazy"
              className="size-7 object-contain opacity-90"
            />
          )}
        </span>
      </Link>
    </NavigationMenuLink>
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
