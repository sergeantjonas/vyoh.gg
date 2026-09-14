// Response shapes for GET /api/steam/sessions — the `/steam/sessions` page.
// One payload carries every band on the page so the route can prime it in a
// single loader read (docs/working-notes/steam/play-sittings.md § Data shape).
//
// A session is a closed `SteamPlaySession` row: one observed launch, from the
// first presence tick that saw the game to the last one that did. Sessions
// only exist where the api was running, so `window.observedSince` and
// `offCamera` are part of the contract rather than footnotes — every
// aggregate here is "of what we saw", and the page says so.

import type { SteamSessionBeat } from "./beats.ts";

export interface SteamSessionUnlock {
  apiName: string;
  displayName: string;
  description: string;
  iconUrl: string | null;
  // Spoiler flag from the schema. The web masks name and icon while the
  // achievement is locked; unlocked rows reveal fully, as Steam's client does.
  hidden: boolean;
  unlockedAt: string;
  globalPercent: number | null;
}

export interface SteamSessionGameRef {
  appid: number;
  name: string;
}

export interface SteamPlaySessionDigest {
  id: string;
  game: SteamSessionGameRef;
  startedAt: string;
  endedAt: string;
  durationMinutes: number;
  // Strongest first. Never empty: `selectSessionBeats` always emits the
  // session's own shape as a floor, so a quiet session still has a headline.
  beats: SteamSessionBeat[];
  unlocks: SteamSessionUnlock[];
}

export interface SteamSessionGameStrip {
  game: SteamSessionGameRef;
  totalMinutes: number;
  // Oldest first — the strip is drawn left to right.
  sessions: Array<{ id: string; startedAt: string; durationMinutes: number }>;
  // Unlock instants inside any of this game's sessions, for the tick marks.
  unlockTicks: string[];
}

export interface SteamPlaytimeMilestone {
  game: SteamSessionGameRef;
  hours: number;
  sessionId: string;
  crossedAt: string;
}

export interface SteamSessionRecord {
  sessionId: string;
  game: SteamSessionGameRef;
  startedAt: string;
  value: number;
}

export interface SteamSessionRecords {
  longest: SteamSessionRecord | null;
  // Latest local finish, as minutes past midnight of the day the session
  // started; a 02:52 finish reads as 1612 so it sorts after 23:59.
  latestFinish: SteamSessionRecord | null;
  mostUnlocks: SteamSessionRecord | null;
  // Longest session with no unlock inside it, where the game has achievements.
  longestDrySpell: SteamSessionRecord | null;
  quickestBounce: SteamSessionRecord | null;
}

export interface SteamOffCameraUnlockGroup {
  game: SteamSessionGameRef;
  // Owner-local calendar day, `YYYY-MM-DD`.
  day: string;
  unlocks: SteamSessionUnlock[];
}

export interface SteamSessionsWindow {
  from: string;
  to: string;
  // `startedAt` of the earliest session in the table, for "based on N
  // sessions since <date>". Null while the table is empty.
  observedSince: string | null;
  sessionCount: number;
}

export interface SteamSessions {
  window: SteamSessionsWindow;
  // Newest first. The first entry is the hero.
  sessions: SteamPlaySessionDigest[];
  // Minutes played per owner-local weekday × hour; see `buildHourMatrix`.
  hourMatrix: number[][];
  timeZone: string;
  perGame: SteamSessionGameStrip[];
  milestones: SteamPlaytimeMilestone[];
  records: SteamSessionRecords;
  offCamera: SteamOffCameraUnlockGroup[];
}
