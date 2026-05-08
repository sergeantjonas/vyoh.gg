import { championIconUrl } from "@/lol/_shared/champion-icon";
import { useMatchWindow } from "@/lol/matches/match-window-context";
import type { MatchSummary } from "@vyoh/shared";
import { type Variants, m } from "motion/react";

const DAYS = 7;
const MAX_CHAMPS = 3;

interface ChampionStat {
  champion: string;
  games: number;
  wins: number;
  kills: number;
  deaths: number;
  assists: number;
}

function computeNowPlaying(matches: MatchSummary[]): ChampionStat[] {
  const cutoff = Date.now() - DAYS * 24 * 60 * 60 * 1000;
  const map = new Map<string, ChampionStat>();
  for (const m of matches) {
    if (new Date(m.playedAt).getTime() < cutoff) continue;
    const s = map.get(m.champion) ?? {
      champion: m.champion,
      games: 0,
      wins: 0,
      kills: 0,
      deaths: 0,
      assists: 0,
    };
    map.set(m.champion, {
      ...s,
      games: s.games + 1,
      wins: s.wins + (m.win ? 1 : 0),
      kills: s.kills + m.kills,
      deaths: s.deaths + m.deaths,
      assists: s.assists + m.assists,
    });
  }
  return [...map.values()].sort((a, b) => b.games - a.games).slice(0, MAX_CHAMPS);
}

const container: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.07 } },
};

const row: Variants = {
  hidden: { opacity: 0, x: -8 },
  show: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 380, damping: 30 } },
};

export function ProfileNowPlaying() {
  const { matches } = useMatchWindow();
  if (!matches) return null;

  const champs = computeNowPlaying(matches);
  if (champs.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        Now Playing · last {DAYS} days
      </div>
      <m.div
        initial="hidden"
        animate="show"
        variants={container}
        className="flex flex-col gap-2"
      >
        {champs.map((c) => {
          const winPct = Math.round((c.wins / c.games) * 100);
          const kda =
            c.deaths === 0
              ? (c.kills + c.assists).toFixed(1)
              : ((c.kills + c.assists) / c.deaths).toFixed(2);
          return (
            <m.div
              key={c.champion}
              variants={row}
              className="flex items-center gap-3 rounded-lg border bg-card/50 px-3 py-2"
            >
              <img
                src={championIconUrl(c.champion)}
                alt={c.champion}
                className="size-9 rounded-md object-cover"
                loading="lazy"
              />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{c.champion}</div>
                <div className="text-xs text-muted-foreground">
                  {c.games} {c.games === 1 ? "game" : "games"} · {winPct}% WR
                </div>
              </div>
              <div className="text-right text-sm tabular-nums text-muted-foreground">
                <div>{kda} KDA</div>
                <div className="text-xs">
                  {(c.kills / c.games).toFixed(1)} / {(c.deaths / c.games).toFixed(1)} /{" "}
                  {(c.assists / c.games).toFixed(1)}
                </div>
              </div>
            </m.div>
          );
        })}
      </m.div>
    </div>
  );
}
