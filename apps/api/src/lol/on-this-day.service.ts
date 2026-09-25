import { Injectable } from "@nestjs/common";
import {
  ON_THIS_DAY_WINDOW_DAYS,
  OWNER_TIME_ZONE,
  type OnThisDay,
  type OnThisDayGame,
  type OnThisDayYear,
  excludeRemakes,
  localDay,
} from "@vyoh/shared";
import { PrismaService } from "../prisma/prisma.service";
import { LolService } from "./lol.service";

// Further back than any history this app holds. A year without games near the
// date produces no entry, so the bound costs nothing when history is shorter.
const MAX_YEARS_BACK = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface OnThisDayRow {
  matchId: string;
  playedAt: Date;
  remake: boolean;
  win: boolean;
  champion: string;
  kills: number;
  deaths: number;
  assists: number;
}

interface Target {
  yearsAgo: number;
  date: string;
}

function isoDate(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// A calendar date as a whole day count, so the distance between two dates is a
// subtraction. Built from the date's own fields at UTC midnight, which no zone
// can shift.
function dayNumber(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1) / DAY_MS;
}

// Today's month and day in each earlier year. 29 February falls back to the
// 28th in a year without it, rather than rolling over into March.
export function onThisDayTargets(now: Date, timeZone = OWNER_TIME_ZONE): Target[] {
  const [y, m, d] = localDay(now, timeZone).split("-").map(Number);
  if (y === undefined || m === undefined || d === undefined) return [];
  return Array.from({ length: MAX_YEARS_BACK }, (_, i) => {
    const year = y - (i + 1);
    const lastDay = new Date(Date.UTC(year, m, 0)).getUTCDate();
    return { yearsAgo: i + 1, date: isoDate(year, m, Math.min(d, lastDay)) };
  });
}

// The instants to ask the database for around one target date. A day wider
// than the window on each side, so any zone's offset stays inside it; the exact
// cut is made on the local date afterwards.
function onThisDayRange(target: Target): { gte: Date; lt: Date } {
  const midnight = dayNumber(target.date) * DAY_MS;
  return {
    gte: new Date(midnight - (ON_THIS_DAY_WINDOW_DAYS + 1) * DAY_MS),
    lt: new Date(midnight + (ON_THIS_DAY_WINDOW_DAYS + 2) * DAY_MS),
  };
}

const kda = (g: OnThisDayRow) => (g.kills + g.assists) / Math.max(1, g.deaths);

function topChampion(games: readonly OnThisDayRow[]): string {
  const tally = new Map<string, { games: number; wins: number }>();
  for (const g of games) {
    const t = tally.get(g.champion) ?? { games: 0, wins: 0 };
    tally.set(g.champion, { games: t.games + 1, wins: t.wins + (g.win ? 1 : 0) });
  }
  const [first] = [...tally].sort(
    ([a, x], [b, y]) => y.games - x.games || y.wins - x.wins || a.localeCompare(b)
  );
  return first?.[0] ?? "";
}

function headline(games: readonly OnThisDayRow[]): OnThisDayGame | null {
  const wins = games.filter((g) => g.win);
  const [best] = [...(wins.length > 0 ? wins : games)].sort((a, b) => kda(b) - kda(a));
  if (!best) return null;
  const { matchId, champion, win, kills, deaths, assists } = best;
  return { matchId, champion, win, kills, deaths, assists };
}

// For each earlier year, the day nearest today's date within the window that
// has games — the exact date when it has any. A tie on distance goes to the
// busier day, which has more of a story to tell, then to the earlier one, so
// the answer never depends on the order rows came back in.
export function buildOnThisDay(
  rows: readonly OnThisDayRow[],
  now: Date,
  timeZone = OWNER_TIME_ZONE
): OnThisDay {
  const targets = onThisDayTargets(now, timeZone);
  const byTarget = new Map<number, Map<string, OnThisDayRow[]>>();
  for (const row of excludeRemakes(rows)) {
    const day = localDay(row.playedAt, timeZone);
    for (const target of targets) {
      if (Math.abs(dayNumber(day) - dayNumber(target.date)) > ON_THIS_DAY_WINDOW_DAYS) {
        continue;
      }
      const days = byTarget.get(target.yearsAgo) ?? new Map<string, OnThisDayRow[]>();
      days.set(day, [...(days.get(day) ?? []), row]);
      byTarget.set(target.yearsAgo, days);
    }
  }

  const years: OnThisDayYear[] = [];
  for (const target of targets) {
    const days = byTarget.get(target.yearsAgo);
    if (!days) continue;
    const distance = (day: string) => Math.abs(dayNumber(day) - dayNumber(target.date));
    const [chosen] = [...days].sort(
      ([a, x], [b, y]) =>
        distance(a) - distance(b) || y.length - x.length || a.localeCompare(b)
    );
    if (!chosen) continue;
    const [date, games] = chosen;
    const best = headline(games);
    if (!best) continue;
    years.push({
      yearsAgo: target.yearsAgo,
      date,
      exact: date === target.date,
      games: games.length,
      wins: games.filter((g) => g.win).length,
      topChampion: topChampion(games),
      headline: best,
    });
  }
  return { years };
}

@Injectable()
export class OnThisDayService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lol: LolService
  ) {}

  async getOnThisDay(
    region: string,
    gameName: string,
    tagLine: string,
    now: Date = new Date()
  ): Promise<OnThisDay> {
    const { puuid } = await this.lol.resolveSummoner(region, gameName, tagLine);
    const rows = await this.prisma.match.findMany({
      where: {
        puuid,
        OR: onThisDayTargets(now).map((t) => ({ playedAt: onThisDayRange(t) })),
      },
      // Chronological, so a KDA tie in the headline goes to the day's earlier
      // game rather than to storage order.
      orderBy: { playedAt: "asc" },
      select: {
        matchId: true,
        playedAt: true,
        remake: true,
        win: true,
        champion: true,
        kills: true,
        deaths: true,
        assists: true,
      },
    });
    return buildOnThisDay(rows, now);
  }
}
