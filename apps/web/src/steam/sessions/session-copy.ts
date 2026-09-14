import { formatRarityPercent } from "@/steam/_shared/rarity-percent";
import {
  OWNER_TIME_ZONE,
  type SteamLiveSession,
  type SteamPlaySessionDigest,
  type SteamSessionBeat,
  formatHoursMinutes,
} from "@vyoh/shared";

// The words for each beat. Shared picks the beat and carries its numbers; this
// module is the only place the numbers become sentences, so the hero prose and
// the supporting chips cannot drift apart in tone.
//
// Two registers per beat: `sentence` carries the hero when the beat leads, and
// `chip` is the short form for when it supports another headline. A beat with
// no chip form is hero-only.

const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const CLOCK = new Intl.DateTimeFormat("en-GB", {
  timeZone: OWNER_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function clockOf(iso: string): string {
  return CLOCK.format(new Date(iso));
}

function weekdayOf(slot: { weekday: number }): string {
  return WEEKDAYS[slot.weekday] ?? "day";
}

function daypartOf(hour: number): string {
  if (hour < 5) return "night";
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

function ordinal(n: number): string {
  if (n === 1) return "longest";
  if (n === 2) return "second-longest";
  if (n === 3) return "third-longest";
  return `${n}th-longest`;
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

function daysAsSpan(days: number): string {
  if (days >= 365) return `${Math.floor(days / 365)}+ ${days >= 730 ? "years" : "year"}`;
  if (days >= 60) return `${Math.round(days / 30)} months`;
  if (days >= 14) return `${Math.round(days / 7)} weeks`;
  return plural(days, "day");
}

export interface BeatCopy {
  sentence: string;
  chip: string | null;
}

export function copyFor(beat: SteamSessionBeat, d: SteamPlaySessionDigest): BeatCopy {
  const game = d.game.name;
  switch (beat.kind) {
    case "longest-in-game":
      return beat.rank === 1
        ? {
            sentence: `Your longest ${game} session on record, out of ${beat.of}.`,
            chip: `Longest of ${beat.of}`,
          }
        : {
            sentence: `Your ${ordinal(beat.rank)} ${game} session of ${beat.of}.`,
            chip: `${ordinal(beat.rank).replace(/^./, (c) => c.toUpperCase())} of ${beat.of}`,
          };
    case "longest-in-window":
      return {
        sentence: `The longest session in the window, across ${beat.of} of them.`,
        chip: "Longest lately",
      };
    case "late-finish":
      return {
        sentence: `A run past midnight — ${game} until ${clockOf(d.endedAt)}.`,
        chip: `Until ${clockOf(d.endedAt)}`,
      };
    case "early-start":
      return {
        sentence: `An early start: ${game} at ${clockOf(d.startedAt)}.`,
        chip: `From ${clockOf(d.startedAt)}`,
      };
    case "return":
      return {
        sentence: `The first ${game} in ${daysAsSpan(beat.daysSince)}.`,
        chip: `First in ${daysAsSpan(beat.daysSince)}`,
      };
    case "streak":
      return {
        sentence: `${plural(beat.days, "day")} in a row of ${game}.`,
        chip: `${plural(beat.days, "day")} running`,
      };
    case "milestone":
      return {
        sentence: `${game} passed ${beat.hours} hours in this one.`,
        chip: `Past ${beat.hours}h`,
      };
    case "first-session":
      return {
        sentence: `A first session of ${game} — ${formatHoursMinutes(d.durationMinutes)}, all of it.`,
        chip: "First session",
      };
    case "bounced-from":
      return {
        sentence: `Opened after ${plural(beat.minutes, "minute")} of ${beat.name}.`,
        chip: `After ${beat.minutes}m of ${beat.name}`,
      };
    case "moved-on-to":
      return { sentence: `Then on to ${beat.name}.`, chip: `Then ${beat.name}` };
    case "completed-and-back":
      return {
        sentence: `Every one of ${game}'s ${beat.total} achievements already earned, and still back for more.`,
        chip: "Finished, still playing",
      };
    case "nearly-complete":
      return {
        sentence: `${plural(beat.remaining, "achievement")} from finishing ${game}.`,
        chip: `${beat.remaining} to finish`,
      };
    case "unlocks":
      return {
        sentence:
          beat.rarestPercent === null
            ? `${plural(beat.count, "unlock")} in ${game}.`
            : `${plural(beat.count, "unlock")}, the rarest held by ${formatRarityPercent(beat.rarestPercent)} of players.`,
        chip:
          beat.rarestPercent === null
            ? plural(beat.count, "unlock")
            : `${plural(beat.count, "unlock")} · rarest ${formatRarityPercent(beat.rarestPercent)}`,
      };
    case "usual-slot":
      return {
        sentence: `${game} on a ${weekdayOf(beat.slot)} ${daypartOf(beat.slot.hour)}, in the usual slot.`,
        chip: "Usual slot",
      };
    case "unusual-slot":
      return {
        sentence: `${game} at ${clockOf(d.startedAt)} on a ${weekdayOf(beat.slot)} — not your usual hour.`,
        chip: "Unusual hour",
      };
    case "shape":
      return {
        sentence: `${formatHoursMinutes(d.durationMinutes)} of ${game}, a ${weekdayOf(beat.slot)} ${daypartOf(beat.slot.hour)}.`,
        chip: null,
      };
  }
}

export interface SessionHeadline {
  masthead: string;
  sentence: string;
  chips: string[];
}

/**
 * The live hero: the running duration as masthead, and whatever the session
 * already earned at launch as prose and chips. With nothing earned yet, the
 * prose names the start, which is the one fact a session in progress has.
 */
export function liveHeadlineFor(
  live: SteamLiveSession,
  elapsedMinutes: number,
  maxChips = 2
): SessionHeadline {
  const asDigest: SteamPlaySessionDigest = {
    id: live.id,
    game: live.game,
    startedAt: live.startedAt,
    endedAt: new Date(
      new Date(live.startedAt).getTime() + elapsedMinutes * 60_000
    ).toISOString(),
    durationMinutes: elapsedMinutes,
    beats: live.beats,
    unlocks: [],
  };
  const [lead, ...rest] = live.beats;
  const sentence = lead
    ? copyFor(lead, asDigest).sentence
    : `${live.game.name}, open since ${clockOf(live.startedAt)}.`;
  const chips: string[] = [];
  for (const beat of rest) {
    const chip = copyFor(beat, asDigest).chip;
    if (chip) chips.push(chip);
    if (chips.length >= maxChips) break;
  }
  return {
    masthead: elapsedMinutes < 1 ? "Just opened" : formatHoursMinutes(elapsedMinutes),
    sentence,
    chips,
  };
}

/** The hero's three registers: duration as masthead, lead beat as prose, the next two as chips. */
export function headlineFor(d: SteamPlaySessionDigest, maxChips = 2): SessionHeadline {
  const [lead, ...rest] = d.beats;
  const sentence = lead
    ? copyFor(lead, d).sentence
    : `${formatHoursMinutes(d.durationMinutes)} of ${d.game.name}.`;
  const chips: string[] = [];
  for (const beat of rest) {
    const chip = copyFor(beat, d).chip;
    if (chip) chips.push(chip);
    if (chips.length >= maxChips) break;
  }
  return { masthead: formatHoursMinutes(d.durationMinutes), sentence, chips };
}
