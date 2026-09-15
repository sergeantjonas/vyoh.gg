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
//
// The sentence comes in two subjects. `named` says the game, for a tooltip or
// a chip on another page where nothing else does; `implicit` leaves it out,
// for the hero, whose eyebrow has already said it — three lines naming the
// same game read as a form, not prose.

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

export type CopySubject = "named" | "implicit";

export function copyFor(
  beat: SteamSessionBeat,
  d: SteamPlaySessionDigest,
  subject: CopySubject = "named"
): BeatCopy {
  const named = subject === "named";
  const game = d.game.name;
  // `ofGame` reads " of Onimusha" or nothing; `gameSpace` reads "Onimusha "
  // or nothing; `${game}` stays where the sentence cannot do without it.
  const ofGame = named ? ` of ${game}` : "";
  const gameSpace = named ? `${game} ` : "";
  switch (beat.kind) {
    case "longest-in-game":
      return beat.rank === 1
        ? {
            sentence: `Your longest ${gameSpace}session on record, out of ${beat.of}.`,
            chip: `Longest of ${beat.of}`,
          }
        : {
            sentence: `Your ${ordinal(beat.rank)} ${gameSpace}session of ${beat.of}.`,
            chip: `${ordinal(beat.rank).replace(/^./, (c) => c.toUpperCase())} of ${beat.of}`,
          };
    case "longest-in-window":
      return {
        sentence: `The longest session in the window, across ${beat.of} of them.`,
        chip: "Longest lately",
      };
    case "late-finish":
      return {
        sentence: named
          ? `A run past midnight — ${game} until ${clockOf(d.endedAt)}.`
          : `A run past midnight, until ${clockOf(d.endedAt)}.`,
        chip: `Until ${clockOf(d.endedAt)}`,
      };
    case "early-start":
      return {
        sentence: named
          ? `An early start: ${game} at ${clockOf(d.startedAt)}.`
          : `An early start, at ${clockOf(d.startedAt)}.`,
        chip: `From ${clockOf(d.startedAt)}`,
      };
    case "return":
      return {
        sentence: `The first ${named ? game : "one"} in ${daysAsSpan(beat.daysSince)}.`,
        chip: `First in ${daysAsSpan(beat.daysSince)}`,
      };
    case "streak":
      return {
        sentence: `${plural(beat.days, "day")} in a row${ofGame}.`,
        chip: `${plural(beat.days, "day")} running`,
      };
    case "milestone":
      return {
        sentence: named
          ? `${game} passed ${beat.hours} hours in this one.`
          : `Past ${beat.hours} hours of it, in this one.`,
        chip: `Past ${beat.hours}h`,
      };
    case "first-session":
      return {
        sentence: `A first session${ofGame} — ${formatHoursMinutes(d.durationMinutes)}, all of it.`,
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
        sentence: named
          ? `Every one of ${game}'s ${beat.total} achievements already earned, and still back for more.`
          : `Every one of its ${beat.total} achievements already earned, and still back for more.`,
        chip: "Finished, still playing",
      };
    case "nearly-complete":
      return {
        sentence: `${plural(beat.remaining, "achievement")} from finishing${named ? ` ${game}` : ""}.`,
        chip: `${beat.remaining} to finish`,
      };
    case "unlocks":
      return {
        sentence:
          beat.rarestPercent === null
            ? `${plural(beat.count, "unlock")}${named ? ` in ${game}` : ""}.`
            : `${plural(beat.count, "unlock")}, the rarest held by ${formatRarityPercent(beat.rarestPercent)} of players.`,
        chip:
          beat.rarestPercent === null
            ? plural(beat.count, "unlock")
            : `${plural(beat.count, "unlock")} · rarest ${formatRarityPercent(beat.rarestPercent)}`,
      };
    case "usual-slot":
      return {
        sentence: `${named ? `${game} on a` : "A"} ${weekdayOf(beat.slot)} ${daypartOf(beat.slot.hour)}, in the usual slot.`,
        chip: "Usual slot",
      };
    case "unusual-slot":
      return {
        sentence: `${named ? `${game} at` : "Opened at"} ${clockOf(d.startedAt)} on a ${weekdayOf(beat.slot)} — not your usual hour.`,
        chip: "Unusual hour",
      };
    case "shape":
      return {
        sentence: `${formatHoursMinutes(d.durationMinutes)}${ofGame}, a ${weekdayOf(beat.slot)} ${daypartOf(beat.slot.hour)}.`,
        chip: null,
      };
  }
}

export interface SessionHeadline {
  masthead: string;
  sentence: string;
  chips: string[];
}

/** Fewer closed sessions of the game than this and "past N of M" is noise. */
const LIVE_PROGRESS_MIN_SESSIONS = 3;

export interface LiveProgress {
  /** Closed sessions of this game the running one has already outlasted. */
  passed: number;
  of: number;
  medianMinutes: number;
}

/**
 * Where the running session sits against the game's closed sessions in the
 * window. This is the one live claim that moves while the reader watches:
 * every minute the counter climbs, another session may fall behind it.
 */
function liveProgress(
  live: SteamLiveSession,
  closed: readonly SteamPlaySessionDigest[],
  elapsedMinutes: number
): LiveProgress | null {
  const durations = closed
    .filter((s) => s.game.appid === live.game.appid)
    .map((s) => s.durationMinutes)
    .sort((a, b) => a - b);
  if (durations.length < LIVE_PROGRESS_MIN_SESSIONS) return null;
  const mid = Math.floor(durations.length / 2);
  const medianMinutes =
    durations.length % 2 === 0
      ? Math.round(((durations[mid - 1] ?? 0) + (durations[mid] ?? 0)) / 2)
      : (durations[mid] ?? 0);
  return {
    passed: durations.filter((d) => d < elapsedMinutes).length,
    of: durations.length,
    medianMinutes,
  };
}

// The window is named in weeks because the landing chip and the page read
// different windows; "this window" would be the same words for two numbers.
function progressCopy(
  p: LiveProgress,
  game: string,
  subject: CopySubject,
  weeks: number
): BeatCopy {
  const whose = subject === "named" ? `${game} sessions` : "sessions";
  const span = `in the last ${weeks} weeks`;
  const median = formatHoursMinutes(p.medianMinutes);
  if (p.passed === p.of) {
    return {
      sentence: `Already longer than every one of your ${p.of} ${whose} ${span}.`,
      chip: `Past all ${p.of} · median ${median}`,
    };
  }
  if (p.passed === 0) {
    return {
      sentence: `Not yet as long as any of your ${p.of} ${whose} ${span} — the median is ${median}.`,
      chip: `Median ${median}`,
    };
  }
  return {
    sentence: `Already past ${p.passed} of your ${p.of} ${whose} ${span}.`,
    chip: `Past ${p.passed} of ${p.of} · median ${median}`,
  };
}

/**
 * The live hero: the running duration as masthead, and whatever the session
 * already earned at launch as prose and chips. With nothing earned yet, the
 * prose says where the running time sits against the game's other sessions,
 * and failing that names the start — the one fact every session in progress
 * has. The progress chip leads the chips because it is the one that moves.
 */
export function liveHeadlineFor(
  live: SteamLiveSession,
  elapsedMinutes: number,
  subject: CopySubject = "named",
  closed: readonly SteamPlaySessionDigest[] = [],
  weeks = 12,
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
  const progress = liveProgress(live, closed, elapsedMinutes);
  const progressText = progress
    ? progressCopy(progress, live.game.name, subject, weeks)
    : null;
  const sentence = lead
    ? copyFor(lead, asDigest, subject).sentence
    : progressText
      ? progressText.sentence
      : subject === "named"
        ? `${live.game.name}, open since ${clockOf(live.startedAt)}.`
        : `Open since ${clockOf(live.startedAt)}.`;
  const chips: string[] = [];
  if (lead && progressText?.chip && maxChips > 0) chips.push(progressText.chip);
  for (const beat of rest) {
    if (chips.length >= maxChips) break;
    const chip = copyFor(beat, asDigest).chip;
    if (chip) chips.push(chip);
  }
  return {
    masthead: elapsedMinutes < 1 ? "Just opened" : formatHoursMinutes(elapsedMinutes),
    sentence,
    chips,
  };
}

/** The hero's three registers: duration as masthead, lead beat as prose, the next two as chips. */
export function headlineFor(
  d: SteamPlaySessionDigest,
  subject: CopySubject = "named",
  maxChips = 2
): SessionHeadline {
  const [lead, ...rest] = d.beats;
  const sentence = lead
    ? copyFor(lead, d, subject).sentence
    : subject === "named"
      ? `${formatHoursMinutes(d.durationMinutes)} of ${d.game.name}.`
      : `${formatHoursMinutes(d.durationMinutes)}.`;
  const chips: string[] = [];
  for (const beat of rest) {
    const chip = copyFor(beat, d).chip;
    if (chip) chips.push(chip);
    if (chips.length >= maxChips) break;
  }
  return { masthead: formatHoursMinutes(d.durationMinutes), sentence, chips };
}
