import { CvSection } from "@/_shared/cv-section";
import { SectionTitle } from "@/components/ui/section-title";
import { ChampionSquareIcon } from "@/lol/_shared/assets/champion-square-icon";
import { useChampionName } from "@/lol/champions/use-champions";
import { Link } from "@tanstack/react-router";
import { type Variants, m } from "motion/react";
import { useChampionMasteryList } from "./use-champion-mastery-list";

const container: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.07 } },
};

const row: Variants = {
  hidden: { opacity: 0, x: -8 },
  show: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 380, damping: 30 } },
};

const POINTS = new Intl.NumberFormat("en-GB");

const SHOWN = 3;

// Riot's lifetime mastery, which reaches back before the tracked history the
// rest of this page reads, so it is the one ranking here that covers a career.
export function ProfileMostMastered({ accountSlug }: { accountSlug: string }) {
  const champions = useChampionMasteryList(accountSlug).data?.champions.slice(0, SHOWN);
  const championName = useChampionName();
  if (!champions || champions.length === 0) return null;

  // Gated here rather than at the call site: before the query lands there is
  // nothing to reserve height for, and gating after the guard keeps the frosted
  // rows from promoting layers on a cold load of a page they sit far below.
  return (
    <CvSection minHeight={220}>
      <div className="flex flex-col gap-2">
        <SectionTitle>Most mastered</SectionTitle>
        <m.div
          initial="hidden"
          animate="show"
          variants={container}
          className="flex flex-col gap-2"
        >
          {champions.map((c) => (
            <m.div key={c.alias} variants={row}>
              <Link
                to="/lol/$accountSlug/champions/$championKey"
                params={{ accountSlug, championKey: c.alias.toLowerCase() }}
                className="flex items-center gap-3 rounded-lg border bg-card/60 px-3 py-2 backdrop-blur-sm transition-colors hover:bg-card/80"
              >
                <ChampionSquareIcon
                  championName={c.alias}
                  alt={championName(c.alias)}
                  className="size-9 rounded-md"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{championName(c.alias)}</div>
                  <div className="text-xs text-muted-foreground">Mastery {c.level}</div>
                </div>
                <div className="text-right text-sm tabular-nums text-muted-foreground">
                  {POINTS.format(c.points)}
                  <div className="text-xs">points</div>
                </div>
              </Link>
            </m.div>
          ))}
        </m.div>
      </div>
    </CvSection>
  );
}
