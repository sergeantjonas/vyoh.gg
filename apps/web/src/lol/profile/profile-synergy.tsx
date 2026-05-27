import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { SectionTitle } from "@/components/ui/section-title";
import { cn } from "@/lib/utils";
import { useAccountFromSlug } from "@/lol/_shared/account/use-account-from-slug";
import { ChampionSquareIcon } from "@/lol/_shared/assets/champion-square-icon";
import { useChampionName } from "@/lol/champions/use-champions";
import { useChampionPairs } from "@/lol/profile/use-champion-pairs";
import { Link } from "@tanstack/react-router";
import { type ChampionPair, formatPercent } from "@vyoh/shared";
import { ArrowRight } from "lucide-react";
import { type Variants, m } from "motion/react";
import { useMemo } from "react";

const MIN_GAMES_PER_TEAMMATE = 2;
const MIN_TOTAL_GAMES_PER_CHAMP = 6;
const TOP_CHAMPIONS = 5;
const TOP_TEAMMATES_PER_CHAMP = 4;

interface TeammateEntry {
  champ: string;
  games: number;
  wins: number;
  wr: number;
}

interface ChampionSynergy {
  yourChamp: string;
  totalGames: number;
  totalWins: number;
  teammates: TeammateEntry[];
}

function prepareSynergy(pairs: ChampionPair[]): ChampionSynergy[] {
  const byChamp = new Map<string, ChampionPair[]>();
  for (const p of pairs) {
    if (p.games < MIN_GAMES_PER_TEAMMATE) continue;
    const list = byChamp.get(p.yourChamp);
    if (list) list.push(p);
    else byChamp.set(p.yourChamp, [p]);
  }

  const entries: ChampionSynergy[] = [];
  for (const [yourChamp, ps] of byChamp) {
    const totalGames = ps.reduce((s, p) => s + p.games, 0);
    if (totalGames < MIN_TOTAL_GAMES_PER_CHAMP) continue;
    const totalWins = ps.reduce((s, p) => s + p.wins, 0);
    const teammates: TeammateEntry[] = [...ps]
      .sort((a, b) => b.games - a.games)
      .slice(0, TOP_TEAMMATES_PER_CHAMP)
      .map((p) => ({
        champ: p.teammateChamp,
        games: p.games,
        wins: p.wins,
        wr: p.wins / p.games,
      }));
    entries.push({ yourChamp, totalGames, totalWins, teammates });
  }

  return entries.sort((a, b) => b.totalGames - a.totalGames).slice(0, TOP_CHAMPIONS);
}

interface Accent {
  text: string;
  bar: string;
  rail: string;
  rowBorder: string;
}

function wrAccent(wr: number): Accent {
  if (wr >= 0.6) {
    return {
      text: "text-emerald-400",
      bar: "bg-emerald-400/70",
      rail: "bg-emerald-400/15",
      rowBorder: "border-l-emerald-400/50",
    };
  }
  if (wr >= 0.5) {
    return {
      text: "text-emerald-500/90",
      bar: "bg-emerald-500/55",
      rail: "bg-emerald-500/10",
      rowBorder: "border-l-emerald-500/30",
    };
  }
  if (wr >= 0.4) {
    return {
      text: "text-muted-foreground",
      bar: "bg-muted-foreground/40",
      rail: "bg-muted-foreground/10",
      rowBorder: "border-l-muted-foreground/20",
    };
  }
  return {
    text: "text-rose-400",
    bar: "bg-rose-500/60",
    rail: "bg-rose-500/10",
    rowBorder: "border-l-rose-400/50",
  };
}

function ChampionSynergyCard({
  entry,
  accountSlug,
}: {
  entry: ChampionSynergy;
  accountSlug: string;
}) {
  const championName = useChampionName();
  const overallWr = entry.totalWins / entry.totalGames;
  const overallWrPct = formatPercent(overallWr);
  const overallLosses = entry.totalGames - entry.totalWins;
  const overallAccent = wrAccent(overallWr);
  const maxGames = entry.teammates.reduce((acc, t) => Math.max(acc, t.games), 1);
  const displayName = championName(entry.yourChamp);

  return (
    <m.div variants={rowVariants}>
      <AccordionItem value={entry.yourChamp}>
        <AccordionTrigger aria-label={`${displayName} synergy details`}>
          <ChampionSquareIcon
            championName={entry.yourChamp}
            alt=""
            className="size-10 shrink-0 rounded-md"
          />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{displayName}</div>
            <div className="text-xs text-muted-foreground">
              with {entry.teammates.length}{" "}
              {entry.teammates.length === 1 ? "teammate" : "teammates"}
            </div>
          </div>
          <div className="text-right tabular-nums">
            <div className="text-sm">
              <span className="text-emerald-500/80">{entry.totalWins}</span>
              <span className="text-muted-foreground/40">–</span>
              <span className="text-rose-500/80">{overallLosses}</span>
            </div>
            <div className={cn("text-xs", overallAccent.text)}>
              {entry.totalGames}g · {overallWrPct}
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <ul className="flex flex-col gap-1">
            {entry.teammates.map((t) => {
              const accent = wrAccent(t.wr);
              const wrPct = formatPercent(t.wr);
              const barWidth = `${Math.max(6, (t.games / maxGames) * 100)}%`;
              return (
                <li
                  key={t.champ}
                  className={cn(
                    "flex items-center gap-2 rounded border border-l-2 bg-background/30 px-2 py-1.5",
                    accent.rowBorder
                  )}
                >
                  <ChampionSquareIcon
                    championName={t.champ}
                    alt=""
                    className="size-6 rounded"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs">{championName(t.champ)}</span>
                      <span className="shrink-0 text-[10px] text-muted-foreground/70 tabular-nums">
                        {t.games}g
                      </span>
                    </div>
                    <div
                      className={cn("relative mt-1 h-1 rounded-full", accent.rail)}
                      role="presentation"
                    >
                      <div
                        className={cn(
                          "absolute inset-y-0 left-0 rounded-full",
                          accent.bar
                        )}
                        style={{ width: barWidth }}
                      />
                    </div>
                  </div>
                  <div
                    className={cn(
                      "w-9 shrink-0 text-right text-xs tabular-nums",
                      accent.text
                    )}
                  >
                    {wrPct}
                  </div>
                </li>
              );
            })}
          </ul>
          <Link
            to="/lol/$accountSlug/champions/$championKey"
            params={{ accountSlug, championKey: entry.yourChamp.toLowerCase() }}
            className="mt-2 flex cursor-pointer items-center justify-center gap-1.5 rounded-md border bg-card/60 px-3 py-1.5 text-xs font-medium text-foreground/90 transition-colors hover:border-foreground/30 hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            View {displayName} detail
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </AccordionContent>
      </AccordionItem>
    </m.div>
  );
}

export function ProfileSynergy({ accountSlug }: { accountSlug: string }) {
  const account = useAccountFromSlug(accountSlug);
  const { data, isPending } = useChampionPairs(account);
  const entries = useMemo(() => (data ? prepareSynergy(data) : []), [data]);

  if (isPending || !data) return null;
  if (entries.length === 0) {
    return (
      <section className="flex flex-col gap-2">
        <SectionTitle>Synergy</SectionTitle>
        <p className="rounded-lg border border-dashed bg-card/20 px-3 py-3 text-xs text-muted-foreground/70">
          Not enough team data to map champion synergy yet.
        </p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <SectionTitle>Synergy</SectionTitle>
        <span className="text-[10px] text-muted-foreground/60">
          your top champs · best teammates
        </span>
      </div>
      <m.div initial="hidden" animate="show" variants={containerVariants}>
        <Accordion type="single" collapsible className="flex flex-col gap-2">
          {entries.map((entry) => (
            <ChampionSynergyCard
              key={entry.yourChamp}
              entry={entry}
              accountSlug={accountSlug}
            />
          ))}
        </Accordion>
      </m.div>
    </section>
  );
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const rowVariants: Variants = {
  hidden: { opacity: 0, y: 4 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 320, damping: 30 },
  },
};
