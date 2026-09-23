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

// Name, instant and rarity only. The icon is addressed by appid + apiName
// through the image proxy, and the description never renders on this page;
// both were a third of the payload when they rode along.
export interface SteamSessionUnlock {
  apiName: string;
  displayName: string;
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

// Unlocks no observed session can claim, grouped by game and owner-local day.
// The count is the fact; the sample is the first few names so the row can say
// something, capped because a busy off-camera day once carried 19 rows.
export interface SteamOffCameraUnlockGroup {
  game: SteamSessionGameRef;
  // Owner-local calendar day, `YYYY-MM-DD`.
  day: string;
  count: number;
  sample: SteamSessionUnlock[];
}

export const OFF_CAMERA_SAMPLE_LIMIT = 3;

// The session that is open right now, when there is one. Its duration is the
// reader's clock minus `startedAt`, so the page can count up between polls;
// its beats are the subset that is already known at launch — a return, a
// streak, what it was opened after — never anything that needs the length.
export interface SteamLiveSession {
  id: string;
  game: SteamSessionGameRef;
  startedAt: string;
  beats: SteamSessionBeat[];
}

// How recent the presence poll must be for an open row to read as live —
// seven missed two-minute ticks, long enough to ride out a restart.
// Deliberately tighter than the bound that ends a session across a gap: a row
// may still be continued after a blind half hour, but it should not claim
// "now" through one. Shared because the page has to notice the poll coming
// back past it, which is the one change a live flag can lose that no game
// transition reports.
export const LIVE_POLL_FRESH_MS = 15 * 60 * 1000;

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
  // Null unless a game is open as the response is built. Hidden for a
  // visitor like any other named game.
  live: SteamLiveSession | null;
  // Newest first, closed sessions only. The first entry is the hero unless
  // `live` is set.
  sessions: SteamPlaySessionDigest[];
  // Minutes played per owner-local weekday × hour; see `buildHourMatrix`.
  hourMatrix: number[][];
  timeZone: string;
  perGame: SteamSessionGameStrip[];
  milestones: SteamPlaytimeMilestone[];
  records: SteamSessionRecords;
  offCamera: SteamOffCameraUnlockGroup[];
}
