import { usePrimaryAccount } from "@/home/use-primary-account";
import { useHydrated } from "@/lib/use-hydrated";
import { championTheme } from "@/lol/_shared/assets/champion-theme";
import { useChampionAliasById } from "@/lol/champions/use-champions";
import { isUserParticipant } from "@/lol/live/live-helpers";
import { useLiveGame } from "@/lol/matches/use-live-match";
import { useSteamOwnedGames } from "@/steam/use-owned-games";
import { useSteamPlayerState } from "@/steam/use-player-state";
import type {
  LiveMatch,
  LolAccount,
  SteamOwnedGames,
  SteamPlayerState,
} from "@vyoh/shared";
import { isSteamGameAppType } from "@vyoh/shared";
import { useMemo } from "react";
import { type LiveAmbience, oklchHueFromHex } from "./live-ambience";

// Steam's brand blue, matching the accent the Steam moments aggregator
// brand-codes. Stands in when the live game has no extracted dominant colour
// (owned games synced before the colour pass, family-shared titles) so a
// Steam session still tints the page rather than reading as idle.
const STEAM_FALLBACK_HEX = "#66c0f4";
const STEAM_FALLBACK_HUE = oklchHueFromHex(STEAM_FALLBACK_HEX) ?? 240;

export function resolveLiveAmbience({
  liveGame,
  account,
  championAlias,
  steam,
  owned,
}: {
  liveGame: LiveMatch | null | undefined;
  account: LolAccount | undefined;
  championAlias: (id: number) => string | null;
  steam: SteamPlayerState | undefined;
  owned: SteamOwnedGames | undefined;
}): LiveAmbience | null {
  // LoL wins outright when both report live, matching NowPlayingStrip — a
  // League game is the more specific subject, and Steam frequently still
  // reports a background title the owner has alt-tabbed away from. Returning
  // early rather than falling through is the point: tinting the page with a
  // Steam game while the owner is mid-League-game would be actively wrong.
  if (liveGame && account) {
    const self = liveGame.participants.find((p) => isUserParticipant(p, account));
    const alias = self ? championAlias(self.championId) : null;
    // No alias means the static bundle hasn't resolved yet (or Riot shipped a
    // champion we don't know). Staying neutral for a render is better than
    // tinting toward `championTheme`'s grey fallback.
    return alias ? lolAmbience(alias) : null;
  }

  const current = steam?.currentGame;
  if (!current) return null;
  // Same suppression as the now-playing chip: non-game live apps (Wallpaper
  // Engine, 3DMark) shouldn't recolour the page. Unmatched appids are assumed
  // to be games, so a null appType passes.
  const ownedMatch = owned?.games?.find((g) => g.appid === current.appid);
  if (!isSteamGameAppType(ownedMatch?.appType ?? null)) return null;
  const hex = ownedMatch?.dominantHex ?? STEAM_FALLBACK_HEX;
  return { kind: "steam", tintH: oklchHueFromHex(hex) ?? STEAM_FALLBACK_HUE };
}

function lolAmbience(alias: string): LiveAmbience | null {
  const hue = oklchHueFromHex(championTheme(alias).dominantHex);
  return hue === null ? null : { kind: "lol", tintH: hue };
}

/**
 * The subject the owner is playing right now, as a hue the atmosphere layer
 * can tilt its blend toward.
 *
 * Costs no new requests. Both presence queries are already polled from the
 * root by `PresenceMounts`, the owned-games list is already mounted on `/` by
 * `NowPlayingStrip`, and the LoL static bundle is already fetched by the Ahri
 * chapter — every read here is a cache hit on a query that exists regardless.
 *
 * Gated on `useHydrated()` for the reason spelled out at `NowPlayingStrip`:
 * these are root-warmed queries read from a code-split route, so the hydrating
 * client render has data the server render never had. Everything downstream of
 * this value is written from an effect rather than rendered, so a divergence
 * wouldn't throw — it would silently tint the hydrating render differently
 * from the server's, which is the harder version of the bug to notice.
 */
export function useLiveAmbience(): LiveAmbience | null {
  const hydrated = useHydrated();
  const { account } = usePrimaryAccount();
  const liveGame = useLiveGame(account).data;
  const steam = useSteamPlayerState().data;
  const owned = useSteamOwnedGames().data;
  // Returns a fresh closure every render, so it's resolved here rather than
  // threaded into the memo below as a dependency.
  const championAlias = useChampionAliasById();

  const resolved = hydrated
    ? resolveLiveAmbience({ liveGame, account, championAlias, steam, owned })
    : null;

  // Rebuilt from primitives so the identity only changes when the subject
  // does. The layer stores this in an effect dependency chain; a new object
  // each render would tear down and re-add its scroll listener every time.
  const kind = resolved?.kind ?? null;
  const tintH = resolved?.tintH ?? null;
  return useMemo(
    () => (kind !== null && tintH !== null ? { kind, tintH } : null),
    [kind, tintH]
  );
}
