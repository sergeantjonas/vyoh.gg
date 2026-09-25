import { SectionTitle } from "@/components/ui/section-title";
import { ChampionSquareIcon } from "@/lol/_shared/assets/champion-square-icon";
import { useChampionName } from "@/lol/champions/use-champions";
import { Link } from "@tanstack/react-router";
import type { OnThisDayYear } from "@vyoh/shared";
import { type Variants, m } from "motion/react";
import { useOnThisDay } from "./use-on-this-day";

const container: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.07 } },
};

const row: Variants = {
  hidden: { opacity: 0, x: -8 },
  show: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 380, damping: 30 } },
};

// The date is a Brussels calendar day with no time, so it is formatted in UTC:
// any zone west of UTC would move it back across midnight and print the day before.
const DATE_FMT = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function formatOnThisDayDate(date: string): string {
  return DATE_FMT.format(new Date(`${date}T00:00:00Z`));
}

// Each row is a frosted tile, and the section is not CV-gated, so every one
// promotes a layer on load. Three years is as far back as the card reaches.
const MAX_YEARS_SHOWN = 3;

const YEARS_IN_WORDS = [
  "A year",
  "Two years",
  "Three years",
  "Four years",
  "Five years",
  "Six years",
  "Seven years",
  "Eight years",
  "Nine years",
  "Ten years",
];

export function onThisDayLabel(year: Pick<OnThisDayYear, "yearsAgo" | "exact">): string {
  const span = YEARS_IN_WORDS[year.yearsAgo - 1] ?? `${year.yearsAgo} years`;
  return `${span} ago ${year.exact ? "today" : "this week"}`;
}

export function ProfileOnThisDay({ accountSlug }: { accountSlug: string }) {
  const years = useOnThisDay(accountSlug).data?.years.slice(0, MAX_YEARS_SHOWN);
  const championName = useChampionName();
  if (!years || years.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <SectionTitle>On this day</SectionTitle>
      <m.div
        initial="hidden"
        animate="show"
        variants={container}
        className="flex flex-col gap-2"
      >
        {years.map((year) => {
          const { headline } = year;
          const losses = year.games - year.wins;
          return (
            <m.div key={year.yearsAgo} variants={row}>
              <Link
                to="/lol/$accountSlug/matches/$matchId"
                params={{ accountSlug, matchId: headline.matchId }}
                className="flex items-center gap-3 rounded-lg border bg-card/60 px-3 py-2 backdrop-blur-sm transition-colors hover:bg-card/80"
              >
                <ChampionSquareIcon
                  championName={headline.champion}
                  alt={championName(headline.champion)}
                  className="size-9 rounded-md"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{onThisDayLabel(year)}</div>
                  {/* Its own line: on a phone the label fills the first one, and
                      the date is what makes "this week" honest. */}
                  <div className="truncate text-xs text-muted-foreground">
                    {formatOnThisDayDate(year.date)}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {year.games} {year.games === 1 ? "game" : "games"} · {year.wins}W{" "}
                    {losses}L · mostly {championName(year.topChampion)}
                  </div>
                </div>
                <div className="text-right text-sm tabular-nums text-muted-foreground">
                  <div>
                    {headline.kills} / {headline.deaths} / {headline.assists}
                  </div>
                  <div
                    className={
                      headline.win ? "text-xs text-emerald-400" : "text-xs text-red-400"
                    }
                  >
                    {headline.win ? "Win" : "Loss"}
                  </div>
                </div>
              </Link>
            </m.div>
          );
        })}
      </m.div>
    </div>
  );
}
