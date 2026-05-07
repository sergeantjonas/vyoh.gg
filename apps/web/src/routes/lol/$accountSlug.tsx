import { useAccountFromSlug } from "@/identity/use-account-from-slug";
import { cn } from "@/lib/utils";
import { AccountSwitcher } from "@/lol/account-switcher";
import { HoverChampionProvider } from "@/lol/hover-champion-context";
import { useSplashChampion } from "@/lol/splash-backdrop";
import { useMatches } from "@/lol/use-matches";
import { Link, Outlet, createFileRoute, useRouterState } from "@tanstack/react-router";
import { Crown, History, TrendingUp } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import { useEffect, useMemo, useState } from "react";

const TABS = [
  { to: "/lol/$accountSlug/matches", label: "Matches", Icon: History },
  { to: "/lol/$accountSlug/trends", label: "Trends", Icon: TrendingUp },
  { to: "/lol/$accountSlug/champions", label: "Champions", Icon: Crown },
] as const;

export const Route = createFileRoute("/lol/$accountSlug")({
  component: AccountLayout,
});

function AccountLayout() {
  const { accountSlug } = Route.useParams();
  const account = useAccountFromSlug(accountSlug);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const matches = useMatches(account);
  const flat = useMemo(() => matches.data?.pages.flat() ?? [], [matches.data?.pages]);

  const [hoveredChampion, setHoveredChampion] = useState<string | null>(null);
  const [initialChampion, setInitialChampion] = useState<string | null>(null);
  useEffect(() => {
    if (initialChampion || flat.length === 0) return;
    const random = flat[Math.floor(Math.random() * flat.length)];
    if (random) setInitialChampion(random.champion);
  }, [flat, initialChampion]);
  useSplashChampion(hoveredChampion ?? initialChampion);

  return (
    <HoverChampionProvider setHovered={setHoveredChampion}>
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
          {TABS.map(({ to, label, Icon }) => {
            const tabPath = to.replace("$accountSlug", accountSlug);
            const active = pathname === tabPath || pathname.startsWith(`${tabPath}/`);
            return (
              <Link
                key={to}
                to={to}
                params={{ accountSlug }}
                className={cn(
                  "group relative flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon
                  className={cn(
                    "size-4 transition-all",
                    active
                      ? "text-sky-400 drop-shadow-[0_0_6px_rgba(56,189,248,0.5)]"
                      : "text-muted-foreground group-hover:text-foreground"
                  )}
                />
                {label}
                {active && (
                  <m.div
                    layoutId="lol-tab-indicator"
                    className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-gradient-to-r from-sky-400 via-violet-400 to-emerald-400"
                    animate={{
                      boxShadow: [
                        "0 0 0px 0px rgba(56,189,248,0)",
                        "0 0 10px 1px rgba(56,189,248,0.45)",
                        "0 0 0px 0px rgba(56,189,248,0)",
                      ],
                    }}
                    transition={{
                      default: { type: "spring", stiffness: 500, damping: 35 },
                      boxShadow: {
                        duration: 2.4,
                        repeat: Number.POSITIVE_INFINITY,
                        ease: "easeInOut",
                      },
                    }}
                  />
                )}
              </Link>
            );
          })}
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <m.div
            key={pathname}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
          >
            <Outlet />
          </m.div>
        </AnimatePresence>
      </div>
    </HoverChampionProvider>
  );
}
