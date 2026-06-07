import { useActiveScrollContainer } from "@/lib/scroll-container-context";
import { cn } from "@/lib/utils";
import { MatchBuildOrder } from "@/lol/matches/match-build-order";
import { MatchDamageProfile } from "@/lol/matches/match-damage-profile";
import { MatchOwnerStats } from "@/lol/matches/match-owner-stats";
import { MatchSkillOrder } from "@/lol/matches/match-skill-order";
import { MatchSpellCasts } from "@/lol/matches/match-spell-casts";
import { useScrollspy } from "@/lol/matches/use-scrollspy";
import type { MatchDetail } from "@vyoh/shared";
import { useReducedMotion } from "motion/react";
import { Suspense, lazy, useEffect, useState } from "react";
import { ChartFallback } from "./match-detail-shared";

// Recharts-backed chart loads behind a lazy boundary so the Recap tab
// (the default landing) doesn't pay the Recharts download + parse cost.
// Named-export wrapper because React.lazy expects a default export and
// we don't want to flip the public shape of the chart module just for this.
const MatchLanePhase = lazy(() =>
  import("@/lol/matches/match-lane-phase").then((m) => ({
    default: m.MatchLanePhase,
  }))
);

const YOUR_GAME_SECTIONS = [
  { id: "build-order", label: "Build" },
  { id: "spell-casts", label: "Casts" },
  { id: "damage-profile", label: "Damage" },
  { id: "owner-stats", label: "Stats" },
  { id: "skill-order", label: "Skills" },
  { id: "lane-phase", label: "Lane phase" },
] as const;

const YOUR_GAME_IDS = YOUR_GAME_SECTIONS.map((s) => s.id);

export function MatchYourGameTab({
  detail,
  myPuuid,
}: {
  detail: MatchDetail;
  myPuuid?: string | undefined;
}) {
  const reduced = useReducedMotion();
  const { activeId: scrollspyId, refFor, navigateTo } = useScrollspy(YOUR_GAME_IDS);
  const scrollEl = useActiveScrollContainer();
  const [showScrollspy, setShowScrollspy] = useState(false);
  useEffect(() => {
    if (!scrollEl) return;
    const check = () => setShowScrollspy(scrollEl.scrollHeight > scrollEl.clientHeight);
    requestAnimationFrame(check);
    const ro = new ResizeObserver(check);
    ro.observe(scrollEl);
    return () => ro.disconnect();
  }, [scrollEl]);

  return (
    <div className="flex gap-8">
      <div className="flex min-w-0 flex-1 flex-col gap-6">
        <div ref={refFor("build-order")}>
          <MatchBuildOrder detail={detail} myPuuid={myPuuid} />
        </div>
        <div ref={refFor("spell-casts")}>
          <MatchSpellCasts detail={detail} myPuuid={myPuuid} />
        </div>
        <div ref={refFor("damage-profile")}>
          <MatchDamageProfile detail={detail} myPuuid={myPuuid} />
        </div>
        <div ref={refFor("owner-stats")}>
          <MatchOwnerStats detail={detail} myPuuid={myPuuid} />
        </div>
        <div ref={refFor("skill-order")}>
          <MatchSkillOrder detail={detail} myPuuid={myPuuid} />
        </div>
        <div ref={refFor("lane-phase")}>
          <Suspense fallback={<ChartFallback />}>
            <MatchLanePhase detail={detail} myPuuid={myPuuid} />
          </Suspense>
        </div>
      </div>
      {showScrollspy && (
        <aside
          aria-label="Your game sections"
          className="hidden w-28 shrink-0 flex-col gap-0.5 sm:flex"
          style={{
            position: "sticky",
            // Clear the section header + the one-row champion caption strip that
            // pins below it on deep scroll (~42px: size-6 icon + py-2 + hairlines,
            // plus a small gap). Was +88 for the old two-row strip (champion row
            // + the detail tabs that have since moved into the section strip).
            top: "calc(var(--account-header-h, 64px) + 52px)",
            alignSelf: "flex-start",
          }}
        >
          {YOUR_GAME_SECTIONS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => navigateTo(id, !reduced)}
              className={cn(
                "cursor-pointer py-1 text-left text-sm transition-colors",
                scrollspyId === id
                  ? "font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </aside>
      )}
    </div>
  );
}
