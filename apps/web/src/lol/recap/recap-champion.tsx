import { championBackdropSplashUrl } from "@/lol/_shared/champion-icon";
import { ChampionSquareIcon } from "@/lol/_shared/champion-square-icon";
import type { MatchSummary } from "@vyoh/shared";
import { m, useReducedMotion } from "motion/react";
import { useMemo } from "react";

interface ChampionAggregate {
  champion: string;
  games: number;
  wins: number;
  kills: number;
  deaths: number;
  assists: number;
}

function aggregate(matches: MatchSummary[]): ChampionAggregate | null {
  const map = new Map<string, ChampionAggregate>();
  for (const m of matches) {
    if (m.remake) continue;
    const prev = map.get(m.champion) ?? {
      champion: m.champion,
      games: 0,
      wins: 0,
      kills: 0,
      deaths: 0,
      assists: 0,
    };
    map.set(m.champion, {
      ...prev,
      games: prev.games + 1,
      wins: prev.wins + (m.win ? 1 : 0),
      kills: prev.kills + m.kills,
      deaths: prev.deaths + m.deaths,
      assists: prev.assists + m.assists,
    });
  }
  const list = [...map.values()];
  if (list.length === 0) return null;
  list.sort((a, b) => b.games - a.games);
  return list[0] ?? null;
}

export function RecapChampion({ matches }: { matches: MatchSummary[] | undefined }) {
  const reduced = useReducedMotion();
  const top = useMemo(() => (matches ? aggregate(matches) : null), [matches]);

  if (!top) {
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
          Champion of the year
        </h2>
        <p className="text-base text-muted-foreground">
          Play a few games and your headline champion will appear here.
        </p>
      </m.section>
    );
  }

  const wr = Math.round((top.wins / top.games) * 100);
  const avgKda =
    top.deaths === 0
      ? (top.kills + top.assists).toFixed(1)
      : ((top.kills + top.assists) / top.deaths).toFixed(2);

  return (
    <m.section
      layout
      initial={reduced ? false : { opacity: 0, y: 32 }}
      whileInView={reduced ? {} : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.7, ease: [0.32, 0.72, 0, 1] }}
      className="relative isolate flex flex-col gap-4 overflow-hidden rounded-xl border p-6 sm:p-8"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-20 overflow-hidden"
        style={{
          maskImage: "linear-gradient(to right, transparent 0%, black 40%, black 100%)",
          WebkitMaskImage:
            "linear-gradient(to right, transparent 0%, black 40%, black 100%)",
        }}
      >
        <img
          src={championBackdropSplashUrl(top.champion, 800, 0)}
          alt=""
          aria-hidden="true"
          loading="eager"
          decoding="async"
          className="size-full object-cover opacity-60"
          style={{ objectPosition: "center 30%" }}
        />
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-card/40"
        style={{
          maskImage:
            "linear-gradient(to right, black 0%, transparent 40%, transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(to right, black 0%, transparent 40%, transparent 100%)",
        }}
      />
      <h2 className="text-xs uppercase tracking-wide text-muted-foreground/70">
        Champion of the year
      </h2>
      <div className="flex items-center gap-4">
        <ChampionSquareIcon
          championName={top.champion}
          alt={top.champion}
          className="size-16 rounded-lg ring-1 ring-border/60"
        />
        <div className="flex flex-col">
          <p className="text-2xl font-semibold text-foreground sm:text-3xl">
            {top.champion}
          </p>
          <p className="text-sm text-muted-foreground">
            {top.games} games · {wr}% win rate
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Stat label="Games" value={String(top.games)} />
        <Stat label="Win rate" value={`${wr}%`} />
        <Stat label="Average KDA" value={avgKda} />
      </div>
    </m.section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/50 bg-background/40 px-4 py-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground/60">
        {label}
      </div>
      <div className="text-xl font-semibold tabular-nums text-foreground/90">{value}</div>
    </div>
  );
}
