// Baseline: personal — top duo by shared games from your own match history; WR is within the duo's games only.
import { ChampionSquareIcon } from "@/lol/_shared/champion-square-icon";
import { useAccountFromSlug } from "@/lol/_shared/account/use-account-from-slug";
import { useChampionName } from "@/lol/champions/use-champions";
import { useDuos } from "@/lol/profile/use-duos";
import { m, useReducedMotion } from "motion/react";

const MIN_GAMES_FOR_DUO = 5;

export function RecapDuoOfYear({ accountSlug }: { accountSlug: string }) {
  const reduced = useReducedMotion();
  const account = useAccountFromSlug(accountSlug);
  const { data } = useDuos(account, 200);
  const championName = useChampionName();

  const top = data?.[0];
  const empty = !top || top.games < MIN_GAMES_FOR_DUO;

  if (empty) {
    return (
      <m.section
        layout
        initial={reduced ? false : { opacity: 0, y: 16 }}
        whileInView={reduced ? {} : { opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="flex flex-col gap-3 rounded-xl border bg-card/40 p-6"
      >
        <h2 className="text-xs uppercase tracking-wide text-muted-foreground/70">
          Duo of the year
        </h2>
        <p className="text-base text-muted-foreground">
          Once you've queued five or more games with the same teammate, your duo will land
          here.
        </p>
      </m.section>
    );
  }

  const wr = Math.round((top.wins / top.games) * 100);
  const losses = top.games - top.wins;

  return (
    <m.section
      layout
      initial={reduced ? false : { opacity: 0, y: 32 }}
      whileInView={reduced ? {} : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.7, ease: [0.32, 0.72, 0, 1] }}
      className="flex flex-col gap-4 rounded-xl border bg-card/40 p-6 sm:p-8"
    >
      <h2 className="text-xs uppercase tracking-wide text-muted-foreground/70">
        Duo of the year
      </h2>
      <div className="flex items-center gap-4">
        <ChampionSquareIcon
          championName={top.topChampion}
          alt={championName(top.topChampion)}
          className="size-14 shrink-0 rounded-lg ring-1 ring-border/60"
        />
        <div className="flex flex-col">
          <p className="text-2xl font-semibold text-foreground sm:text-3xl">
            {top.gameName}
            <span className="ml-1 text-muted-foreground">#{top.tagLine}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            {top.games} games · {wr}% win rate · most on {championName(top.topChampion)}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 text-sm tabular-nums">
        <span className="text-emerald-500/80">{top.wins}W</span>
        <span className="text-muted-foreground/40">·</span>
        <span className="text-rose-500/80">{losses}L</span>
      </div>
    </m.section>
  );
}
