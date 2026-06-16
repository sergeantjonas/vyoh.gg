import { EmptyDuosIllustration, EmptyState } from "@/components/empty-state";
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
import { wrAccent } from "@/lol/_shared/wr-accent";
import { useChampionName } from "@/lol/champions/use-champions";
import { useDuos } from "@/lol/profile/use-duos";
import { type Duo, formatPercent } from "@vyoh/shared";
import { type Variants, m } from "motion/react";

const DISPLAY_COUNT = 3;

export function ProfileDuos({ accountSlug }: { accountSlug: string }) {
  const account = useAccountFromSlug(accountSlug);
  const { data, isPending } = useDuos(account);

  // Hide while loading so the Profile doesn't reserve empty space during the
  // initial fetch. Once the response lands we either render duos or the
  // "mostly solo" empty state.
  if (isPending || !data) return null;

  if (data.length === 0) {
    return (
      <section className="flex flex-col gap-2">
        <SectionTitle>Duos</SectionTitle>
        <EmptyState
          framed
          illustration={<EmptyDuosIllustration />}
          title="No recurring duo detected"
          hint="You mostly queue solo in this window."
          className="py-4"
        />
      </section>
    );
  }

  const duos = data.slice(0, DISPLAY_COUNT);

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <SectionTitle>Duos</SectionTitle>
        <span className="text-[10px] text-muted-foreground/60">
          your duos · champ combos
        </span>
      </div>
      <m.div initial="hidden" animate="show" variants={containerVariants}>
        <Accordion type="single" collapsible className="flex flex-col gap-2">
          {duos.map((d) => (
            <DuoCard key={d.puuid} duo={d} />
          ))}
        </Accordion>
      </m.div>
    </section>
  );
}

function DuoCard({ duo }: { duo: Duo }) {
  const championName = useChampionName();
  const losses = duo.games - duo.wins;
  const wr = formatPercent(duo.wins / duo.games);
  const comboCount = duo.championPairs.length;
  // Longest pairing scales the bars within this duo so the most-played combo
  // fills the rail and the rest read relative to it.
  const maxGames = duo.championPairs.reduce((acc, p) => Math.max(acc, p.games), 1);

  return (
    <m.div variants={rowVariants}>
      <AccordionItem value={duo.puuid}>
        <AccordionTrigger aria-label={`${duo.gameName} champion combos`}>
          <ChampionSquareIcon
            championName={duo.topChampion}
            alt=""
            className="size-9 shrink-0 rounded-md"
          />
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium">
              {duo.gameName}
              <span className="text-muted-foreground">#{duo.tagLine}</span>
            </div>
            <div className="text-xs text-muted-foreground">
              Most on {championName(duo.topChampion)} ·{" "}
              {comboCount === 1 ? "1 combo" : `${comboCount} combos`}
            </div>
          </div>
          <div className="text-right tabular-nums">
            <div className="text-sm text-foreground/90">
              <span className="text-emerald-500/80">{duo.wins}</span>
              <span className="text-muted-foreground/40">{"–"}</span>
              <span className="text-rose-500/80">{losses}</span>
            </div>
            <div className="text-xs text-muted-foreground">
              {duo.games}g · {wr} WR
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <ul className="flex flex-col gap-1">
            {duo.championPairs.map((pair) => {
              const pairWr = pair.wins / pair.games;
              const accent = wrAccent(pairWr);
              const wrPct = formatPercent(pairWr);
              const barWidth = `${Math.max(6, (pair.games / maxGames) * 100)}%`;
              return (
                <li
                  key={`${pair.yourChamp}|${pair.teammateChamp}`}
                  className={cn(
                    "flex items-center gap-2 rounded border border-l-2 bg-background/30 px-2 py-1.5",
                    accent.rowBorder
                  )}
                >
                  <div className="flex shrink-0 -space-x-1.5">
                    <ChampionSquareIcon
                      championName={pair.yourChamp}
                      alt=""
                      className="size-6 rounded ring-1 ring-card"
                    />
                    <ChampionSquareIcon
                      championName={pair.teammateChamp}
                      alt=""
                      className="size-6 rounded ring-1 ring-card"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs">
                        {championName(pair.yourChamp)} +{" "}
                        {championName(pair.teammateChamp)}
                      </span>
                      <span className="shrink-0 text-[10px] text-muted-foreground/70 tabular-nums">
                        {pair.games}g
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
        </AccordionContent>
      </AccordionItem>
    </m.div>
  );
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const rowVariants: Variants = {
  hidden: { opacity: 0, x: -8 },
  show: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 380, damping: 30 } },
};
