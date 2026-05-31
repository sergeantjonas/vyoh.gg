import { Injectable } from "@nestjs/common";
import type { HomeActivityIntensity } from "@vyoh/shared";
import { PrismaService } from "../prisma/prisma.service";

const TIME_ZONE = "Europe/Brussels";
const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_MS = 60_000;

// Soft-saturation reference points: ~6 ranked matches or ~2h of Steam in the
// window reads as a "busy" day for the owner. The intensity scalar then drives
// chroma in the ambient hero — anything beyond either reference adds no extra
// vibrance, the curve just clamps.
const LOL_SATURATION_MATCHES = 6;
const STEAM_SATURATION_MINUTES = 120;

export interface PlaySessionInterval {
  startedAt: Date;
  endedAt: Date | null;
}

export function computeIntensity(
  lolMatches24h: number,
  steamMinutesToday: number
): number {
  const lolNorm = Math.min(1, Math.max(0, lolMatches24h) / LOL_SATURATION_MATCHES);
  const steamNorm = Math.min(
    1,
    Math.max(0, steamMinutesToday) / STEAM_SATURATION_MINUTES
  );
  return Math.max(lolNorm, steamNorm);
}

function tzOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const m: Record<string, string> = {};
  for (const p of parts) m[p.type] = p.value;
  const asUTC = Date.UTC(
    Number(m.year),
    Number(m.month) - 1,
    Number(m.day),
    Number(m.hour),
    Number(m.minute),
    Number(m.second)
  );
  return asUTC - instant.getTime();
}

/**
 * Start of the current calendar day in `timeZone` as a UTC `Date`. Europe/
 * Brussels DST transitions happen at 02:00 / 03:00 local, never at midnight,
 * so the single offset correction below is always correct.
 */
export function startOfLocalDay(now: Date, timeZone: string): Date {
  const dateParts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const y = Number(dateParts.find((p) => p.type === "year")?.value);
  const m = Number(dateParts.find((p) => p.type === "month")?.value);
  const d = Number(dateParts.find((p) => p.type === "day")?.value);
  const candidate = new Date(Date.UTC(y, m - 1, d));
  const offset = tzOffsetMs(candidate, timeZone);
  return new Date(candidate.getTime() - offset);
}

/**
 * Sum the minutes of each play session that fall within `[dayStart, now]`,
 * clipping each interval to the window. Open sessions (no `endedAt`) are
 * treated as ongoing through `now` so a still-running session contributes
 * the minutes elapsed since it started today.
 */
export function clipSessionMinutes(
  intervals: PlaySessionInterval[],
  dayStart: Date,
  now: Date
): number {
  const startMs = dayStart.getTime();
  const endMs = now.getTime();
  let totalMs = 0;
  for (const iv of intervals) {
    const ivStart = iv.startedAt.getTime();
    const ivEnd = (iv.endedAt ?? now).getTime();
    if (!Number.isFinite(ivStart) || !Number.isFinite(ivEnd)) continue;
    const clippedStart = Math.max(ivStart, startMs);
    const clippedEnd = Math.min(ivEnd, endMs);
    if (clippedEnd > clippedStart) totalMs += clippedEnd - clippedStart;
  }
  return Math.round(totalMs / MIN_MS);
}

@Injectable()
export class HomeActivityIntensityService {
  constructor(private readonly prisma: PrismaService) {}

  async getActivityIntensity(): Promise<HomeActivityIntensity> {
    const now = new Date();
    const dayStart = startOfLocalDay(now, TIME_ZONE);
    const last24h = new Date(now.getTime() - DAY_MS);
    const windowStart = dayStart < last24h ? dayStart : last24h;

    const [matchRows, sessionRows] = await Promise.all([
      this.prisma.match.findMany({
        where: { remake: false, playedAt: { gte: last24h } },
        select: { playedAt: true },
      }),
      this.prisma.steamPlaySession.findMany({
        where: {
          OR: [{ endedAt: null }, { endedAt: { gte: windowStart } }],
        },
        select: { startedAt: true, endedAt: true },
      }),
    ]);

    const lolMatches24h = matchRows.length;
    const steamMinutesToday = clipSessionMinutes(sessionRows, dayStart, now);
    const intensity = computeIntensity(lolMatches24h, steamMinutesToday);

    return {
      lolMatches24h,
      steamMinutesToday,
      intensity,
      asOf: now.toISOString(),
      timeZone: TIME_ZONE,
    };
  }
}
