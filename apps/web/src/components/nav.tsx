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
import { useHoverPrefetch } from "@/lib/use-hover-prefetch";
import { cn } from "@/lib/utils";
import {
  championBackdropSplashUrl,
  rankEmblemUrl,
} from "@/lol/_shared/assets/champion-icon";
import { profileIconUrl } from "@/lol/_shared/assets/summoner-icon";
import { useDDragonVersion } from "@/lol/_shared/patch/use-ddragon-version";
import { useRankedEmblemYear } from "@/lol/_shared/use-ranked-emblem-year";
import { prefetchCachedMatches } from "@/lol/matches/use-matches";
import { patchListQueryOptions } from "@/lol/patches/use-patch-list";
import { steamOwnedGamesQueryOptions } from "@/steam/use-owned-games";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useRouterState } from "@tanstack/react-router";
import type { LolAccountWithSummary } from "@vyoh/shared";
import { formatRank } from "@vyoh/shared/lol/rank-history";
import { Activity, Home, ScrollText, Search } from "lucide-react";
import { m } from "motion/react";
import {
  type CSSProperties,
  type ComponentType,
  type SVGProps,
  useRef,
  useState,
} from "react";

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
  const queryClient = useQueryClient();
  const accounts: readonly NavLolAccount[] = me.data?.lol ?? [];
  const prefetchSteamLibrary = () => {
    queryClient.prefetchQuery(steamOwnedGamesQueryOptions());
  };
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
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-theme/35 via-50% to-transparent opacity-70 blur-[1px]"
      />
      <div
        data-nav-inner=""
        className="relative mx-auto flex max-w-4xl items-center gap-6 px-6 py-3"
      >
        <Link to="/" className="flex items-center gap-2 text-lg font-bold tracking-tight">
          <OrbGlyph className="size-[1.5em] translate-y-[0.1em]" />
          <span className="flex items-baseline">
            {/* `vyoh` follows the per-route theme color so it tints
                alongside the section the user is on. `.gg` stays muted to
                preserve the wordmark's secondary read.                   */}
            <span className="text-[var(--theme-color)] transition-colors duration-300">
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
            {/* Steam is a single plain link today. WHEN this grows nav items
                (a dropdown / sub-routes / account-or-profile menu), revisit the
                deferred "Steam account-showcase" parity item — the single rich
                identity card parallel to the LoL AccountRow showcase (nav arc
                1.5). The showcase only earns its place once there's real Steam
                nav to host it. Detail + trigger:
                docs/working-notes/cross-cutting/steam-lol-parity.md
                § "Deferred — trigger-gated". */}
            <SimpleNavItem
              to="/steam"
              label="Steam"
              Icon={SteamIcon}
              pathname={pathname}
              prefetch={prefetchSteamLibrary}
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

const noop = () => {};

// Faster hover threshold for nav links than for in-content tiles — nav clicks
// are higher-intent, so 100ms still filters cursor drift but doesn't make the
// click wait noticeably longer than a 150ms tile threshold would.
const NAV_PREFETCH_DELAY_MS = 100;

function SimpleNavItem({
  to,
  label,
  Icon,
  pathname,
  prefetch,
}: {
  to: string;
  label: string;
  Icon: IconComponent;
  pathname: string;
  prefetch?: () => void;
}) {
  const active = isItemActive(pathname, to);
  const prefetchHandlers = useHoverPrefetch(prefetch ?? noop, {
    delay: NAV_PREFETCH_DELAY_MS,
  });
  return (
    <NavigationMenuItem>
      <NavigationMenuLink asChild active={active}>
        <Link
          to={to}
          onPointerEnter={prefetchHandlers.onPointerEnter}
          onPointerLeave={prefetchHandlers.onPointerLeave}
          onPointerDown={prefetchHandlers.onPointerDown}
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
  const queryClient = useQueryClient();
  const patchesPrefetch = useHoverPrefetch(
    () => {
      queryClient.prefetchQuery(patchListQueryOptions());
    },
    { delay: NAV_PREFETCH_DELAY_MS }
  );
  return (
    <div className="flex flex-col">
      {accounts.length > 0 && (
        <>
          <div className="px-2 pt-1 pb-1 font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
            Accounts
          </div>
          <ul className="flex max-h-[300px] flex-col overflow-y-auto">
            {accounts.map((account, index) => (
              <li key={account.slug}>
                <AccountRow
                  account={account}
                  active={account.slug === activeSlug}
                  index={index}
                />
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
          onPointerEnter={patchesPrefetch.onPointerEnter}
          onPointerLeave={patchesPrefetch.onPointerLeave}
          onPointerDown={patchesPrefetch.onPointerDown}
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

// Profile icons and rank emblems in the dropdown load over the network and
// otherwise snap from blank to loaded — visible pop-in even though the layout
// slot is already reserved. A pulse skeleton fills the slot until the image
// decodes, then it fades in; the module-level cache skips the fade for images
// already loaded this session (re-opening the menu shows them instantly).
// Mirrors the ChampionSquareIcon pattern in lol/_shared/assets.
const loadedNavImgs = new Set<string>();

function FadeInImage({
  src,
  alt,
  className,
  imgClassName,
  loadedClassName = "opacity-100",
}: {
  src: string;
  alt: string;
  className?: string;
  imgClassName?: string;
  loadedClassName?: string;
}) {
  const [loaded, setLoaded] = useState(() => loadedNavImgs.has(src));
  return (
    <span className={cn("relative inline-block overflow-hidden", className)}>
      {!loaded && (
        <span
          aria-hidden
          className="absolute inset-0 animate-pulse rounded-[inherit] bg-muted"
        />
      )}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onLoad={() => {
          loadedNavImgs.add(src);
          setLoaded(true);
        }}
        className={cn(
          "size-full transition-opacity duration-200",
          loaded ? loadedClassName : "opacity-0",
          imgClassName
        )}
      />
    </span>
  );
}

// Account row in the LoL dropdown. The left icon is the per-account
// profile icon (stable identity, like a Discord avatar). Right side
// shows the highest-of solo/flex rank emblem when available; sub-line
// carries region + queue + rank text. Sub-line and right-slot stay
// rendered (region-only / empty) for un-hydrated rows so vertical
// rhythm doesn't jump as data arrives. A faint last-played champion
// splash washes in from the right edge as a showcase accent; `index`
// drives a per-row open-stagger (see `.nav-account-row` in index.css).
function AccountRow({
  account,
  active,
  index,
}: {
  account: NavLolAccount;
  active: boolean;
  index: number;
}) {
  const ddVersion = useDDragonVersion();
  const emblemYear = useRankedEmblemYear();
  const queryClient = useQueryClient();
  const prefetch = useHoverPrefetch(
    () => {
      prefetchCachedMatches(queryClient, account);
    },
    { delay: NAV_PREFETCH_DELAY_MS }
  );
  const summary = account.summary;
  const isHydrated = summary !== null && summary.updatedAt !== null;
  const rank = summary?.rank ?? null;
  const profileIconId = account.profileIconId;
  const splashAlias = summary?.lastPlayedChampionAlias ?? null;

  return (
    <NavigationMenuLink asChild active={active}>
      <Link
        to="/lol/$accountSlug"
        params={{ accountSlug: account.slug }}
        onPointerEnter={prefetch.onPointerEnter}
        onPointerLeave={prefetch.onPointerLeave}
        onPointerDown={prefetch.onPointerDown}
        aria-current={active ? "page" : undefined}
        style={{ "--row-index": index } as CSSProperties}
        className={cn(
          "nav-account-row relative isolate flex items-center gap-3 overflow-hidden rounded-md px-2 py-1.5 text-sm transition-colors",
          active && "bg-foreground/10 text-foreground"
        )}
      >
        {/* Last-played champion splash, washed in from the right as a faint
        showcase accent. Overscanned + clipped so the blur edge never seams;
        masked to fade out before it reaches the name/rank text. Decorative,
        so aria-hidden and gated on a hydrated alias. */}
        {splashAlias && (
          <span
            aria-hidden
            className="-z-10 -inset-4 pointer-events-none absolute opacity-[0.28] [mask-image:linear-gradient(to_left,black,transparent_55%)]"
            style={{
              backgroundImage: `url(${championBackdropSplashUrl(splashAlias, ddVersion)})`,
              // bg-cover leaves no horizontal slack on this 6:1 row, so a
              // small zoom is what lets backgroundPosition pan the splash
              // subject out from under the avatar/text into the visible right
              // band. Lower X% pushes the subject further right; Y biases up
              // toward the face.
              backgroundSize: "165%",
              backgroundPosition: "30% 28%",
            }}
          />
        )}
        {/* Fixed-size left icon slot so fallback rows align with hydrated
        ones — the only difference is what goes inside the box. Enlarged to
        read as an avatar showcase rather than a list bullet. */}
        <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full">
          {profileIconId != null ? (
            <FadeInImage
              src={profileIconUrl(profileIconId, ddVersion)}
              alt=""
              className="size-11"
              imgClassName="object-cover"
            />
          ) : (
            <LeagueOfLegendsIcon className="size-6 text-muted-foreground" aria-hidden />
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
            <FadeInImage
              src={rankEmblemUrl(rank.tier, emblemYear)}
              alt={rank.tier}
              className="size-7"
              imgClassName="object-contain"
              loadedClassName="opacity-90"
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
