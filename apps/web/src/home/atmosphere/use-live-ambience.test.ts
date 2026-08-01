import type {
  LiveGameParticipant,
  LiveMatch,
  LolAccount,
  SteamOwnedGame,
  SteamOwnedGames,
  SteamPlayerState,
} from "@vyoh/shared";
import { describe, expect, it } from "vitest";
import { oklchHueFromHex } from "./live-ambience";
import { resolveLiveAmbience } from "./use-live-ambience";

const account: LolAccount = {
  slug: "ahri",
  gameName: "Vyoh",
  tagLine: "Ahri",
  region: "euw1",
  isOwner: true,
  isPrimary: true,
};

function participant(over: Partial<LiveGameParticipant>): LiveGameParticipant {
  return {
    puuid: "p-1",
    anonymous: false,
    teamId: 100,
    championId: 103, // Ahri
    spell1Id: 4,
    spell2Id: 14,
    keystone: 8214,
    riotIdGameName: "Vyoh",
    riotIdTagLine: "Ahri",
    rank: null,
    mastery: null,
    recentForm: null,
    ...over,
  };
}

function liveMatch(participants: LiveGameParticipant[]): LiveMatch {
  return {
    gameId: 999,
    gameStartTime: 0,
    gameLength: 720,
    polledAt: 0,
    queueId: 420,
    mapId: 11,
    gameMode: "CLASSIC",
    platformId: "EUW1",
    participants,
    bans: [],
  };
}

// Only three fields are read here; the full owned-game payload is ~30 fields
// of storefront metadata irrelevant to a hue.
function ownedGames(
  games: Array<Pick<SteamOwnedGame, "appid" | "appType" | "dominantHex">>
): SteamOwnedGames {
  return { games } as unknown as SteamOwnedGames;
}

const steamPlaying: SteamPlayerState = {
  steamId: "76561",
  personaName: "vyoh",
  avatarUrl: "https://test/a.jpg",
  personaState: "online",
  profileVisibility: 3,
  currentGame: { appid: 367520, name: "Hollow Knight" },
  currentGamePlaytimeForeverMinutes: 240,
  lastPolledAt: "2026-06-02T18:00:00Z",
};

const aliasById = (id: number) => (id === 103 ? "Ahri" : null);
const AHRI_HUE = oklchHueFromHex("#c8233e") ?? 0;
const STEAM_BLUE_HUE = oklchHueFromHex("#66c0f4") ?? 0;

const idle = {
  liveGame: null,
  account,
  championAlias: aliasById,
  steam: undefined,
  owned: undefined,
};

describe("resolveLiveAmbience", () => {
  it("returns null when neither stream is live", () => {
    expect(resolveLiveAmbience(idle)).toBeNull();
  });

  it("takes the hue from the owner's champion in a live LoL game", () => {
    const resolved = resolveLiveAmbience({
      ...idle,
      liveGame: liveMatch([participant({})]),
    });
    expect(resolved).toEqual({ kind: "lol", tintH: AHRI_HUE });
  });

  it("ignores other participants when picking the champion", () => {
    const resolved = resolveLiveAmbience({
      ...idle,
      liveGame: liveMatch([
        participant({ championId: 1, riotIdGameName: "Someone", riotIdTagLine: "EUW" }),
        participant({}),
      ]),
    });
    expect(resolved).toEqual({ kind: "lol", tintH: AHRI_HUE });
  });

  it("stays neutral while the champion is unresolvable rather than tinting toward grey", () => {
    // championTheme falls back to #888888 for unknown aliases; tilting the
    // whole page toward an achromatic fallback would read as a colour bug.
    const resolved = resolveLiveAmbience({
      ...idle,
      liveGame: liveMatch([participant({ championId: 9999 })]),
    });
    expect(resolved).toBeNull();
  });

  it("stays neutral when no participant matches the owner", () => {
    const resolved = resolveLiveAmbience({
      ...idle,
      liveGame: liveMatch([participant({ riotIdGameName: "Stranger" })]),
    });
    expect(resolved).toBeNull();
  });

  it("lets LoL win outright when Steam also reports a live game", () => {
    // Steam routinely still reports a background title the owner alt-tabbed
    // away from; the League game is the more specific subject.
    const resolved = resolveLiveAmbience({
      ...idle,
      liveGame: liveMatch([participant({})]),
      steam: steamPlaying,
      owned: ownedGames([{ appid: 367520, appType: 0, dominantHex: "#1a6ea8" }]),
    });
    expect(resolved).toEqual({ kind: "lol", tintH: AHRI_HUE });
  });

  it("does not fall through to Steam when the LoL champion is unresolvable", () => {
    const resolved = resolveLiveAmbience({
      ...idle,
      liveGame: liveMatch([participant({ championId: 9999 })]),
      steam: steamPlaying,
      owned: ownedGames([{ appid: 367520, appType: 0, dominantHex: "#1a6ea8" }]),
    });
    expect(resolved).toBeNull();
  });

  it("takes the hue from the live Steam game's dominant colour", () => {
    const resolved = resolveLiveAmbience({
      ...idle,
      steam: steamPlaying,
      owned: ownedGames([{ appid: 367520, appType: 0, dominantHex: "#c8233e" }]),
    });
    expect(resolved).toEqual({ kind: "steam", tintH: AHRI_HUE });
  });

  it("falls back to Steam blue when the game has no extracted colour", () => {
    const resolved = resolveLiveAmbience({
      ...idle,
      steam: steamPlaying,
      owned: ownedGames([{ appid: 367520, appType: 0, dominantHex: null }]),
    });
    expect(resolved).toEqual({ kind: "steam", tintH: STEAM_BLUE_HUE });
  });

  it("falls back to Steam blue when the game's colour is achromatic", () => {
    const resolved = resolveLiveAmbience({
      ...idle,
      steam: steamPlaying,
      owned: ownedGames([{ appid: 367520, appType: 0, dominantHex: "#888888" }]),
    });
    expect(resolved).toEqual({ kind: "steam", tintH: STEAM_BLUE_HUE });
  });

  it("treats an unmatched appid as a game, matching the now-playing chip", () => {
    const resolved = resolveLiveAmbience({
      ...idle,
      steam: steamPlaying,
      owned: undefined,
    });
    expect(resolved).toEqual({ kind: "steam", tintH: STEAM_BLUE_HUE });
  });

  it("suppresses non-game live apps so Wallpaper Engine can't recolour the page", () => {
    const resolved = resolveLiveAmbience({
      ...idle,
      steam: steamPlaying,
      owned: ownedGames([{ appid: 367520, appType: 6, dominantHex: "#c8233e" }]),
    });
    expect(resolved).toBeNull();
  });

  it("returns null when Steam is online but not in a game", () => {
    const resolved = resolveLiveAmbience({
      ...idle,
      steam: { ...steamPlaying, currentGame: null },
    });
    expect(resolved).toBeNull();
  });

  it("skips the LoL branch entirely when no primary account is configured", () => {
    const resolved = resolveLiveAmbience({
      ...idle,
      account: undefined,
      liveGame: liveMatch([participant({})]),
      steam: steamPlaying,
      owned: ownedGames([{ appid: 367520, appType: 0, dominantHex: "#66c0f4" }]),
    });
    expect(resolved).toEqual({ kind: "steam", tintH: STEAM_BLUE_HUE });
  });
});
